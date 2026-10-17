import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { documentParserService } from '../core/tools/document/DocumentParserTool';

// ==================== 现场生成真实文件（不引入任何 fixture 二进制） ====================

async function createZipBuilder(): Promise<any> {
  const mod = await import('jszip');
  const Ctor = (mod as unknown as { default: new () => any }).default;
  return new Ctor();
}

/** 生成一个结构真实的 .odt（OpenDocument Text）：zip 包 + content.xml，正文在 <text:p> 内 */
async function buildOdt(targetPath: string, paragraphs: string[]): Promise<void> {
  const zip = await createZipBuilder();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
  const body = paragraphs.map((p) => `<text:p>${p}</text:p>`).join('');
  zip.file(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ` +
      `xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">` +
      `<office:body><office:text>${body}</office:text></office:body></office:document-content>`
  );
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: 'nodebuffer' }));
}

/** 生成一个结构真实的 .epub：zip 包 + OEBPS 下的 XHTML 正文 */
async function buildEpub(targetPath: string, chapters: string[]): Promise<void> {
  const zip = await createZipBuilder();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container></container>');
  chapters.forEach((html, i) => {
    zip.file(
      `OEBPS/chapter${i + 1}.xhtml`,
      `<?xml version="1.0"?><html><head><title>Ch${i + 1}</title></head><body>${html}</body></html>`
    );
  });
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

tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-formats-test-'));
fs.writeFileSync(tempFile('placeholder.txt'), 'x');

// ==================== 纯文本 / 标记类格式 ====================

describe('纯文本与标记格式解析', () => {
  it('Markdown：保留可见文本，去掉 # 等标记语法', async () => {
    const file = tempFile('note.md');
    fs.writeFileSync(file, '# 标题\n\n这是一段 **加粗** 的正文。\n- 列表项一\n- 列表项二');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('标题');
    expect(r.content).toContain('加粗');
    expect(r.content).toContain('列表项一');
  });

  it('CSV：原样读出表格文本', async () => {
    const file = tempFile('data.csv');
    fs.writeFileSync(file, 'name,age\nAlice,12\nBob,13');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('Alice,12');
    expect(r.content).toContain('Bob,13');
  });

  it('JSON：原样读出', async () => {
    const file = tempFile('config.json');
    fs.writeFileSync(file, '{"key":"value","n":42}');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('"key":"value"');
  });

  it('HTML：去掉标签，保留正文与换行', async () => {
    const file = tempFile('page.html');
    fs.writeFileSync(file, '<html><body><h1>标题</h1><p>第一段</p><p>第二段</p></body></html>');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('标题');
    expect(r.content).toContain('第一段');
    expect(r.content).not.toContain('<h1>');
    expect(r.content).not.toContain('<p>');
  });

  it('LaTeX：去掉命令与环境，保留正文', async () => {
    const file = tempFile('paper.tex');
    fs.writeFileSync(
      file,
      '\\documentclass{article}\n\\begin{document}\n这是正文内容。\n\\end{document}'
    );
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('这是正文内容');
    expect(r.content).not.toContain('\\documentclass');
    expect(r.content).not.toContain('\\begin{document}');
  });

  it('RTF：去掉控制字，保留正文', async () => {
    const file = tempFile('legacy.rtf');
    fs.writeFileSync(file, '{\\rtf1\\ansi 这是 \\par 富文本正文 }');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('这是');
    expect(r.content).toContain('富文本正文');
    expect(r.content).not.toContain('\\rtf1');
  });

  it('TXT：直接读出', async () => {
    const file = tempFile('readme.txt');
    fs.writeFileSync(file, '普通文本文件内容');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('普通文本文件内容');
  });
});

// ==================== 结构化文档格式 ====================

describe('OpenDocument 与 EPUB 解析', () => {
  it('ODT：从 content.xml 抽取 <text:p> 文本', async () => {
    const file = tempFile('doc.odt');
    await buildOdt(file, ['第一段落', '第二段落包含关键词']);
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('第一段落');
    expect(r.content).toContain('第二段落包含关键词');
  });

  it('EPUB：抽取各章节 XHTML 正文并拼接', async () => {
    const file = tempFile('book.epub');
    await buildEpub(file, [
      '<h1>第一章</h1><p>开头故事</p>',
      '<h1>第二章</h1><p>后续发展</p>'
    ]);
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
    expect(r.content).toContain('第一章');
    expect(r.content).toContain('开头故事');
    expect(r.content).toContain('第二章');
    expect(r.content).toContain('后续发展');
  });
});

// ==================== 不支持格式仍给出友好提示 ====================

describe('边界与不支持格式', () => {
  it('未知扩展名仍列出支持的纯文本格式', async () => {
    const file = tempFile('weird.xyz');
    fs.writeFileSync(file, 'whatever');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(false);
    expect(r.error).toContain('不支持的文件类型');
    expect(r.error).toContain('.md');
    expect(r.error).toContain('.csv');
  });

  it('空 HTML 文件解析不报错（返回空文本但 success）', async () => {
    const file = tempFile('empty.html');
    fs.writeFileSync(file, '<html><body></body></html>');
    const r = await documentParserService.parse(file);
    expect(r.success).toBe(true);
  });
});
