/**
 * 简单功能测试（console / uuid）
 *
 * 修复说明：原文件是自带 test() 计数 + process.exit(1) 的打印脚本，
 * 没有 jest 的 describe/it/expect —— jest 收集到会报“必须包含至少一个测试”，
 * 且失败时直接 process.exit 杀掉 worker。现改为标准 jest 断言。
 */
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('console 基础方法可用性', () => {
  const methods: (keyof Console)[] = ['log', 'info', 'warn', 'error', 'time', 'timeEnd', 'table'];
  it.each(methods)('console.%s 应为函数', (m) => {
    expect(typeof (console as unknown as Record<string, unknown>)[m]).toBe('function');
  });
});

describe('uuid v4 生成', () => {
  it('应生成合法的 v4 UUID', () => {
    const id = uuidv4();
    expect(uuidValidate(id)).toBe(true);
    expect(uuidVersion(id)).toBe(4);
    expect(id).toMatch(UUID_V4_RE);
  });

  it('多次生成应保证唯一性', () => {
    const ids = new Set(Array.from({ length: 3 }, () => uuidv4()));
    expect(ids.size).toBe(3);
  });

  it('生成 10000 个 UUID 应在 1s 内完成', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) uuidv4();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
