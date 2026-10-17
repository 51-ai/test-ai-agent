import { describe, it, expect } from '@jest/globals';
import {
  detectImageFormat,
  readImageSize,
  parseExifOrientation,
  normalizeFullWidth,
  repairHyphenation,
  stripPhotoNoise,
  rejoinBrokenLines,
  postProcessPhotoText,
  evaluatePhotoQuality,
  createVisionOcrBackend,
  DocumentImageReader
} from '../core/tools/document/ImageDocumentReader';

// ==================== 真图片字节构造（不依赖任何图像库） ====================

/** 构造一个结构合法的 PNG 文件头（含 IHDR 宽高） */
function makePng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'latin1');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 2; // color type: truecolor
  return Buffer.concat([signature, ihdr]);
}

/** 构造 JPEG 的 EXIF APP1 段（含 Orientation 标签） */
function makeExifApp1(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 偏移
  tiff.writeUInt16LE(1, 8); // 条目数
  tiff.writeUInt16LE(0x0112, 10); // Orientation 标签
  tiff.writeUInt16LE(3, 12); // 类型 SHORT
  tiff.writeUInt32LE(1, 14); // 数量
  tiff.writeUInt16LE(orientation, 18); // 值
  tiff.writeUInt32LE(0, 22); // 下一个 IFD

  const payload = Buffer.concat([Buffer.from('Exif\u0000\u0000', 'latin1'), tiff]);
  const lengthField = Buffer.alloc(2);
  lengthField.writeUInt16BE(payload.length + 2, 0);
  return Buffer.concat([Buffer.from([0xff, 0xe1]), lengthField, payload]);
}

/** 构造 JPEG：SOI + [可选 EXIF] + SOF0(宽高) + EOI */
function makeJpeg(width: number, height: number, orientation?: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const exif = orientation === undefined ? Buffer.alloc(0) : makeExifApp1(orientation);

  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8; // 精度
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3; // 分量数
  for (let i = 0; i < 9; i++) sof[10 + i] = i + 1;

  return Buffer.concat([soi, exif, sof, Buffer.from([0xff, 0xd9])]);
}

function makeGif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.write('GIF89a', 0, 'latin1');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function makeBmp(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('BM', 0, 'latin1');
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  return buf;
}

function makeWebp(): Buffer {
  const buf = Buffer.alloc(20);
  buf.write('RIFF', 0, 'latin1');
  buf.write('WEBP', 8, 'latin1');
  return buf;
}

// ==================== 测试 ====================

describe('图片格式嗅探（依据文件头魔数，不信任扩展名）', () => {
  it('识别 JPEG / PNG / GIF / BMP / WEBP', () => {
    expect(detectImageFormat(makeJpeg(800, 600))).toBe('jpeg');
    expect(detectImageFormat(makePng(800, 600))).toBe('png');
    expect(detectImageFormat(makeGif(320, 240))).toBe('gif');
    expect(detectImageFormat(makeBmp(640, 480))).toBe('bmp');
    expect(detectImageFormat(makeWebp())).toBe('webp');
  });

  it('把扩展名是 .jpg 但不是图片的字节判为 unknown', () => {
    const fake = Buffer.from('这其实是一段文本，不是图片', 'utf8');
    expect(detectImageFormat(fake)).toBe('unknown');
  });
});

describe('像素尺寸解析', () => {
  it('解析 PNG 的 IHDR 宽高', () => {
    expect(readImageSize(makePng(1240, 1754), 'png')).toEqual({ width: 1240, height: 1754 });
  });

  it('解析 JPEG 的 SOF0 宽高', () => {
    expect(readImageSize(makeJpeg(3024, 4032), 'jpeg')).toEqual({ width: 3024, height: 4032 });
  });

  it('解析 GIF 与 BMP 的宽高', () => {
    expect(readImageSize(makeGif(320, 240), 'gif')).toEqual({ width: 320, height: 240 });
    expect(readImageSize(makeBmp(640, 480), 'bmp')).toEqual({ width: 640, height: 480 });
  });

  it('截断的 PNG 返回 null 而不是抛异常', () => {
    expect(readImageSize(makePng(10, 10).subarray(0, 12), 'png')).toBeNull();
  });
});

