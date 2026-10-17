/**
 * 文档解析工具集
 *
 * 支持解析：PDF、Word(.docx)、PowerPoint(.pptx)、以及**文档照片**（.jpg/.png/.webp/.bmp/.gif/.tiff，走 OCR）
 *
 * @module tools/document
 */

import fs from 'fs';
import path from 'path';
import { ToolExecutor, ToolCallResult } from '../../tool-enhance';
import { documentImageReader, PhotoQuality } from './ImageDocumentReader';

export interface DocumentParseResult {
  success: boolean;
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;
    author?: string;
    createdDate?: string;
    modifiedDate?: string;
    /** 照片识别专有信息：格式、像素尺寸、EXIF 方向、识别质量 */
    image?: {
      format: string;
      width?: number;
      height?: number;
      exifOrientation?: number;
      qualityScore?: number;
      quality?: PhotoQuality;
    };
  };
  /** 命中解析缓存（同一文件未变更时不再重复解析） */
  fromCache?: boolean;
  /** 解析过程中的提示（如照片方向、识别质量警告） */
  warnings?: string[];
  error?: string;
}

/** 文档解析支持的图片扩展名（照片识别入口） */
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tif', '.tiff']);

// ==================== 文本后处理：提升入库质量 ====================

/**
 * 把 Word 转换出的 HTML 转成保留结构的纯文本：
 * 标题/列表/表格都尽量可读（表格用「 | 」分隔单元格、每行一段），
 * 比 mammoth 的 extractRawText 更准——后者会把表格和标题全部拍平成一坨。
 */
