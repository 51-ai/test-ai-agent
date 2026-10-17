import { Document, DocumentChunk, RAGConfig, defaultRAGConfig } from './types';

export interface ResolvedChunkParams {
  chunkSize: number;
  chunkOverlap: number;
}

export class DocumentProcessor {
  private config: RAGConfig;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...defaultRAGConfig, ...config };
  }

  /**
   * 归一化分块参数。
   * - chunkSize 至少为 1；
   * - chunkOverlap 收敛到 [0, chunkSize/2]：重叠 >= 块长会让滑窗下标不前进（原实现在该参数下死循环），
   *   重叠超过块长一半时块内新增内容少于重叠内容，检索收益为负。
   */
  resolveChunkParams(): ResolvedChunkParams {
    const chunkSize = Math.max(1, Math.floor(this.config.chunkSize));
    const rawOverlap = Number.isFinite(this.config.chunkOverlap)
      ? Math.floor(this.config.chunkOverlap)
      : 0;
    return {
      chunkSize,
      chunkOverlap: Math.max(0, Math.min(rawOverlap, Math.floor(chunkSize / 2)))
    };
  }

  chunkDocument(document: Document): DocumentChunk[] {
    const { chunkSize, chunkOverlap } = this.resolveChunkParams();
    const content = document.content;
    const chunks: DocumentChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const piece = content.slice(start, end);

      // 跳过纯空白片段，避免污染索引
      if (piece.trim().length > 0) {
        chunks.push({
          id: `${document.id}_chunk_${chunkIndex}`,
          documentId: document.id,
          content: piece,
          chunkIndex,
          metadata: document.metadata
        });
        chunkIndex++;
      }

      if (end >= content.length) break;

      const next = end - chunkOverlap;
      // 下标必须严格前进：即使分块参数异常，也不会绕回死循环
      start = next > start ? next : end;
    }

    return chunks;
  }

  /**
   * 按句子边界分块，块间可重叠。
   *
   * 与旧实现的差别：
   *   1. 不再把中文句号替换成 ASCII 句点，也不会在小数点/域名处断句（3.14、example.com 保持完整）；
   *   2. 过短碎片（标题行、断行残留）并入后一句，不再产出只有几个字的块；
   *   3. 真正实现 chunkOverlap（旧实现完全忽略该配置），且不会产出"只有重叠内容"的尾块。
   */
  chunkDocumentBySentence(document: Document): DocumentChunk[] {
    const { chunkSize, chunkOverlap } = this.resolveChunkParams();
    const sentences = this.splitSentences(document.content);
    const chunks: DocumentChunk[] = [];

    let buffer: string[] = [];
    let bufferLength = 0;
    let hasNewContent = false;
    let chunkIndex = 0;

    const flush = () => {
      const content = buffer.join('').trim();
      if (content.length === 0 || !hasNewContent) return;

      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content,
        chunkIndex,
        metadata: document.metadata
      });
      chunkIndex++;

      // 携带块尾若干"整句"作为下一块的重叠上下文，总长不超过 chunkOverlap
      const carried: string[] = [];
      let carriedLength = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        const sentence = buffer[i];
        if (carriedLength + sentence.length > chunkOverlap) break;
        carried.unshift(sentence);
        carriedLength += sentence.length;
      }
      buffer = carried;
      bufferLength = carriedLength;
      hasNewContent = false;
    };

    for (const sentence of sentences) {
      if (bufferLength + sentence.length > chunkSize && bufferLength > 0) flush();

      if (sentence.length > chunkSize) {
        // 无标点的超长文本（代码、表格、连续数字）：按块长硬切
        let rest = sentence;
        while (rest.length > 0) {
          if (bufferLength >= chunkSize) flush();
          const room = chunkSize - bufferLength;
          const taken = rest.slice(0, room);
          buffer.push(taken);
          bufferLength += taken.length;
          hasNewContent = true;
          rest = rest.slice(taken.length);
        }
        continue;
      }

      buffer.push(sentence);
      bufferLength += sentence.length;
      hasNewContent = true;
    }

    flush();
    return chunks;
  }

  /** 按句末标点切句，保留原标点；不在小数点和域名/文件名内部断开 */
  private splitSentences(text: string): string[] {
    const raw: string[] = [];
    let buffer = '';

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (ch === '\n') {
        if (buffer.trim().length > 0) raw.push(buffer);
        buffer = '';
        continue;
      }

      buffer += ch;

      if ('。！？；!?;'.includes(ch)) {
        raw.push(buffer);
        buffer = '';
        continue;
      }

      if (ch === '.') {
        const prev = text[i - 1] ?? '';
        const next = text[i + 1] ?? '';
        const insideToken = /[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next);
        if (!insideToken) {
          raw.push(buffer);
          buffer = '';
        }
      }
    }

    if (buffer.trim().length > 0) raw.push(buffer);

    return this.mergeShortFragments(raw.filter((s) => s.trim().length > 0));
  }

  /** 过短碎片并入后一句，避免"标题 6 个字"单独成块、检索时命中却无内容 */
  private mergeShortFragments(sentences: string[], minLength = 12): string[] {
    const merged: string[] = [];
    for (const sentence of sentences) {
      const prevIndex = merged.length - 1;
      if (prevIndex >= 0 && merged[prevIndex].trim().length < minLength) {
        merged[prevIndex] = merged[prevIndex] + sentence;
      } else {
        merged.push(sentence);
      }
    }
    return merged;
  }

  cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();
  }

  preprocessDocument(document: Document): Document {
    return {
      ...document,
      content: this.cleanText(document.content)
    };
  }
}
