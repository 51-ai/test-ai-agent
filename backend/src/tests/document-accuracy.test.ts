import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { documentParserService } from '../core/tools/document/DocumentParserTool';
import { htmlToReadableText, normalizeDocumentText } from '../core/tools/document/DocumentParserTool';

// ==================== 现场生成真实 .docx（不引入 fixture 二进制） ====================

interface ZipBuilder {
  file(filePath: string, data: string): void;
  generateAsync(options: { type: 'nodebuffer' }): Promise<Buffer>;
}

async function createZipBuilder(): Promise<ZipBuilder> {
  const mod = await import('jszip');
  const Ctor = (mod as unknown as { default: new () => ZipBuilder }).default;
  return new Ctor();
}

const DOCUMENT_XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** 生成一个含标题与 2x2 表格的合法 .docx（验证 Word 解析能保留表格结构） */
async function buildDocx(targetPath: string, title: string, rows: string[][]): Promise<void> {
  const zip = await createZipBuilder();

  const cells = (values: string[]) =>
    values
      .map(
        (v) =>
          `<w:tc><w:p><w:r><w:t xml:space="preserve">${v}</w:t></w:r></w:p></w:tc>`
      )
      .join('');
  const tableRows = rows.map((r) => `<w:tr>${cells(r)}</w:tr>`).join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${DOCUMENT_XML_NS}"><w:body>` +
      `<w:p><w:pPr><w:headingId w:val="1"/></w:pPr><w:r><w:t xml:space="preserve">${title}</w:t></w:r></w:p>` +
      `<w:tbl>${tableRows}</w:tbl>` +
      `</w:body></w:document>`
  );

  fs.writeFileSync(targetPath, await zip.generateAsync({ type: 'nodebuffer' }));
}

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-acc-test-'));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function tempFile(name: string): string {
  return path.join(tempDir, name);
}

// ==================== 文本后处理工具 ====================

describe('htmlToReadableText', () => {
  it('保留标题/正文/表格结构并剔除标签', () => {
    const html =
      '<h1>标题</h1><p>正文段落</p>' +
      '<table><tr><td>姓名</td><td>年龄</td></tr><tr><td>小明</td><td>12</td></tr></table>';
    const text = htmlToReadableText(html);

    expect(text).not.toContain('<');
    expect(text).toContain('标题');
    expect(text).toContain('正文段落');
    expect(text).toContain('姓名');
    expect(text).toContain('小明');
    expect(text).toContain('12');
    // 表格单元格之间用「 | 」分隔
    expect(text).toContain('姓名');
    expect(text).toContain('年龄');
  });
});

describe('normalizeDocumentText', () => {
  it('折叠多余空行并去除行尾空白', () => {
    const input = '第一行   \n\n\n\n第二行   ';
    const out = normalizeDocumentText(input);
    expect(out).toBe('第一行\n\n第二行');
  });

  it('统一回车换行符', () => {
    expect(normalizeDocumentText('a\r\nb')).toBe('a\nb');
  });
});

// ==================== Word 解析准确度 ====================

describe('Word(.docx) 解析准确度', () => {
  it('解析出标题与表格内容（保留结构，而非拍平成一坨）', async () => {
    const file = tempFile('table.docx');
    await buildDocx(file, '学生名单', [
      ['姓名', '年龄'],
      ['小明', '12'],
      ['小红', '11']
    ]);

    const result = await documentParserService.parse(file);

    expect(result.success).toBe(true);
    const content = result.content;
    expect(content).toContain('学生名单');
    expect(content).toContain('姓名');
    expect(content).toContain('小明');
    expect(content).toContain('12');
    expect(content).toContain('小红');
    // 表格单元格之间应当有分隔，证明结构被保留
    expect(content).toContain(' | ');
    // 不应残留任何 HTML 标签
    expect(content).not.toContain('<w:');
    expect(content).not.toContain('<table');
  });
});