export function htmlToReadableText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/(p|div|h[1-6]|li)\s*\/?>/gi, '\n')
    .replace(/<\s*li\s*\/?>/gi, '\n• ')
    .replace(/<\s*tr\s*\/?>/gi, '\n')
    .replace(/<\s*\/t[dh]\s*\/?>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * 归一化解析出的文档文本：折叠多余空行、去掉行尾空白，减少 RAG 分块噪声。
 */
export function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 文档解析工具基类
 */
export abstract class BaseDocumentParser {
  protected filePath: string;
  protected fileBuffer?: Buffer;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * 解析文档
   */
  abstract parse(): Promise<DocumentParseResult>;

  /**
   * 验证文件是否存在
   */
  protected validateFile(): boolean {
    if (!fs.existsSync(this.filePath)) {
      return false;
    }
    return true;
  }

  /**
   * 获取文件元数据
   *
   * 文件不存在或不可读时返回零体积：各解析器的"文件不存在"分支都会调用本方法组装元数据，
   * 若在此抛出 ENOENT，友好错误提示将永远不可达（旧实现即为此问题）。
   */
  protected getFileMetadata(): { fileName: string; fileType: string; fileSize: number } {
    const fileName = path.basename(this.filePath);
    const fileType = path.extname(this.filePath).toLowerCase();
    try {
      return { fileName, fileType, fileSize: fs.statSync(this.filePath).size };
    } catch {
      return { fileName, fileType, fileSize: 0 };
    }
  }
}

/**
 * PDF 文档解析器
 */
export class PDFParser extends BaseDocumentParser {
  async parse(): Promise<DocumentParseResult> {
    if (!this.validateFile()) {
      return {
        success: false,
        content: '',
        metadata: {
          ...this.getFileMetadata(),
          fileName: path.basename(this.filePath)
        },
        error: '文件不存在'
      };
    }

    try {
      // 尝试使用 pdf-parse
      const pdfParse = await import('pdf-parse').catch(() => null);
      
      if (pdfParse) {
        const dataBuffer = fs.readFileSync(this.filePath);
        const data = await pdfParse.default(dataBuffer);
        
        const pdfData = data as { text: string; numpages?: number; info?: { Author?: string; CreationDate?: string; ModDate?: string } };
        
        return {
          success: true,
          content: normalizeDocumentText(pdfData.text),
          metadata: {
            ...this.getFileMetadata(),
            pageCount: pdfData.numpages,
            author: pdfData.info?.Author,
            createdDate: pdfData.info?.CreationDate,
            modifiedDate: pdfData.info?.ModDate
          }
        };
      }

      // 备选方案：使用 pdf2json
      return await this.parseWithPdf2Json();
    } catch (error) {
      return {
        success: false,
        content: '',
        metadata: this.getFileMetadata(),
        error: `PDF解析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async parseWithPdf2Json(): Promise<DocumentParseResult> {
    try {
      const pdf2json = await import('pdf2json').catch(() => null);
      
      if (!pdf2json) {
        return this.dependencyMissingResult();
      }

      return new Promise((resolve) => {
        const parser = new pdf2json.default(null, true);
        
        parser.on('pdfParser_dataError', (err: { parserError?: Error } | Error) => {
          const errorMsg = 'parserError' in err 
            ? err.parserError?.message 
            : (err as Error).message;
          resolve({
            success: false,
            content: '',
            metadata: this.getFileMetadata(),
            error: `PDF解析错误: ${errorMsg || '未知错误'}`
          });
        });

        parser.on('pdfParser_dataReady', (pdfData: { Pages?: any[] }) => {
          const rawTextContent = parser.getRawTextContent();
          const pageCount = pdfData.Pages?.length || 0;
          resolve({
            success: true,
            content: rawTextContent,
            metadata: {
              ...this.getFileMetadata(),
              pageCount: pageCount
            }
          });
        });

        parser.loadPDF(this.filePath);
      });
    } catch {
      return this.dependencyMissingResult();
    }
  }

  private dependencyMissingResult(): DocumentParseResult {
    // 返回一个友好的错误提示
    return {
      success: false,
      content: '',
      metadata: this.getFileMetadata(),
      error: 'PDF解析需要安装 pdf-parse 或 pdf2json。请运行: npm install pdf-parse'
    };
  }
}

/**
 * Word 文档解析器
 */
export class WordParser extends BaseDocumentParser {
  async parse(): Promise<DocumentParseResult> {
    if (!this.validateFile()) {
      return {
        success: false,
        content: '',
        metadata: this.getFileMetadata(),
        error: '文件不存在'
      };
    }

    try {
      const mammoth = await import('mammoth').catch(() => null);
      
      if (mammoth) {
        // 用 convertToHtml 保留标题/列表/表格结构，再转成可读纯文本（比 extractRawText 更准）
        const html = await mammoth.default.convertToHtml({ path: this.filePath });
        const content = normalizeDocumentText(htmlToReadableText(html.value));

        return {
          success: true,
          content,
          metadata: {
            ...this.getFileMetadata()
          }
        };
      }

      return this.dependencyMissingResult();
    } catch (error) {
      return {
        success: false,
        content: '',
        metadata: this.getFileMetadata(),
        error: `Word文档解析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private dependencyMissingResult(): DocumentParseResult {
    return {
      success: false,
      content: '',
      metadata: this.getFileMetadata(),
      error: 'Word解析需要安装 mammoth。请运行: npm install mammoth'
    };
  }
}

/**
 * PowerPoint 解析器
 */
export class PPTParser extends BaseDocumentParser {
  async parse(): Promise<DocumentParseResult> {
    if (!this.validateFile()) {
      return {
        success: false,
        content: '',
        metadata: this.getFileMetadata(),
        error: '文件不存在'
      };
    }

    try {
      return await this.parseWithXml();
    } catch (error) {
      return {
        success: false,
        content: '',
        metadata: this.getFileMetadata(),
        error: `PPT解析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /** 提取一段 OOXML 片段内的全部 <a:t> 文本节点 */
  private static extractTextRuns(xml: string): string[] {
    const matches = xml.match(/<a:t>[\s\S]*?<\/a:t>/g);
    if (!matches) return [];
    return matches
      .map((m) => m.replace(/<\/?a:t>/g, '').trim())
      .filter((t) => t.length > 0);
  }

  private async parseWithXml(): Promise<DocumentParseResult> {
    const JSZipModule = await import('jszip').catch(() => null);

    if (!JSZipModule) {
      return this.dependencyMissingResult();
    }

    const zip = new JSZipModule.default();
    const content = await zip.loadAsync(fs.readFileSync(this.filePath));

    // 仅匹配真正的幻灯片 XML；旧实现用未锚定的正则，会把 _rels/slideN.xml.rels 也算成幻灯片，
    // 且按 1..count 顺序读取会在幻灯片编号不连续时丢页。
    const slideIndexes = Object.keys(content.files)
      .map((name) => name.match(/^ppt\/slides\/slide(\d+)\.xml$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => parseInt(m[1], 10))
      .sort((a, b) => a - b);

    if (slideIndexes.length === 0) {
      return {
        success: false,
        content: '',
        metadata: this.getFileMetadata(),
        error: '未在文件中找到幻灯片内容，该 .pptx 文件可能已损坏'
      };
    }

    const blocks: string[] = [];

    for (const index of slideIndexes) {
      const slideFile = content.file(`ppt/slides/slide${index}.xml`);
      const slideTexts = slideFile
        ? PPTParser.extractTextRuns(await slideFile.async('string'))
        : [];

      let block = `=== 第 ${index} 页 ===`;
      // 无文本页也要保留页码标记，否则后续正文页码会与幻灯片编号错位
      block += slideTexts.length > 0
        ? `\n${slideTexts.join(' ').replace(/\s+/g, ' ').trim()}`
        : '\n(本页无文本，可能为纯图片页)';

      // 备注页与幻灯片的对应关系写在 slideN.xml.rels 里，不能按序号硬猜
      const relsFile = content.file(`ppt/slides/_rels/slide${index}.xml.rels`);
      if (relsFile) {
        const rels = await relsFile.async('string');
        const notesMatch = rels.match(/Target="([^"]*notesSlide\d+\.xml)"/);
        if (notesMatch) {
          const notesPath = notesMatch[1].replace(/^\.\.\//, 'ppt/').replace(/^\//, '');
          const notesFile = content.file(notesPath);
          if (notesFile) {
            const notesTexts = PPTParser.extractTextRuns(await notesFile.async('string'));
            if (notesTexts.length > 0) {
              block += `\n[演讲者备注] ${notesTexts.join(' ').replace(/\s+/g, ' ').trim()}`;
            }
          }
        }
      }

      blocks.push(block);
    }

    return {
      success: true,
      content: blocks.join('\n\n').trim(),
      metadata: {
        ...this.getFileMetadata(),
        pageCount: slideIndexes.length
      }
    };
  }

  private dependencyMissingResult(): DocumentParseResult {
    return {
      success: false,
      content: '',
      metadata: this.getFileMetadata(),
      error: 'PPT解析需要安装 jszip。请运行: npm install jszip'
    };
  }
}

/**
 * 文档解析服务
 */
export class DocumentParserService {
  private parsers: Map<string, BaseDocumentParser>;
  /** 解析结果缓存：key = 绝对路径|mtimeMs|size，源文件一旦变化自动失效 */
  private cache: Map<string, DocumentParseResult> = new Map();
  private readonly maxCacheEntries = 100;

  constructor() {
    this.parsers = new Map();
  }

  /** 清空解析缓存 */
  clearCache(): void {
    this.cache.clear();
  }

  private cacheKey(filePath: string): string | null {
    try {
      const stats = fs.statSync(filePath);
      return `${path.resolve(filePath)}|${stats.mtimeMs}|${stats.size}`;
    } catch {
      return null;
    }
  }

  private storeCache(key: string | null, result: DocumentParseResult): DocumentParseResult {
    if (!key) return result;
    if (this.cache.size >= this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, result);
    return result;
  }

  private fileMetadata(filePath: string): { fileName: string; fileType: string; fileSize: number } {
    const fileName = path.basename(filePath);
    const fileType = path.extname(filePath).toLowerCase();
    try {
      return { fileName, fileType, fileSize: fs.statSync(filePath).size };
    } catch {
      return { fileName, fileType, fileSize: 0 };
    }
  }

  private unsupportedFormat(filePath: string, message: string): DocumentParseResult {
    return {
      success: false,
      content: '',
      metadata: this.fileMetadata(filePath),
      error: message
    };
  }

  /**
   * 解析文档（支持缓存与文档照片识别）
   */
  async parse(filePath: string): Promise<DocumentParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    const key = this.cacheKey(filePath);

    if (key) {
      const hit = this.cache.get(key);
      if (hit) return { ...hit, fromCache: true };
    }

    let result: DocumentParseResult;

    if (IMAGE_EXTENSIONS.has(ext)) {
      result = await this.parseImage(filePath);
    } else {
      let parser: BaseDocumentParser;

      switch (ext) {
        case '.pdf':
          parser = new PDFParser(filePath);
          break;
        case '.docx':
          parser = new WordParser(filePath);
          break;
        case '.doc':
          return this.unsupportedFormat(
            filePath,
            '旧版 .doc 是二进制格式，无法直接解析；请在 Word / WPS 中另存为 .docx 后再上传'
          );
        case '.pptx':
          parser = new PPTParser(filePath);
          break;
        case '.ppt':
          return this.unsupportedFormat(
            filePath,
            '旧版 .ppt 是二进制格式，无法直接解析；请在 PowerPoint / WPS 中另存为 .pptx 后再上传'
          );
        default:
          return this.unsupportedFormat(
            filePath,
            `不支持的文件类型: ${ext || '(无扩展名)'}；支持 PDF / .docx / .pptx，` +
              '以及文档照片 .jpg .jpeg / .png / .webp / .bmp / .gif / .tif .tiff'
          );
      }

      result = await parser.parse();
    }

    return this.storeCache(key, result);
  }

  /** 文档照片识别：手机拍摄的文档照片 → 可入库文本 */
  private async parseImage(filePath: string): Promise<DocumentParseResult> {
    const photo = await documentImageReader.read(filePath);

    return {
      success: photo.success,
      content: photo.text,
      metadata: {
        ...this.fileMetadata(filePath),
        image: {
          format: photo.inspection.format,
          width: photo.inspection.width,
          height: photo.inspection.height,
          exifOrientation: photo.inspection.exifOrientation,
          qualityScore: photo.quality?.score,
          quality: photo.quality
        }
      },
      warnings: photo.warnings,
      error: photo.error
    };
  }

  /**
   * 批量解析文档
   */
  async parseBatch(filePaths: string[]): Promise<DocumentParseResult[]> {
    const results: DocumentParseResult[] = [];
    
    for (const filePath of filePaths) {
      const result = await this.parse(filePath);
      results.push(result);
    }

    return results;
  }

  /**
   * 提取文本（支持多种格式）
   */
  async extractText(filePath: string): Promise<string> {
    const result = await this.parse(filePath);
    return result.content;
  }

  /**
   * 获取文档信息
   */
  async getInfo(filePath: string): Promise<DocumentParseResult['metadata'] | null> {
    const result = await this.parse(filePath);
    return result.metadata;
  }
}

export const documentParserService = new DocumentParserService();

/**
 * 文档解析工具（供 Agent 调用）
 */
export class DocumentParserTool {
  private service = documentParserService;

  async execute(toolId: string, parameters: Record<string, any>): Promise<ToolCallResult> {
    const startTime = Date.now();
    
    const { filePath, extractText } = parameters;

    if (!filePath) {
      return {
        success: false,
        error: '缺少文件路径参数',
        duration: Date.now() - startTime
      };
    }

    try {
      if (extractText) {
        // 仅提取文本
        const text = await this.service.extractText(filePath);
        return {
          success: true,
          result: { text },
          duration: Date.now() - startTime
        };
      }

      // 完整解析
      const result = await this.service.parse(filePath);
      return {
        success: result.success,
        result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
}

export const documentParserTool = new DocumentParserTool();