describe('EXIF 方向解析（照片横置/倒置的根因）', () => {
  it('读出 Orientation=6', () => {
    expect(parseExifOrientation(makeJpeg(1000, 2000, 6))).toBe(6);
  });

  it('读出 Orientation=1', () => {
    expect(parseExifOrientation(makeJpeg(1000, 2000, 1))).toBe(1);
  });

  it('无 EXIF 的 JPEG 返回 undefined', () => {
    expect(parseExifOrientation(makeJpeg(1000, 2000))).toBeUndefined();
  });

  it('PNG 不解析 EXIF，返回 undefined', () => {
    expect(parseExifOrientation(makePng(100, 100))).toBeUndefined();
  });

  it('inspectBuffer 对有方向标记的照片给出旋转提示', () => {
    const reader = new DocumentImageReader({ backend: async () => ({ text: 'x', provider: 'test' }) });
    const inspection = reader.inspectBuffer(makeJpeg(2000, 1000, 6));
    expect(inspection.exifOrientation).toBe(6);
    expect(inspection.orientationHint).toContain('Orientation=6');
  });

  it('inspectBuffer 对正常照片不给旋转提示', () => {
    const reader = new DocumentImageReader({ backend: async () => ({ text: 'x', provider: 'test' }) });
    expect(reader.inspectBuffer(makeJpeg(2000, 1000, 1)).orientationHint).toBeUndefined();
  });

  it('长宽比超过 3 时提示可能是横拍文档', () => {
    const reader = new DocumentImageReader({ backend: async () => ({ text: 'x', provider: 'test' }) });
    expect(reader.inspectBuffer(makePng(4000, 800)).aspectHint).toContain('横向拍摄');
  });
});

describe('照片文本后处理', () => {
  it('把被换行切断的句子重新接上', () => {
    const result = rejoinBrokenLines('这是一句被\n换行切断的话，最后才结束。');
    expect(result).toBe('这是一句被换行切断的话，最后才结束。');
    expect(result.includes('\n')).toBe(false);
  });

  it('句末标点之后不合并下一行', () => {
    expect(rejoinBrokenLines('第一句结束。\n第二句开始。')).toBe('第一句结束。\n第二句开始。');
  });

  it('列表项与后续内容不被粘成一行', () => {
    const result = rejoinBrokenLines('步骤如下：\n- 第一步做这个\n- 第二步做那个');
    expect(result.split('\n')).toEqual(['步骤如下：', '- 第一步做这个', '- 第二步做那个']);
  });

  it('剔除页码、分隔线与重复页眉水印', () => {
    const noisy = [
      '公司内部资料',
      '正文第一段内容。',
      '- 3 -',
      '公司内部资料',
      '正文第二段内容。',
      '======',
      '公司内部资料',
      '正文第三段内容。',
      '第 4 页'
    ].join('\n');

    const cleaned = stripPhotoNoise(noisy);
    expect(cleaned).not.toContain('公司内部资料');
    expect(cleaned).not.toContain('- 3 -');
    expect(cleaned).not.toContain('======');
    expect(cleaned).not.toContain('第 4 页');
    expect(cleaned).toContain('正文第一段内容。');
    expect(cleaned).toContain('正文第三段内容。');
  });

  it('只出现一两次的短行不会被误删', () => {
    const cleaned = stripPhotoNoise('标题行\n正文内容。');
    expect(cleaned).toContain('标题行');
  });

  it('全角数字与字母归一为半角，中文标点保持原样', () => {
    expect(normalizeFullWidth('第１２３页，ＡＢＣ测试。')).toBe('第123页，ABC测试。');
    expect(normalizeFullWidth('１２３')).toBe('123');
  });

  it('修复英文行尾连字符软换行', () => {
    expect(repairHyphenation('docu-\nment 是被切开的单词')).toBe('document 是被切开的单词');
  });

  it('postProcessPhotoText 串起完整流水线', () => {
    const raw = '文档标题\n\n这是正文，被拍成了两行，\n中间断开。\n- 7 -\n全文结束。';
    const result = postProcessPhotoText(raw);

    expect(result.text).not.toContain('- 7 -');
    expect(result.text).toContain('这是正文，被拍成了两行，中间断开。');
    expect(result.quality.score).toBeGreaterThan(0);
  });
});

