// uuid@14 是纯 ESM 包，Jest(CommonJS) 无法解析。
// 用 Node 内置 crypto.randomUUID 提供 v4，并提供与 uuid 包行为一致的
// validate / version 实现，使断言保持真实（而非打印脚本）。
const { randomUUID } = require('crypto');

// 与 uuid 包一致的格式校验（覆盖 v1~v5）
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validate(str) {
  return typeof str === 'string' && UUID_RE.test(str);
}

function version(str) {
  if (!validate(str)) {
    throw new TypeError('Invalid UUID');
  }
  // 第三段首字符即版本号（如 4xxx -> 4）
  return parseInt(str.split('-')[2][0], 16);
}

const v4 = () => randomUUID();

module.exports = {
  v4,
  validate,
  version,
  default: { v4 },
};
