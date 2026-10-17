import { describe, it, expect } from '@jest/globals';
import { DocumentProcessor } from '../core/rag/DocumentProcessor';
import { Document } from '../core/rag/types';

function makeDoc(content: string, id = 'doc1'): Document {
  const now = new Date();
  return { id, title: '测试文档', content, createdAt: now, updatedAt: now };
}

describe('分块参数归一化', () => {
  it('重叠 >= 块长时收敛到块长的一半（原实现会在此参数下死循环）', () => {
    const processor = new DocumentProcessor({ chunkSize: 8, chunkOverlap: 8 });
    expect(processor.resolveChunkParams()).toEqual({ chunkSize: 8, chunkOverlap: 4 });
  });

  it('负重叠归零，小数与非法块长被规整', () => {
    expect(new DocumentProcessor({ chunkSize: 100, chunkOverlap: -5 }).resolveChunkParams())
      .toEqual({ chunkSize: 100, chunkOverlap: 0 });
    expect(new DocumentProcessor({ chunkSize: 10.7, chunkOverlap: 3.2 }).resolveChunkParams())
      .toEqual({ chunkSize: 10, chunkOverlap: 3 });
    expect(new DocumentProcessor({ chunkSize: 0, chunkOverlap: 0 }).resolveChunkParams())
      .toEqual({ chunkSize: 1, chunkOverlap: 0 });
  });

  it('默认配置重叠 64 落在 512 块长的允许范围内', () => {
    expect(new DocumentProcessor().resolveChunkParams()).toEqual({ chunkSize: 512, chunkOverlap: 64 });
  });
});

describe('chunkDocument（滑窗分块）', () => {
  it('敌意参数下正常返回，且不产生空块、不超出块长', () => {
    const processor = new DocumentProcessor({ chunkSize: 8, chunkOverlap: 8 });
    const chunks = processor.chunkDocument(makeDoc('x'.repeat(100)));

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(60);
    expect(chunks.every((c) => c.content.trim().length > 0)).toBe(true);
    expect(chunks.every((c) => c.content.length <= 8)).toBe(true);
  });

  it('不产生"只有重叠内容"的尾部碎片块', () => {
    const processor = new DocumentProcessor({ chunkSize: 4, chunkOverlap: 1 });
    const chunks = processor.chunkDocument(makeDoc('abcdefghij'));

    expect(chunks.map((c) => c.content)).toEqual(['abcd', 'defg', 'ghij']);
  });

  it('chunkIndex 连续且 id 与序号一致', () => {
    const processor = new DocumentProcessor({ chunkSize: 4, chunkOverlap: 1 });
    const chunks = processor.chunkDocument(makeDoc('abcdefghij'));

    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
    expect(chunks[2].id).toBe('doc1_chunk_2');
    expect(chunks[2].documentId).toBe('doc1');
  });

  it('空文档与纯空白文档返回空数组', () => {
    const processor = new DocumentProcessor({ chunkSize: 16, chunkOverlap: 4 });
    expect(processor.chunkDocument(makeDoc(''))).toEqual([]);
    expect(processor.chunkDocument(makeDoc('        '))).toEqual([]);
  });
});

describe('chunkDocumentBySentence（句子边界分块）', () => {
  it('保留中文句号，不再被替换成 ASCII 句点', () => {
    const processor = new DocumentProcessor({ chunkSize: 512, chunkOverlap: 64 });
    const chunks = processor.chunkDocumentBySentence(makeDoc('什么是向量检索。它很重要。'));

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('。');
    expect(chunks[0].content.endsWith('.')).toBe(false);
  });

  it('不在小数点处断句（3.14 保持完整）', () => {
    const processor = new DocumentProcessor({ chunkSize: 512, chunkOverlap: 64 });
    const chunks = processor.chunkDocumentBySentence(
      makeDoc('圆周率的近似值是 3.14 左右，常用于计算。')
    );

    expect(chunks.some((c) => c.content.includes('3.14'))).toBe(true);
  });

  it('不在 URL 内部的点号处断句', () => {
    const processor = new DocumentProcessor({ chunkSize: 512, chunkOverlap: 64 });
    const chunks = processor.chunkDocumentBySentence(
      makeDoc('文档地址是 https://example.com/docs 可以查看。')
    );

    expect(chunks.some((c) => c.content.includes('https://example.com/docs'))).toBe(true);
  });

  it('英文句点后正常断句', () => {
    const processor = new DocumentProcessor({ chunkSize: 512, chunkOverlap: 64 });
    const chunks = processor.chunkDocumentBySentence(
      makeDoc('The first sentence is here. The second sentence follows. ')
    );

    expect(chunks[0].content).toContain('The first sentence is here.');
    expect(chunks[0].content).toContain('The second sentence follows.');
  });

  it('过短的标题碎片并入后一句，不产出无信息量的块', () => {
    const processor = new DocumentProcessor({ chunkSize: 512, chunkOverlap: 64 });
    const chunks = processor.chunkDocumentBySentence(
      makeDoc('第一章 概述\n本章介绍系统整体设计思路与关键模块的职责划分。')
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('第一章 概述');
    expect(chunks[0].content).toContain('关键模块');
    expect(chunks.every((c) => c.content.length >= 12)).toBe(true);
  });

  it('每个块都不超过 chunkSize', () => {
    const processor = new DocumentProcessor({ chunkSize: 50, chunkOverlap: 10 });
    const content = '甲乙丙丁戊己庚辛壬癸。'.repeat(20);
    const chunks = processor.chunkDocumentBySentence(makeDoc(content));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 50)).toBe(true);
  });

  it('块间重叠生效：下一块以整句形式携带上一块的结尾', () => {
    const processor = new DocumentProcessor({ chunkSize: 30, chunkOverlap: 10 });
    const sentence = '甲乙丙丁戊己庚辛。';
    const chunks = processor.chunkDocumentBySentence(makeDoc(sentence.repeat(8)));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.endsWith(sentence)).toBe(true);
    expect(chunks[1].content.startsWith(sentence)).toBe(true);
  });

  it('无标点的超长文本被硬切成不超过块长的块', () => {
    const processor = new DocumentProcessor({ chunkSize: 20, chunkOverlap: 0 });
    const chunks = processor.chunkDocumentBySentence(makeDoc('a'.repeat(95)));

    expect(chunks.length).toBe(5);
    expect(chunks.every((c) => c.content.length <= 20)).toBe(true);
    expect(chunks.map((c) => c.content).join('')).toBe('a'.repeat(95));
  });

  it('末尾不会多出一个只含重叠内容的碎片块', () => {
    const processor = new DocumentProcessor({ chunkSize: 26, chunkOverlap: 12 });
    // 每句 13 字（高于短碎片合并阈值 12，也长于重叠 12），因此无法被当作重叠内容携带
    const sentences = Array.from({ length: 5 }, (_, i) => `第${i + 1}句甲乙丙丁戊己庚辛壬。`);
    const chunks = processor.chunkDocumentBySentence(makeDoc(sentences.join('')));

    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.content)).toEqual([
      sentences[0] + sentences[1],
      sentences[2] + sentences[3],
      sentences[4]
    ]);
    // 块内容互不相同：不存在"上一块的副本"这类纯重叠尾块
    expect(new Set(chunks.map((c) => c.content)).size).toBe(3);
  });

  it('空文档返回空数组', () => {
    expect(new DocumentProcessor({ chunkSize: 32, chunkOverlap: 8 }).chunkDocumentBySentence(makeDoc('')))
      .toEqual([]);
  });
});
