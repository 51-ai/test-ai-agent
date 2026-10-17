/**
 * 文档照片识别（Document Photo Reader）
 *
 * 手机拍摄的文档照片 → 可入库的纯文本，供 RAG 知识库、会议纪要等场景使用。
 *
 * 分层设计：
 *   - 格式嗅探 / 尺寸解析 / EXIF 方向 / 文本后处理 / 质量评分：纯函数，无需联网，可离线单测
 *   - 识别后端（OcrBackend）：可注入；默认走 OpenAI 兼容的视觉模型接口，
 *     未配置 API Key 时抛出明确错误（不返回假文本）
 *
 * @module tools/document
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../../../config';

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'bmp' | 'webp' | 'tiff' | 'unknown';

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  tiff: 'image/tiff',
  unknown: 'application/octet-stream'
};

/** 照片本身的技术信息（不依赖 OCR 结果） */
export interface PhotoInspection {
  format: ImageFormat;
  mimeType: string;
  byteLength: number;
  width?: number;
  height?: number;
  /** EXIF Orientation（1-8）；undefined 表示照片未携带方向标记 */
  exifOrientation?: number;
  /** 长宽比提示：竖拍文档照常见的问题是"文字被拍成横向" */
  aspectHint?: string;
  /** 方向异常时给出的处理建议 */
  orientationHint?: string;
}

/** 识别文本的质量评估，用于判断是否需要重拍 */
export interface PhotoQuality {
  score: number;
  textLength: number;
  lineCount: number;
  avgLineLength: number;
  /** 乱码字符（替换符、控制符等）占非空白字符的比例 */
  suspiciousCharRatio: number;
  warnings: string[];
  retakeAdvice?: string;
}

export interface OcrBackendOutput {
  text: string;
  provider: string;
}

export type OcrBackend = (image: {
  base64: string;
  mimeType: string;
  format: ImageFormat;
}) => Promise<OcrBackendOutput>;

export interface DocumentPhotoResult {
  success: boolean;
  text: string;
  inspection: PhotoInspection;
  quality?: PhotoQuality;
  provider: string;
  warnings: string[];
  error?: string;
}

export interface DocumentImageReaderOptions {
  backend?: OcrBackend;
  maxBytes?: number;
}

/** 视觉模型识别文档照片的提示词：只转写、不解释，减少模型"发挥" */
const VISION_OCR_PROMPT = [
  '你是文档识别助手。请把这张文档照片中的文字完整、逐行转写为纯文本。',
  '要求：',
  '1. 只输出照片中真实存在的文字，不要解释、不要总结、不要补充照片里没有的内容；',
  '2. 保留原有的换行与段落结构，表格用「列1 | 列2」的形式表示；',
  '3. 无法辨认的字符用 □ 代替；',
  '4. 忽略页码、页眉页脚水印；',
  '5. 如果是手写体，尽力转写，不确定的字用 □ 标记。'
].join('\n');

// ==================== 纯函数：格式嗅探与解析 ====================

/** 依据文件头魔数判断图片格式（不信任扩展名） */
export function detectImageFormat(buf: Buffer): ImageFormat {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png';
  }
  const head6 = buf.length >= 6 ? buf.subarray(0, 6).toString('latin1') : '';
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  if (buf.length >= 4) {
    const le = buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00;
    const be = buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a;
    if (le || be) return 'tiff';
  }
  return 'unknown';
}

