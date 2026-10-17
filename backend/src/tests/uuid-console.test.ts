/**
 * UUID 生成与校验测试
 *
 * 修复说明：原文件只是一段 console.log 打印脚本（"测试 console.log 是否工作"），
 * 不包含任何断言，既无法验证行为，也会让 jest 误以为存在覆盖率。
 * 现改为真实断言的单元测试。
 */
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('uuid v4 生成', () => {
  it('应生成合法的 v4 UUID', () => {
    const id = uuidv4();
    expect(uuidValidate(id)).toBe(true);
    expect(uuidVersion(id)).toBe(4);
    expect(id).toMatch(UUID_V4_RE);
  });

  it('多次生成应保证唯一性', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv4()));
    expect(ids.size).toBe(1000);
  });

  it('应能识别非法 UUID', () => {
    expect(uuidValidate('not-a-uuid')).toBe(false);
    expect(uuidValidate('')).toBe(false);
  });
});
