import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { documentParserService } from '../core/tools/document/DocumentParserTool';

// ==================== 现场生成真实文件（不引入任何 fixture 二进制） ====================

interface ZipBuilder {
  file(filePath: string, data: string): void;
  generateAsync(options: { type: 'nodebuffer' }): Promise<Buffer>;
}

async function createZipBuilder(): Promise<ZipBuilder> {
  const mod = await import('jszip');
  const Ctor = (mod as unknown as { default: new () => ZipBuilder }).default;
  return new Ctor();
}

interface SlideFixture {
  index: number;
  texts: string[];
  notes?: string[];
}

/**
 * 生成一个结构真实的 .pptx（OOXML 包）：
 * 注意备注页文件名故意与幻灯片序号错开（notesSlide = 100 + 序号），
 * 以此验证解析器是读 slideN.xml.rels 关系、而不是按序号硬猜备注归属。
 */
async function buildPptx(targetPath: string, slides: SlideFixture[]): Promise<void> {
  const zip = await createZipBuilder();

  for (const slide of slides) {
    const runs = slide.texts.map((t) => `<a:t>${t}</a:t>`).join('');
    zip.file(
      `ppt/slides/slide${slide.index}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${runs}</p:spTree></p:cSld></p:sld>`
    );

    if (slide.notes) {
      const notesIndex = 100 + slide.index;
      const notesRuns = slide.notes.map((t) => `<a:t>${t}</a:t>`).join('');
      zip.file(
        `ppt/slides/_rels/slide${slide.index}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${notesIndex}.xml"/></Relationships>`
      );
      zip.file(
        `ppt/notesSlides/notesSlide${notesIndex}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${notesRuns}</p:spTree></p:cSld></p:notes>`
      );
    }
  }

  fs.writeFileSync(targetPath, await zip.generateAsync({ type: 'nodebuffer' }));
}

let tempDir: string;

function tempFile(name: string): string {
  return path.join(tempDir, name);
}

beforeEach(() => {
  documentParserService.clearCache();
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-parser-test-'));
fs.writeFileSync(tempFile('placeholder.txt'), 'x');

// ==================== 测试 ====================

describe('PPTX 解析', () => {
  it('提取幻灯片文本，页数正确（含幻灯片编号不连续的情况）', async () => {
    const file = tempFile('gap.pptx');
    await buildPptx(file, [
      { index: 1, texts: ['第一页标题', '第一页正文'] },
      { index: 3, texts: ['第三页内容'] }
    ]);

    const result = await documentParserService.parse(file);

    expect(result.success).toBe(true);
    expect(result.metadata.pageCount).toBe(2);
    expect(result.content).toContain('=== 第 1 页 ===');
    expect(result.content).toContain('=== 第 3 页 ===');
    expect(result.content).toContain('第三页内容');
    // 不存在的第 2 页不应被凭空造出来
    expect(result.content).not.toContain('=== 第 2 页 ===');
  });

  it('把演讲者备注挂到正确的幻灯片上（依据 rels 关系，而非序号猜测）', async () => {
    const file = tempFile('notes.pptx');
    await buildPptx(file, [
      { index: 2, texts: ['第二页正文'], notes: ['备注属于第二页'] },
      { index: 3, texts: ['第三页正文'], notes: ['备注属于第三页'] }
    ]);

    const result = await documentParserService.parse(file);
    const content = result.content;

    const page2 = content.indexOf('=== 第 2 页 ===');
    const note2 = content.indexOf('[演讲者备注] 备注属于第二页');
    const page3 = content.indexOf('=== 第 3 页 ===');
    const note3 = content.indexOf('[演讲者备注] 备注属于第三页');

    expect(note2).toBeGreaterThan(page2);
    expect(note2).toBeLessThan(page3);
    expect(note3).toBeGreaterThan(page3);
  });

  it('无文本的纯图片页保留页码标记，避免后续页码错位', async () => {
    const file = tempFile('image-page.pptx');
    await buildPptx(file, [
      { index: 1, texts: ['第一页有文字'] },
      { index: 2, texts: [] },
      { index: 3, texts: ['第三页有文字'] }
    ]);

    const result = await documentParserService.parse(file);

    expect(result.metadata.pageCount).toBe(3);
    expect(result.content).toContain('=== 第 2 页 ===');
    expect(result.content).toContain('本页无文本');
    expect(result.content).toContain('第三页有文字');
  });
});

describe('文件类型路由', () => {
  it('旧版 .doc 给出明确的另存为 .docx 提示，而不是静默失败', async () => {
    const file = tempFile('legacy.doc');
    fs.writeFileSync(file, 'legacy binary doc');

    const result = await documentParserService.parse(file);

    expect(result.success).toBe(false);
    expect(result.error).toContain('.docx');
    expect(result.metadata.fileSize).toBeGreaterThan(0);
  });

  it('旧版 .ppt 给出明确的另存为 .pptx 提示', async () => {
    const file = tempFile('legacy.ppt');
    fs.writeFileSync(file, 'legacy binary ppt');

    const result = await documentParserService.parse(file);

    expect(result.success).toBe(false);
    expect(result.error).toContain('.pptx');
  });

  it('未知扩展名列出支持的格式', async () => {
    const file = tempFile('data.xyz');
    fs.writeFileSync(file, 'whatever');

    const result = await documentParserService.parse(file);

    expect(result.success).toBe(false);
    expect(result.error).toContain('不支持的文件类型');
    expect(result.error).toContain('.png');
  });

  it('文件不存在时返回文件不存在', async () => {
    const result = await documentParserService.parse(tempFile('missing.pdf'));

    expect(result.success).toBe(false);
    expect(result.error).toBe('文件不存在');
  });
});

describe('解析缓存', () => {
  it('同一文件第二次解析命中缓存', async () => {
    const file = tempFile('cached.pptx');
    await buildPptx(file, [{ index: 1, texts: ['缓存测试内容'] }]);

    const first = await documentParserService.parse(file);
    const second = await documentParserService.parse(file);

    expect(first.success).toBe(true);
    expect(first.fromCache).toBeUndefined();
    expect(second.fromCache).toBe(true);
    expect(second.content).toBe(first.content);
  });

  it('源文件变更后缓存自动失效', async () => {
    const file = tempFile('changed.pptx');
    await buildPptx(file, [{ index: 1, texts: ['版本一'] }]);
    const first = await documentParserService.parse(file);
    expect(first.content).toContain('版本一');

    await buildPptx(file, [{ index: 1, texts: ['版本二，内容明显更长一些'] }]);
    const second = await documentParserService.parse(file);

    expect(second.fromCache).toBeUndefined();
    expect(second.content).toContain('版本二');
    expect(second.content).not.toContain('版本一');
  });

  it('clearCache 后重新解析', async () => {
    const file = tempFile('cleared.pptx');
    await buildPptx(file, [{ index: 1, texts: ['清缓存测试'] }]);

    await documentParserService.parse(file);
    documentParserService.clearCache();
    const again = await documentParserService.parse(file);

    expect(again.fromCache).toBeUndefined();
    expect(again.success).toBe(true);
  });
});

describe('批量解析', () => {
  it('parseBatch 保留逐条结果顺序', async () => {
    const ok = tempFile('batch-ok.pptx');
    await buildPptx(ok, [{ index: 1, texts: ['批量解析内容'] }]);

    const results = await documentParserService.parseBatch([ok, tempFile('batch-missing.pdf')]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});