/** 读取像素尺寸：PNG 取 IHDR，JPEG 取 SOFn 段，GIF/BMP 取文件头 */
export function readImageSize(
  buf: Buffer,
  format: ImageFormat
): { width: number; height: number } | null {
  if (format === 'png') {
    if (buf.length < 24) return null;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (format === 'jpeg') {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      // 无长度字段的标记
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      // 进入压缩数据，不再有 SOF
      if (marker === 0xda || marker === 0xd9) return null;
      const segLength = buf.readUInt16BE(offset + 2);
      if (segLength < 2) return null;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        if (offset + 9 >= buf.length) return null;
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += 2 + segLength;
    }
    return null;
  }

  if (format === 'gif') {
    if (buf.length < 10) return null;
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (format === 'bmp') {
    if (buf.length < 26) return null;
    const width = Math.abs(buf.readInt32LE(18));
    const height = Math.abs(buf.readInt32LE(22));
    return width > 0 && height > 0 ? { width, height } : null;
  }

  return null;
}

/** 解析 JPEG 的 EXIF Orientation（1-8）；其余格式或无 EXIF 时返回 undefined */
export function parseExifOrientation(buf: Buffer): number | undefined {
  if (detectImageFormat(buf) !== 'jpeg') return undefined;

  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return undefined;
    const marker = buf[offset + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return undefined;

    const segLength = buf.readUInt16BE(offset + 2);
    if (segLength < 2) return undefined;
    const segStart = offset + 4;
    const segEnd = offset + 2 + segLength;
    if (segEnd > buf.length) return undefined;

    if (marker === 0xe1 && segStart + 6 <= buf.length) {
      if (buf.subarray(segStart, segStart + 6).toString('latin1') === 'Exif\u0000\u0000') {
        return readOrientationFromTiff(buf, segStart + 6, segEnd);
      }
    }

    offset = segEnd;
  }

  return undefined;
}

function readOrientationFromTiff(
  buf: Buffer,
  tiffStart: number,
  tiffEnd: number
): number | undefined {
  if (tiffStart + 8 > tiffEnd) return undefined;
  const byteOrder = buf.subarray(tiffStart, tiffStart + 2).toString('latin1');
  const little = byteOrder === 'II';
  if (!little && byteOrder !== 'MM') return undefined;

  const readU16 = (p: number) => (little ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const readU32 = (p: number) => (little ? buf.readUInt32LE(p) : buf.readUInt32BE(p));

  if (readU16(tiffStart + 2) !== 42) return undefined;
  const ifd = tiffStart + readU32(tiffStart + 4);
  if (ifd + 2 > tiffEnd) return undefined;

  const count = readU16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiffEnd) return undefined;
    if (readU16(entry) === 0x0112) {
      const value = readU16(entry + 8);
      return value >= 1 && value <= 8 ? value : undefined;
    }
  }
  return undefined;
}

function orientationAdvice(orientation: number | undefined): string | undefined {
  if (orientation === undefined || orientation === 1) return undefined;
  const flipped = orientation >= 5;
  return (
    `照片带 EXIF 方向标记 Orientation=${orientation}（${flipped ? '含 90° 旋转' : '含镜像/小角度旋转'}），` +
    '直接识别会让文字横置或倒置，需先按标记旋转正立后再识别'
  );
}

function aspectAdvice(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined;
  const ratio = width / height;
  if (ratio > 3) return '照片非常宽扁，可能是横向拍摄的文档，文字可能有透视畸变';
  if (ratio < 1 / 3) return '照片非常狭长，可能是竖向拼接或截屏拼接，建议分段识别';
  return undefined;
}

// ==================== 纯函数：照片文本后处理 ====================

/** 全角数字/字母归一为半角；中文标点（。，？！等）保持原样 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/\u3000/g, ' ');
}

/** 英文行尾连字符软换行修复：docu-\nment → document */
export function repairHyphenation(text: string): string {
  return text.replace(/([A-Za-z])-[ \t]*\n[ \t]*([a-z])/g, '$1$2');
}

/** 剔除照片特有的噪声行：页码、分隔线、重复出现的页眉页脚水印 */
export function stripPhotoNoise(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());

  const isPageNumber = (l: string): boolean =>
    /^[-–—\s]*\d{1,4}[-–—\s]*$/.test(l) ||
    /^第\s*\d{1,4}\s*页(\s*\/?\s*共?\s*\d{0,4}\s*页?)?$/.test(l) ||
    /^\d{1,4}\s*\/\s*\d{1,4}$/.test(l) ||
    /^page\s*\d{1,4}(\s*of\s*\d{1,4})?$/i.test(l);

  const isSeparator = (l: string): boolean => /^[-=_~·—–*]{3,}$/.test(l);

  const freq = new Map<string, number>();
  for (const l of lines) {
    if (l.length === 0 || l.length > 30) continue;
    freq.set(l, (freq.get(l) ?? 0) + 1);
  }

  const kept = lines.filter((l) => {
    if (l.length === 0) return true;
    if (isPageNumber(l) || isSeparator(l)) return false;
    // 同一短行重复出现 ≥3 次 → 判定为页眉/页脚/水印
    if ((freq.get(l) ?? 0) >= 3 && l.length <= 30) return false;
    return true;
  });

  return kept.join('\n');
}

