/**
 * RAG 向量检索真实性验证脚本（带真实断言，非打印式脚本）
 *
 * 运行：npx ts-node scripts/verify-rag-embedding.ts
 *
 * 断言：
 *  1. 语义相同的两个问法，相似度显著高于无关文本（区分度 > 0.2）；
 *  2. 相似度不再恒定在旧伪实现的 ~0.65 附近（标准差需 > 0.05）；
 *  3. 检索能命中语义相关片段，且相似度高于配置阈值；
 *  4. 索引可落盘并恢复。
 *
 * 依赖真实向量后端：
 *   - EMBEDDING_PROVIDER=api   （默认，需要 EMBEDDING_API_KEY 或 OPENAI_API_KEY）
 *   - EMBEDDING_PROVIDER=local （需要安装 @huggingface/transformers）
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { VectorStore } from '../src/core/rag/VectorStore';
import { getEmbeddingProvider } from '../src/core/rag/embedding/EmbeddingProvider';
import { cosineSimilarity } from '../src/core/rag/embedding/EmbeddingProvider';
import type { Document } from '../src/core/rag/types';

let failed = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

async function main(): Promise<void> {
  const provider = getEmbeddingProvider();
  console.log(`向量后端: ${provider.name}\n`);

  // 1) 语义区分度
  console.log('[1] 语义区分度');
  const pairs: [string, string, string][] = [
    ['语义相同', '年假申请需要提前几天', '休年假的提前时间是多久'],
    ['语义相同', '如何重置密码', '忘记密码的处理办法'],
    ['完全无关', '年假申请需要提前几天', '红烧肉怎么做才好吃'],
  ];
  const texts = pairs.flatMap(([, a, b]) => [a, b]);
  const vectors = await provider.embed(texts);
  const scores = pairs.map(([name, a, b], i) => ({
    name,
    score: cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]),
  }));
  for (const s of scores) console.log(`   ${s.name}: ${s.score.toFixed(3)}`);

  const similar = scores.filter((s) => s.name === '语义相同').map((s) => s.score);
  const unrelated = scores.find((s) => s.name === '完全无关')!.score;
  const gap = Math.min(...similar) - unrelated;
  assert(gap > 0.2, `语义相同与无关的区分度应 > 0.2（实测 ${gap.toFixed(3)}）`);

  const all = scores.map((s) => s.score);
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  const std = Math.sqrt(all.reduce((sum, v) => sum + (v - mean) ** 2, 0) / all.length);
  assert(std > 0.05, `相似度不应恒定（旧伪实现恒为 ~0.65），标准差应 > 0.05（实测 ${std.toFixed(3)}）`);

  // 2) 检索命中
  console.log('\n[2] 检索命中');
  const store = new VectorStore({ minRelevanceScore: 0.3, topK: 3 });
  const doc: Document = {
    id: 'doc_test_1',
    title: '员工假期管理制度',
    content:
      '员工累计工作满 1 年不满 10 年的，每年可享受年休假 5 天。年假申请流程：员工需提前 3 个工作日在 OA 系统提交年假申请，经直属主管审批、部门负责人复核后方可休假。病假需提供二级及以上公立医院的诊断证明。',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const chunks = [
    { id: 'doc_test_1_chunk_0', documentId: doc.id, content: '员工累计工作满 1 年不满 10 年的，每年可享受年休假 5 天。', chunkIndex: 0 },
    { id: 'doc_test_1_chunk_1', documentId: doc.id, content: '年假申请流程：需提前 3 个工作日在 OA 系统提交申请并经主管审批。', chunkIndex: 1 },
    { id: 'doc_test_1_chunk_2', documentId: doc.id, content: '病假需提供二级及以上公立医院的诊断证明，工资按最低标准 80% 发放。', chunkIndex: 2 },
  ];
  await store.addDocument(doc, chunks);

  const hits = await store.search('休年假要提前多久申请');
  assert(hits.length > 0, `语义检索应命中相关片段（实测 ${hits.length} 条）`);
  if (hits.length) {
    console.log(`   最高分片段: "${hits[0].chunk.content.slice(0, 30)}…" (${hits[0].score.toFixed(3)})`);
    assert(hits[0].score >= 0.3, `命中片段相似度应高于阈值 0.3（实测 ${hits[0].score.toFixed(3)}）`);
  }

  const empty = await store.search('量子计算机的退相干时间如何測量');
  console.log(`   无关查询命中数: ${empty.length}`);
  assert(empty.length === 0 || (empty[0]?.score ?? 0) < hits[0]?.score, '无关查询的相似度应低于相关查询');

  // 3) 索引持久化
  console.log('\n[3] 索引持久化');
  const indexFile = path.resolve(__dirname, '../data/rag-index-test.json');
  await store.saveIndex(indexFile);
  assert(fs.existsSync(indexFile), '索引文件应写入成功');

  const restored = new VectorStore({ minRelevanceScore: 0.3, topK: 3 }, getEmbeddingProvider(), indexFile);
  const loaded = await restored.loadIndex();
  assert(loaded, '应能从磁盘恢复索引');
  assert(restored.getAllChunks().length === chunks.length, `恢复后片段数应一致（${restored.getAllChunks().length}/${chunks.length}）`);
  await fs.promises.unlink(indexFile).catch(() => undefined);

  console.log(failed === 0 ? '\n全部断言通过 ✅' : `\n${failed} 项断言失败 ❌`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\n验证失败:', e.message);
  console.error('提示：设置 EMBEDDING_API_KEY（或 OPENAI_API_KEY）后重试；或安装 @huggingface/transformers 并设置 EMBEDDING_PROVIDER=local');
  process.exit(1);
});
