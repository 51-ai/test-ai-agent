import { Router, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { documentParserService } from '../core/tools/document/DocumentParserTool';
import { exportDocument, listSupportedExportFormats, ExportFormat } from '../core/tools/document/DocumentExporter';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { getSharedAgent } from '../core/Agent';

const router = Router();

/**
 * 接收文档：前端把文件转成 base64 上传 → 写临时文件 → 解析 → 可选加入 RAG 知识库。
 * 支持 DocumentParserService 能解析的全部格式（PDF/docx/pptx/odt/ods/odp/epub/图片/纯文本小众格式等）。
 */
router.post('/import', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileName, content, title, addToRag } = (req.body || {}) as {
      fileName?: string;
      content?: string;
      title?: string;
      addToRag?: boolean;
    };

    if (!fileName || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 fileName 或 content（base64 编码的文件内容）' });
    }

    // 兼容 "data:application/...;base64,xxxx" 与裸 base64 两种传法
    const base64 = content.replace(/^data:[^;]+;base64,/, '');
    let buf: Buffer;
    try {
      buf = Buffer.from(base64, 'base64');
    } catch {
      return res.status(400).json({ success: false, error: 'content 不是合法的 base64 编码' });
    }
    if (buf.length === 0) {
      return res.status(400).json({ success: false, error: '文件内容为空，请确认上传内容' });
    }

    const tmpPath = path.join(os.tmpdir(), `doc-import-${Date.now()}-${path.basename(fileName)}`);

    try {
      fs.writeFileSync(tmpPath, buf);
      const result = await documentParserService.parse(tmpPath);

      if (!result.success) {
        return res.json({
          success: false,
          data: { metadata: result.metadata },
          error: result.error
        });
      }

      let addedToRag = false;
      let ragNote: string | undefined;
      if (addToRag) {
        try {
          const ragSystem = getSharedAgent().getRAGSystem();
          await ragSystem.addDocument({
            id: `upload_${Date.now()}`,
            title: title || fileName,
            content: result.content,
            source: 'user-upload',
            metadata: { fileName, userId: req.user?.id },
            createdAt: new Date(),
            updatedAt: new Date()
          });
          addedToRag = true;
        } catch (e) {
          ragNote = e instanceof Error ? e.message : String(e);
        }
      }

      return res.json({
        success: true,
        data: {
          metadata: result.metadata,
          content: result.content,
          addedToRag,
          ragNote: addedToRag ? undefined : ragNote
        }
      });
    } finally {
      fs.unlink(tmpPath, () => undefined);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '文档导入失败'
    });
  }
});

/**
 * 生成 / 导出文档：把文本（如 agent 的回答）导出成多种格式并作为文件下载。
 * 零依赖支持：md / txt / html / json / csv / xml / tex / org / rst / rtf。
 */
router.post('/export', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, format, title } = (req.body || {}) as {
      text?: string;
      format?: string;
      title?: string;
    };

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 text（要导出的文本）' });
    }
    if (!format || typeof format !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 format（导出格式）' });
    }

    let exported;
    try {
      exported = exportDocument(text, format as ExportFormat, { title });
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: e instanceof Error ? e.message : '不支持的导出格式'
      });
    }

    const safeTitle = (title || 'document').replace(/[^\w一-龥-]+/g, '_').slice(0, 60) || 'document';
    const asciiName = `document.${exported.extension}`;
    const utfName = encodeURIComponent(safeTitle);

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${utfName}.${exported.extension}`
    );
    res.send(exported.buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '文档导出失败'
    });
  }
});

/** 列出支持的导出格式（前端渲染下拉菜单用） */
router.get('/export-formats', (_req, res) => {
  res.json({ success: true, data: listSupportedExportFormats() });
});

export default router;