const LIST_OR_HEADING_START =
  /^\s*(?:[-*•·○●]|\s*#{1,6}\s|\d{1,3}[.、)）]|[①-⑳]|[（(]\d{1,3}[)）])/;
const SENTENCE_END = /[。！？!?；;：:.…]"?["'”’)）\]]?$/;

/**
 * 中文断行重连：OCR/照片识别常把一句话按视觉行宽切成多行。
 * 不跨列表项、标题、表格行合并，避免把结构"粘"成一坨。
 */
export function rejoinBrokenLines(text: string): string {
  const rawLines = text.split('\n');
  const out: string[] = [];

  const looksLikeTableRow = (l: string): boolean =>
    /\|/.test(l) || /\S\s{3,}\S/.test(l);

  for (const raw of rawLines) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim().length === 0) {
      out.push('');
      continue;
    }

    const prev = out.length > 0 ? out[out.length - 1] : '';
    const canMerge =
      prev.trim().length > 0 &&
      !SENTENCE_END.test(prev.trim()) &&
      !LIST_OR_HEADING_START.test(line) &&
      !looksLikeTableRow(prev) &&
      !looksLikeTableRow(line);

    if (!canMerge) {
      out.push(line);
      continue;
    }

    const prevTrimmed = prev.trim();
    const curTrimmed = line.trim();
    const prevTail = prevTrimmed.slice(-1);
    const curHead = curTrimmed.slice(0, 1);
    const latinBoundary = /[A-Za-z0-9]/.test(prevTail) && /[A-Za-z0-9(]/.test(curHead);
    out[out.length - 1] = prevTrimmed + (latinBoundary ? ' ' : '') + curTrimmed;
  }

  return out.join('\n');
}

/** 逐行清理多余空白，保留换行结构 */
export function tidyLines(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SUSPICIOUS_CHAR = /[\ufffd\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** 识别质量评估：给出分数与重拍建议 */
export function evaluatePhotoQuality(text: string): PhotoQuality {
  const trimmed = text.trim();
  const lines = trimmed.length > 0 ? trimmed.split('\n').filter((l) => l.trim().length > 0) : [];
  const textLength = trimmed.replace(/\s/g, '').length;
  const lineCount = lines.length;
  const avgLineLength = lineCount > 0 ? Math.round((textLength / lineCount) * 10) / 10 : 0;

  let suspicious = 0;
  for (const ch of trimmed) {
    if (SUSPICIOUS_CHAR.test(ch)) suspicious++;
  }
  const suspiciousCharRatio =
    textLength > 0 ? Math.round((suspicious / textLength) * 1000) / 1000 : 0;

  const warnings: string[] = [];
  let score = 1;

  if (textLength === 0) {
    score = 0;
    warnings.push('未识别出任何文字');
  } else {
    if (textLength < 20) {
      score -= 0.3;
      warnings.push('识别出的文字过少，可能只拍到了文档的一部分');
    }
    if (suspiciousCharRatio > 0.02) {
      score -= Math.min(suspiciousCharRatio * 2, 0.5);
      warnings.push(`存在 ${suspicious} 个无法辨认的字符，照片可能模糊或反光`);
    }
    if (avgLineLength > 0 && avgLineLength < 5) {
      score -= 0.15;
      warnings.push('识别结果每行只有两三个字，说明文字太小或照片分辨率不足');
    }
    if (lineCount > 0 && lineCount / Math.max(textLength, 1) > 0.3) {
      score -= 0.1;
      warnings.push('换行异常频繁，可能是识别串行');
    }
  }

  score = Math.max(0, Math.min(1, Math.round(score * 100) / 100));

  const quality: PhotoQuality = {
    score,
    textLength,
    lineCount,
    avgLineLength,
    suspiciousCharRatio,
    warnings
  };

  if (score < 0.6) {
    quality.retakeAdvice = [
      '识别质量偏低，建议重拍：',
      '① 把手机平行于纸面（不要斜着拍，避免梯形畸变）；',
      '② 光线均匀、避免闪光灯直射产生反光；',
      '③ 让文档铺满画面 70% 以上，文字尽量大；',
      '④ 手别抖，多拍几张挑最清楚的一张。'
    ].join(' ');
  }

  return quality;
}

export interface PostProcessedPhoto {
  text: string;
  quality: PhotoQuality;
  warnings: string[];
}

/** 后处理流水线：全角归一 → 连字符修复 → 噪声剔除 → 断行重连 → 空白整理 */
export function postProcessPhotoText(rawText: string): PostProcessedPhoto {
  const normalized = normalizeFullWidth(rawText);
  const dehyphenated = repairHyphenation(normalized);
  const cleaned = stripPhotoNoise(dehyphenated);
  const rejoined = rejoinBrokenLines(cleaned);
  const text = tidyLines(rejoined);
  const quality = evaluatePhotoQuality(text);

  const warnings: string[] = [];
  if (normalized !== rawText.trim()) warnings.push('已对全角数字/字母与空白做归一化处理');

  return { text, quality, warnings };
}

// ==================== 识别后端 ====================

export interface VisionBackendOptions {
  apiKey?: string;
  apiBase?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * 默认识别后端：OpenAI 兼容的视觉模型接口（复用项目已有 axios，不引入新依赖）。
 * 未配置 API Key 时直接抛错——宁可失败也不返回假文本。
 */
export function createVisionOcrBackend(options: VisionBackendOptions = {}): OcrBackend {
  return async ({ base64, mimeType, format }) => {
    const apiKey = options.apiKey ?? config.documentImage.apiKey;
    const apiBase = (options.apiBase ?? config.documentImage.apiBase).replace(/\/+$/, '');
    const model = options.model ?? config.documentImage.visionModel;
    const timeout = options.timeoutMs ?? config.documentImage.timeoutMs;

    if (!apiKey) {
      throw new Error(
        '未配置视觉模型 API Key，无法识别文档照片。请设置环境变量 OPENAI_API_KEY（或 OCR_VISION_API_KEY）'
      );
    }
    if (format === 'unknown') {
      throw new Error('无法识别的图片格式');
    }

    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model,
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_OCR_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }
        ]
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('视觉模型未返回可用文本，照片可能不清晰或接口返回异常');
    }

    return { text: content, provider: `vision:${model}` };
  };
}

