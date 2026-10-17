/**
 * 文档生成 / 导出服务
 *
 * 把 agent 的回答（Markdown / 纯文本）导出成多种格式，零额外依赖：
 *   md .txt .html .json .csv .xml .tex(LaTeX) .org(Org-mode) .rst(reStructuredText) .rtf
 *
 * 设计原则：不引入重型生成库（如 pandoc / docx / pdfkit），所有格式用纯字符串拼装，
 * 保证在任意环境都能跑通；如需 .docx/.pdf 等二进制格式，后续可在此扩展。
 *
 * @module tools/document/exporter
 */

export type ExportFormat =
  | 'md'
  | 'txt'
  | 'html'
  | 'json'
  | 'csv'
  | 'xml'
  | 'tex'
  | 'org'
  | 'rst'
  | 'rtf';

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  format: ExportFormat;
}

export interface ExportOptions {
  /** 文档标题（用于 html/json/xml/org/rst 等带标题的格式） */
  title?: string;
  /** 额外元数据（会被并入 json 输出） */
  meta?: Record<string, unknown>;
}

const FORMAT_MIME: Record<ExportFormat, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  json: 'application/json',
  csv: 'text/csv',
  xml: 'application/xml',
  tex: 'application/x-tex',
  org: 'text/plain',
  rst: 'text/plain',
  rtf: 'application/rtf'
};

/** 对外暴露支持的导出格式清单（前端用来渲染下拉菜单） */
export function listSupportedExportFormats(): { format: ExportFormat; label: string; extension: string }[] {
  return [
    { format: 'md', label: 'Markdown', extension: 'md' },
    { format: 'txt', label: '纯文本', extension: 'txt' },
    { format: 'html', label: '网页 HTML', extension: 'html' },
    { format: 'json', label: 'JSON 数据', extension: 'json' },
    { format: 'csv', label: 'CSV 表格', extension: 'csv' },
    { format: 'xml', label: 'XML', extension: 'xml' },
    { format: 'tex', label: 'LaTeX', extension: 'tex' },
    { format: 'org', label: 'Org-mode', extension: 'org' },
    { format: 'rst', label: 'reStructuredText', extension: 'rst' },
    { format: 'rtf', label: 'RTF 富文本', extension: 'rtf' }
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsvField(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%#$_^{}~])/g, '\\$1');
}

function escapeRtf(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}

/** 把纯文本按空行分段，渲染为简单 HTML 段落 */
function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((b) => b.length > 0)
    .map((block) => `    <p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

/**
 * 把文本导出为指定格式。
 * @throws 当 format 不被支持时抛出可读错误（调用方应捕获并转成 400）。
 */
export function exportDocument(text: string, format: ExportFormat, options: ExportOptions = {}): ExportResult {
  const title = options.title?.trim() || '未命名文档';
  const safeText = text ?? '';
  let content: string;

  switch (format) {
    case 'md':
      content = `# ${title}\n\n${safeText}`;
      break;
    case 'txt':
      content = `${title}\n${'='.repeat(Math.min(title.length, 60))}\n\n${safeText}`;
      break;
    case 'html':
      content =
        `<!DOCTYPE html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="utf-8"/>\n` +
        `    <title>${escapeHtml(title)}</title>\n  </head>\n  <body>\n    <h1>${escapeHtml(title)}</h1>\n` +
        `${textToHtmlParagraphs(safeText)}\n  </body>\n</html>\n`;
      break;
    case 'json':
      content = JSON.stringify(
        {
          title,
          content: safeText,
          exportedAt: new Date().toISOString(),
          ...(options.meta || {})
        },
        null,
        2
      );
      break;
    case 'csv': {
      const rows = safeText.split(/\r?\n/).map((line) => escapeCsvField(line));
      content = ['text', ...rows].join('\n');
      break;
    }
    case 'xml':
      content =
        `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n` +
        `  <title>${escapeXml(title)}</title>\n` +
        `  <content><![CDATA[${safeText}]]></content>\n</document>\n`;
      break;
    case 'tex':
      content =
        `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\begin{document}\n` +
        `\\title{${escapeLatex(title)}}\n\\maketitle\n\n${escapeLatex(safeText)}\n\\end{document}\n`;
      break;
    case 'org':
      content = `#+TITLE: ${title}\n\n${safeText}\n`;
      break;
    case 'rst':
      content = `${title}\n${'='.repeat(Math.min(title.length, 60))}\n\n${safeText}\n`;
      break;
    case 'rtf':
      content =
        `{\\rtf1\\ansi\\ansicpg936\n{\\fonttbl{\\f0\\fnil\\fcharset134 SimSun;}}\n` +
        `\\f0\\fs22 ${escapeRtf(safeText).replace(/\n/g, '\\par ')}\n}\n`;
      break;
    default:
      throw new Error(
        `不支持的导出格式: ${format}；支持 ${listSupportedExportFormats()
          .map((f) => f.format)
          .join(' / ')}`
      );
  }

  return {
    buffer: Buffer.from(content, 'utf8'),
    mimeType: FORMAT_MIME[format],
    extension: format,
    format
  };
}