describe('识别质量评估与重拍建议', () => {
  it('空文本得 0 分并给出提示', () => {
    const quality = evaluatePhotoQuality('');
    expect(quality.score).toBe(0);
    expect(quality.warnings).toContain('未识别出任何文字');
    expect(quality.retakeAdvice).toBeDefined();
  });

  it('正常识别文本得满分', () => {
    const quality = evaluatePhotoQuality('这是一段正常的识别文本，长度足够，用于验证质量评分逻辑。');
    expect(quality.score).toBe(1);
    expect(quality.retakeAdvice).toBeUndefined();
  });

  it('乱码过多时降分并要求重拍', () => {
    const quality = evaluatePhotoQuality('\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd测试测试');
    expect(quality.score).toBeLessThan(0.6);
    expect(quality.suspiciousCharRatio).toBeGreaterThan(0.5);
    expect(quality.retakeAdvice).toContain('重拍');
  });

  it('文字过少（只拍到一角）会降分', () => {
    const quality = evaluatePhotoQuality('好');
    expect(quality.score).toBeLessThan(1);
    expect(quality.warnings.length).toBeGreaterThan(0);
  });
});

describe('DocumentImageReader', () => {
  it('注入识别后端后完成识别，并标记 provider', async () => {
    const reader = new DocumentImageReader({
      backend: async ({ mimeType, format }) => {
        expect(mimeType).toBe('image/png');
        expect(format).toBe('png');
        return { text: '第一行内容，需要够长才能通过质量检查。\n第二行内容。', provider: 'test-backend' };
      }
    });

    const result = await reader.readBuffer(makePng(1200, 1600), 'doc.png');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('test-backend');
    expect(result.text).toContain('第一行内容');
    expect(result.inspection.format).toBe('png');
    expect(result.inspection.width).toBe(1200);
    expect(result.quality?.score).toBeGreaterThan(0);
  });

  it('非图片字节给出明确错误', async () => {
    const reader = new DocumentImageReader({ backend: async () => ({ text: 'x', provider: 't' }) });
    const result = await reader.readBuffer(Buffer.from('这不是图片', 'utf8'), 'notes.txt');

    expect(result.success).toBe(false);
    expect(result.error).toContain('不是可识别的图片格式');
    expect(result.error).toContain('notes.txt');
  });

  it('超过体积上限时拒绝识别', async () => {
    const reader = new DocumentImageReader({
      backend: async () => ({ text: 'x', provider: 't' }),
      maxBytes: 64
    });
    const big = Buffer.concat([makePng(100, 100), Buffer.alloc(200)]);
    const result = await reader.readBuffer(big, 'big.png');

    expect(result.success).toBe(false);
    expect(result.error).toContain('上限');
  });

  it('文件不存在时返回明确错误', async () => {
    const reader = new DocumentImageReader({ backend: async () => ({ text: 'x', provider: 't' }) });
    const result = await reader.read('definitely-not-here-12345.png');

    expect(result.success).toBe(false);
    expect(result.error).toContain('文件不存在');
  });

  it('识别后端抛错时不吞异常，原样透出原因', async () => {
    const reader = new DocumentImageReader({
      backend: async () => {
        throw new Error('识别服务连接超时');
      }
    });
    const result = await reader.readBuffer(makePng(100, 100), 'x.png');

    expect(result.success).toBe(false);
    expect(result.error).toContain('识别服务连接超时');
  });

  it('识别结果为空时标记失败', async () => {
    const reader = new DocumentImageReader({ backend: async () => ({ text: '   \n  ', provider: 't' }) });
    const result = await reader.readBuffer(makePng(100, 100), 'blank.png');

    expect(result.success).toBe(false);
    expect(result.error).toContain('识别结果为空');
  });
});

describe('视觉模型识别后端', () => {
  it('未配置 API Key 时抛出明确错误，不返回假文本', async () => {
    const backend = createVisionOcrBackend({ apiKey: '' });
    await expect(
      backend({ base64: 'AAAA', mimeType: 'image/png', format: 'png' })
    ).rejects.toThrow(/API Key/);
  });

  it('格式 unknown 时拒绝请求', async () => {
    const backend = createVisionOcrBackend({ apiKey: 'test-key-not-real' });
    await expect(
      backend({ base64: 'AAAA', mimeType: 'application/octet-stream', format: 'unknown' })
    ).rejects.toThrow(/无法识别的图片格式/);
  });
});
