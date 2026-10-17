/**
 * 真实向量化（Embedding）提供层
 *
 * 背景：原 VectorStore.generateEmbedding() 用「字符 hash + Math.sin」伪造 128 维向量，
 * 任意两段文本的余弦相似度恒在 0.65 附近，语义检索等同于随机排序，阈值过滤形同虚设。
 * 本模块以真实向量模型替换之，支持两种后端：
 *   - api  ：OpenAI 兼容 /embeddings 接口（默认，复用项目已有的 OPENAI_API_KEY 或 EMBEDDING_API_KEY）
 *   - local：本地神经网络模型（@huggingface/transformers，可选依赖，无需密钥、可离线）
 * 两种后端都产出真实语义向量，且带进程内 LRU 缓存以避免重复调用。
 */

export interface EmbeddingProvider {
  /** 后端名称，用于健康检查与日志 */
  readonly name: string;
  /** 向量维度（模型未固定维度时为 null） */
  readonly dimension: number | null;
  /** 批量文本 → 向量（与输入等长） */
  embed(texts: string[]): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_CONFIGURED' | 'NETWORK' | 'AUTH' | 'API' | 'DEPENDENCY_MISSING'
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

const DEFAULT_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_API_MODEL = 'text-embedding-3-small';
const DEFAULT_LOCAL_MODEL = 'Xenova/bge-small-zh-v1.5';

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? '').trim() || fallback;
}

/** OpenAI 兼容 /embeddings 后端 */
export class ApiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'api';
  readonly dimension: number | null = null;

  constructor(
    private readonly apiBase: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly batchSize: number
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new EmbeddingError('未配置 EMBEDDING_API_KEY / OPENAI_API_KEY，无法调用向量化服务', 'NOT_CONFIGURED');
    }
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const data = await this.request(batch);
      for (const item of data) out.push(item);
    }
    return out;
  }

  private async request(batch: string[]): Promise<number[][]> {
    let res: Response;
    try {
      res = await fetch(`${this.apiBase}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: batch }),
      });
    } catch (e) {
      throw new EmbeddingError(`向量化服务网络请求失败：${(e as Error).message}`, 'NETWORK');
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new EmbeddingError(
        `向量化服务返回错误（HTTP ${res.status}）：${detail}`,
        res.status === 401 ? 'AUTH' : 'API'
      );
    }
    const json = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
    if (!Array.isArray(json?.data) || json.data.length !== batch.length) {
      throw new EmbeddingError('向量化服务返回数据格式异常', 'API');
    }
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/** 本地神经网络模型后端（可选依赖，未安装时给出明确安装提示） */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly dimension: number | null = null;

  private pipelinePromise: Promise<CallableFunction> | null = null;

  constructor(
    private readonly model: string,
    private readonly cacheDir: string
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const extractor = await this.getPipeline();
    const out: number[][] = [];
    for (const text of texts) {
      const output = (await extractor(text, { pooling: 'cls', normalize: true })) as {
        data: Float32Array | number[];
      };
      out.push(Array.from(output.data));
    }
    return out;
  }

  private async getPipeline(): Promise<CallableFunction> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        let mod: { env: Record<string, unknown>; pipeline: (...args: unknown[]) => Promise<CallableFunction> };
        try {
          // 可选依赖：TypeScript 以 CommonJS 输出时 await import() 会被降级为 require()，
          // 这里用 Function 逃逸以保证能加载纯 ESM 包
          const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<typeof mod>;
          mod = await dynamicImport('@huggingface/transformers');
        } catch {
          throw new EmbeddingError(
            '未安装本地向量模型依赖，请执行：npm install @huggingface/transformers（或改用 EMBEDDING_PROVIDER=api）',
            'DEPENDENCY_MISSING'
          );
        }
        const endpoint = env('HF_ENDPOINT');
        if (endpoint) mod.env.remoteHost = endpoint.replace(/\/+$/, '');
        mod.env.cacheDir = this.cacheDir;
        mod.env.localModelPath = this.cacheDir;
        mod.env.allowLocalModels = true;
        return mod.pipeline('feature-extraction', this.model, { quantized: true });
      })().catch((e: Error) => {
        this.pipelinePromise = null; // 允许后续重试
        throw e;
      });
    }
    return this.pipelinePromise;
  }
}

/** 进程内 LRU 缓存包装，避免对同一文本重复调用 */
export class CachedEmbeddingProvider implements EmbeddingProvider {
  private cache = new Map<string, number[]>();

  constructor(private readonly delegate: EmbeddingProvider, private readonly maxEntries = 2000) {}

  get name(): string {
    return this.delegate.name;
  }

  get dimension(): number | null {
    return this.delegate.dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: (number[] | null)[] = texts.map((t) => this.cache.get(t) ?? null);
    const missing = texts.filter((_, i) => results[i] === null);

    if (missing.length) {
      const vectors = await this.delegate.embed(missing);
      let cursor = 0;
      for (let i = 0; i < texts.length; i++) {
        if (results[i] === null) {
          const vector = vectors[cursor++];
          results[i] = vector;
          this.put(texts[i], vector);
        }
      }
    }
    return results as number[][];
  }

  private put(text: string, vector: number[]): void {
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(text, vector);
  }
}

/**
 * 按环境变量创建向量化后端：
 *   EMBEDDING_PROVIDER=local|api（默认：有密钥走 api，否则 local）
 */
export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = env('EMBEDDING_PROVIDER').toLowerCase();
  const apiKey = env('EMBEDDING_API_KEY') || env('OPENAI_API_KEY');
  const apiBase = env('EMBEDDING_API_BASE', DEFAULT_API_BASE).replace(/\/+$/, '');
  const apiModel = env('EMBEDDING_MODEL', DEFAULT_API_MODEL);
  const localModel = env('EMBEDDING_MODEL_LOCAL', DEFAULT_LOCAL_MODEL);
  const cacheDir = env('EMBEDDING_CACHE_DIR', './data/models');
  const batchSize = Number(env('EMBEDDING_BATCH_SIZE', '16')) || 16;

  const useApi = provider === 'api' || (provider !== 'local' && Boolean(apiKey));

  const base: EmbeddingProvider = useApi
    ? new ApiEmbeddingProvider(apiBase, apiKey, apiModel, batchSize)
    : new LocalEmbeddingProvider(localModel, cacheDir);

  return new CachedEmbeddingProvider(base);
}

/** 单例（懒加载，避免未使用时触发模型下载） */
let singleton: EmbeddingProvider | null = null;
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!singleton) singleton = createEmbeddingProvider();
  return singleton;
}

/** 测试用：重置单例 */
export function resetEmbeddingProvider(): void {
  singleton = null;
}

/** 余弦相似度 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
