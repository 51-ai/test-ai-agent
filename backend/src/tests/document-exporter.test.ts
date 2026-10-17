import { describe, it, expect } from '@jest/globals';
import { exportDocument, listSupportedExportFormats } from '../core/tools/document/DocumentExporter';

describe('文档导出器', () => {
  const text = '这是正文第一行。\n这是第二行。';

  it('导出格式清单包含多种格式（含小众）', () => {
    const formats = listSupportedExportFormats().map((f) => f.format);
    expect(formats).toEqual(
      expect.arrayContaining(['md', 'txt', 'html', 'json', 'csv', 'xml', 'tex', 'org', 'rst', 'rtf'])
    );
    expect(formats).toHaveLength(10);
  });

  it('Markdown：带标题，正文保留', () => {
    const r = exportDocument(text, 'md', { title: '我的笔记' });
    expect(r.extension).toBe('md');
    expect(r.mimeType).toBe('text/markdown');
    const s = r.buffer.toString('utf8');
    expect(s).toContain('# 我的笔记');
    expect(s).toContain('这是正文第一行');
  });

  it('纯文本：标题下划线', () => {
    const r = exportDocument(text, 'txt', { title: '报告' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('报告');
    expect(s).toMatch(/={2,}/);
  });

  it('HTML：包裹成完整文档，正文被转义', () => {
    const r = exportDocument('<b>加粗</b> & 符号', 'html', { title: '页面' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('<!DOCTYPE html>');
    expect(s).toContain('<title>页面</title>');
    expect(s).toContain('&lt;b&gt;'); // 危险字符被转义
    expect(s).toContain('&amp;');
  });

  it('JSON：结构化输出含标题与时间戳', () => {
    const r = exportDocument(text, 'json', { title: '数据' });
    const obj = JSON.parse(r.buffer.toString('utf8'));
    expect(obj.title).toBe('数据');
    expect(obj.content).toContain('这是正文第一行');
    expect(typeof obj.exportedAt).toBe('string');
  });

  it('CSV：每行一个字段，并带 header', () => {
    const r = exportDocument('行一\n行二', 'csv', { title: 't' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('text');
    expect(s).toContain('行一');
    expect(s).toContain('行二');
  });

  it('XML：标签包裹且正文在 CDATA 中', () => {
    const r = exportDocument(text, 'xml', { title: 'x' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('<document>');
    expect(s).toContain('<![CDATA[');
  });

  it('LaTeX：包裹 article 环境，特殊字符被转义', () => {
    const r = exportDocument('100% & 完成', 'tex', { title: '论文' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('\\begin{document}');
    expect(s).toContain('\\end{document}');
    expect(s).toContain('100\\%');
    expect(s).toContain('\\&');
  });

  it('Org-mode：带 #+TITLE', () => {
    const r = exportDocument(text, 'org', { title: 'org笔记' });
    expect(r.buffer.toString('utf8')).toContain('#+TITLE: org笔记');
  });

  it('reStructuredText：标题下划线', () => {
    const r = exportDocument(text, 'rst', { title: 'rst标题' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('rst标题');
    expect(s).toMatch(/\n={2,}/);
  });

  it('RTF：包裹 rtf1 控制字，换行转为 \\par', () => {
    const r = exportDocument('第一段\n第二段', 'rtf', { title: 'r' });
    const s = r.buffer.toString('utf8');
    expect(s).toContain('{\\rtf1');
    expect(s).toContain('\\par');
  });

  it('不支持的格式抛出可读错误', () => {
    expect(() => exportDocument('x', 'docx' as any)).toThrow(/不支持的导出格式/);
  });
});