// ==================== 读取器 ====================

export class DocumentImageReader {
  private backend: OcrBackend;
  private maxBytes: number;

  constructor(options: DocumentImageReaderOptions = {}) {
    this.backend = options.backend ?? createVisionOcrBackend();
    this.maxBytes = options.maxBytes ?? config.documentImage.maxBytes;
  }

  /** 仅检查照片本身的信息，不调用识别后端 */
  inspectBuffer(buf: Buffer): PhotoInspection {
    const format = detectImageFormat(buf);
    const size = readImageSize(buf, format);
    const exifOrientation = parseExifOrientation(buf);
    const inspection: PhotoInspection = {
      format,
      mimeType: MIME_BY_FORMAT[format],
      byteLength: buf.length,
      width: size?.width,
      height: size?.height,
      exifOrientation
    };
    const orientationHint = orientationAdvice(exifOrientation);
    if (orientationHint) inspection.orientationHint = orientationHint;
    const aspectHint = aspectAdvice(size?.width, size?.height);
    if (aspectHint) inspection.aspectHint = aspectHint;
    return inspection;
  }

  postProcess(rawText: string): PostProcessedPhoto {
    return postProcessPhotoText(rawText);
  }

  async read(filePath: string): Promise<DocumentPhotoResult> {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        text: '',
        inspection: {
          format: 'unknown',
          mimeType: MIME_BY_FORMAT.unknown,
          byteLength: 0
        },
        provider: 'none',
        warnings: [],
        error: `文件不存在: ${path.basename(filePath)}`
      };
    }
    return this.readBuffer(fs.readFileSync(filePath), path.basename(filePath));
  }

  async readBuffer(buf: Buffer, fileName = ''): Promise<DocumentPhotoResult> {
    const inspection = this.inspectBuffer(buf);
    const warnings: string[] = [];
    if (inspection.orientationHint) warnings.push(inspection.orientationHint);
    if (inspection.aspectHint) warnings.push(inspection.aspectHint);

    const label = fileName ? `「${fileName}」` : '该照片';

    if (inspection.format === 'unknown') {
      return {
        success: false,
        text: '',
        inspection,
        provider: 'none',
        warnings,
        error: `${label}不是可识别的图片格式（支持 JPEG / PNG / WebP / BMP / GIF / TIFF）`
      };
    }

    if (inspection.byteLength > this.maxBytes) {
      const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
      return {
        success: false,
        text: '',
        inspection,
        provider: 'none',
        warnings,
        error: `${label}体积 ${mb(inspection.byteLength)}MB，超过 ${mb(this.maxBytes)}MB 上限，请压缩后再上传`
      };
    }

    let backendOutput: OcrBackendOutput;
    try {
      backendOutput = await this.backend({
        base64: buf.toString('base64'),
        mimeType: inspection.mimeType,
        format: inspection.format
      });
    } catch (error) {
      return {
        success: false,
        text: '',
        inspection,
        provider: 'vision',
        warnings,
        error: `照片识别失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    const processed = postProcessPhotoText(backendOutput.text);
    return {
      success: processed.text.length > 0,
      text: processed.text,
      inspection,
      quality: processed.quality,
      provider: backendOutput.provider,
      warnings: [...warnings, ...processed.warnings, ...processed.quality.warnings],
      error: processed.text.length > 0 ? undefined : '识别结果为空，请确认照片内容并重拍'
    };
  }
}

export const documentImageReader = new DocumentImageReader();
