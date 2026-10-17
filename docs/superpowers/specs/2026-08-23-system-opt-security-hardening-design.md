# 系统优化 + 安全加固设计 Spec（2026-08-23）

> **迭代 ID**：OPT-HARDEN-2026Q3
> **落地方案**：方案二「一次性全量重度」= 体验 6 项全做 + 重度安全 4 件事（bcrypt rounds + TOTP MFA + LLM I/O Guard + npm audit fix）
> **范围**：backend (Express+Mongoose+JWT) + frontend (React+Vite+axios)，**不引入新架构边界**（现有模块全部复用）

***

## 0. 背景 & 目标

### 0.1 背景（来自两份"总结"）

1. **体验总结（对话摘要）**：上一轮迭代已完成 ① Ollama 诊断/一键清理脚本 ② check-services 标签修复 ③ PowerShell 启动脚本 ④ 后端全数据管理（用户/对话/记忆/任务/工具/审计）⑤ AdminDashboard 铁路大屏风格（AI 真实数据）⑥ AISecurityAnalyst 页面（Tab+进度条+风险表+DeepSeek API 集成）。但运行中暴露 6 个体验缺口（登录填不上、AI 报告不持久、错误提示英文、大屏无联动、表单按钮误提交、前端分数与 AI 结论不同步）。
2. **安全总结（AI 诊断真实报告，综合风险中危=42.0）**：TOP3 整改建议 = 「① 7 天内强制 MFA+服务账号治理（7.2 分最大缺口） ② 30 天内 Prompt 日志加密脱敏（8.5 分第二缺口） ③ 季度红队对抗+输出校验网关」，立即行动 = 立即全量 npm audit + 权限审计。

### 0.2 目标（定量可验证）

* **体验侧**：6 个缺口 100% 按「验收标准」逐项通过。

* **安全侧**：AI TOP3 中前两项代码层面 80% 落地（MFA 真接、脱敏真生效）；第 3 项做输出校验网关中间件替代红队；npm audit high 级别漏洞 0 个。

* **兼容性**：所有存量数据 0 迁移成本（老账号 rounds=10 自动平滑升 rounds=12，未启用 MFA 的老用户登录流程零变化，User 模型字段全部可选向后兼容）。

* **可回滚**：5 个 `.env` 开关 = 秒级撤回任一项，不用改任何代码。

***

## 1. 架构总览（边界与依赖不变）

```
┌──────────────────────────────────────────────────────────────────┐
│                       Frontend (Vite/React)                       │
│  ┌───────────┐ ┌──────────────────┐ ┌───────────────────────────┐ │
│  │ Login.tsx │ │ AdminDashboard   │ │ AISecurityAnalyst         │ │
│  │ · type=email→text│ │ · 安全联动卡│ │ · Tab3 诊断历史新增     │ │
│  │ · 默认type=button│ │ · 综合风险徽章│ │ · 分数与AI结论同步徽章 │ │
│  │ · 快速管理员登录 │ │              │ │ · Axios错误中文映射     │ │
│  └───────────┘ └──────────────────┘ └───────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ axios（超时/错误分层中间件）
┌────────────────────────────────▼─────────────────────────────────┐
│                   Backend (Express + Mongoose)                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Middleware Layer（新增两个）                                 │ │
│  │  · InputGuard  : sk-* 泄漏 / 超长prompt / 越权模板拦截 403  │ │
│  │  · OutputGuard : 敏感词脱敏 + 恶意指令复核标记              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌────────────┐  ┌────────────────┐  ┌─────────────────────────┐ │
│  │ auth.ts    │  │ admin.ts       │  │ /api/security/reports   │ │
│  │ · MFA流程改造│  │ /security/analyze│  │  save / list / get by id│ │
│  │ · /mfa/* 4路由│ │ /security/analyze│ │                         │ │
│  └────────────┘  └────────────────┘  └─────────────────────────┘ │
│  ┌────────────┐  ┌─────────────────────────────────────────────┐ │
│  │ User Model │  │ 新增字段: totpSecret / totpEnabled /         │ │
│  │ · rounds=12│  │  totpBackupCodes(bcrypt) → 全部可选兼容     │ │
│  │ · 自动平滑迁移│  │                                             │ │
│  └────────────┘  └─────────────────────────────────────────────┘ │
│  ┌───────────────┐  ┌──────────────────────────────────────────┐ │
│  │ SecurityReport│  │ npm audit fix (back+front) + /api/dev/   │ │
│  │ Model 新增    │  │   npm-audit 监控入口                     │ │
│  └───────────────┘  └──────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ · 5 个 .env 开关 = 秒级回滚（不碰代码）                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**依赖新增**（仅 1 个：`otpauth`，行业标准无漏洞历史，<10KB）

| 依赖        | 版本建议    | 用途                                      | 风险                |
| --------- | ------- | --------------------------------------- | ----------------- |
| `otpauth` | \~9.1.5 | TOTP/HOTP 标准实现（Google Authenticator 兼容） | 极低；单文件，无传递依赖      |
| *bcrypt*  | 沿用现有版本  | rounds 10→12 不改版本                       | 零（只是 config 数值调整） |

***

## 2. 体验 6 项 · 详细设计

### 2.1 ① 登录修复（type=email 填不上 + 快速管理员登录 + 按钮默认 type）

* **改动文件**：

  * `frontend/src/components/Login.tsx`

* **详细改动**：

  * A. `<input type="email">` → `type="text"`，保留 `pattern=/^\S+@\S+\.\S+$/` + 提交前前端再次跑正则校验；解决 browser-use/IME/Windows 下 type=email 的兼容性问题。

  * B. 所有 `<button>` 写死 `type`：只有 submit 按钮 `type="submit"`；其他所有按钮（如"切换注册/登录""快速登录"等）统一 `type="button"`（避免回车/点击触发浏览器默认表单提交行为，来自 FailureExperience 969046 最佳实践）。

  * C. 页面底部加「⚡ 管理员快速登录」按钮 → 点击弹出模态，显示检测到的 admin 账号列表（实际走 dev impersonate 流程：`POST /api/dev/users/login-as`，已在 developer 路由实现）；选中账号 1 秒进控制台，无需手填密码。

* **回滚**：前端 `.env VITE_QUICK_LOGIN=0` 隐藏快速登录面板；email input 改回 type=email。

### 2.2 ② AI 报告持久化（新增 Tab 3「📜 诊断历史」）

* **后端新增**：

  * Model：`backend/src/models/SecurityReport.ts`

    ```ts
    {
      userId: ObjectId → User,          // 谁生成的
      model: string,                    // 'deepseek-v4-flash' etc.
      provider: 'deepseek'|'ollama',    // 提供者
      prompt: string,                   // 系统提示（脱敏后）
      customPrompt?: string,            // 自定义追加（脱敏后）
      content: string,                  // Markdown 原文（保存不丢失）
      usage?: { promptTokens:number, completionTokens:number, totalTokens:number },
      elapsedMs: number,
      riskLevel?: 'high'|'mid'|'low'|'excellent',  // 从报告中抽取
      generatedAt: Date,                // 生成时间（desc 排序）
    }
    ```

  * Service：`backend/src/services/SecurityReportService.ts`（CRUD + 分页 list）

  * API（挂在 `/api/admin/security/` 下，走 adminOnly 保护）：

    * `POST /reports` → save 一条

    * `GET /reports?page=1&size=20` → 按 generatedAt desc 分页

    * `GET /reports/:id` → 单条详情

  * 触发点：`POST /security/analyze` 成功后自动保存 → 返回 payload 里加 `reportId` 给前端

* **前端**：`AISecurityAnalyst.tsx`

  * Tab 3 新增：「📜 诊断历史」

  * 列表列（6 列）：生成时间 / 模型 / Tokens（prompt+completion） / 耗时 / 综合风险徽章 / 操作（查看 = 复用现有弹窗渲染 Markdown / 下载 MD = 内容 Blob 下载）

  * 成功生成后 → 自动刷新 Tab3 列表 + 弹「查看新报告」

* **回滚**：前端 `.env VITE_SECURITY_HISTORY=0` 隐藏 Tab3；后端路由不注册（admin.ts 里用条件挂）

### 2.3 ③ Axios 错误分层 + AI 诊断错误中文友好化

* **改动文件**：

  * `frontend/src/services/api.ts`（axios 实例 response error interceptor 改造）

  * `frontend/src/components/AISecurityAnalyst.tsx`（aiErr 展示逻辑）

* **分层规则**（按匹配优先级）：

  | 条件                                   | 前端用户提示                                      | 附加动作                        |
  | ------------------------------------ | ------------------------------------------- | --------------------------- |
  | status=401                           | `登录已过期，请重新登录`                               | 清 token → 跳 `/login`（已做，保留） |
  | `code==='ECONNABORTED'` 超时           | `请求超时（AI 推理可能过长，建议换 deepseek-v4-flash 或重试）` | log 原 stack                 |
  | message==='Network Error' 无 response | `后端不可达，请检查后端 3000 端口是否启动`                   | log 原 message               |
  | status=502 / 504                     | `DeepSeek 网关错误（502），请稍后重试或换模型`              | 建议模型切换按钮                    |
  | status=429                           | `调用频次超限（429），请 30 秒后重试`                     | count 倒计时                   |
  | 其它业务错误（有 response.data.error）        | 原 error + `【错误码 ${status}】`                 | log 原 error stack           |

* AISecurityAnalyst 里 `setAiErr(e...)` 全部调用 `humanizeAxiosError(e)` 统一映射，不再是原始英文。

### 2.4 ④ AdminDashboard ↔ AISecurityAnalyst 联动（用户当前打开的文件！）

* **改动文件**：`frontend/src/components/AdminDashboard.tsx`

* **改动细节**：

  * 第 3 行（KPI 卡行）末尾加一张新卡 `AI安全评估`：

    * 显示 = 最近一次 SecurityReport 的 **综合风险徽章**（红/橙/黄/绿） + **生成时间** + 前端合成的综合分数

    * 如果 0 条报告 → 显示「未评估」灰色徽章 + CTA 按钮 `立即生成 →`

  * 交互 = 点击卡直接 `navigate('/admin/security')`，并通过路由 state 传 `{ openAnalyze: true }`，让 AISecurityAnalyst 进入时自动弹出「AI 诊断」弹窗（减少 2 次点击）

* **数据接入**：adminAPI 新增 `getLatestSecurityReport()` → 挂在 useEffect 里和 dashboard 数据一起拉，loading 骨架位保留。

### 2.5 ⑤ 全局按钮默认 type='button'

* **扫描范围**（5 个文件）：`Login.tsx / Register.tsx / AdminDashboard.tsx / AISecurityAnalyst.tsx / UserProfile.tsx`

* **动作**：所有 `<button>` 只要不是提交按钮，补 `type="button"`；如果是 `<Button>` 组件，传 `type="button"` prop（组件里默认 type 必须也是 button，FailureExperience 969046 明确要求，避免表单误提交造成的重复提交/页面刷新）。

* **验证**：grep 正则 `/<button(?!.*type=)/gm` = 0 匹配。

### 2.6 ⑥ 合成分数 ↔ AI 结论双向同步

* **前端改动**：`AISecurityAnalyst.tsx`

  * 新增 extractor：`function extractRiskFromMarkdown(md: string): { level, scores?: { auth, data, model, ops } }`

    * 正则 1：`综合风险评分[:：]\s*(\d+)` / `总体安全状况[:：]\s*(高危|中危|低危|优秀)` → 映射 `高危=high, 中危=mid, 低危=low, 优秀=excellent`

    * 正则 2：提取四维得分（身份安全=auth / 数据安全=data / 模型安全=model / 运维安全=ops）

  * 成功返回后 → 在页面顶部「综合安全指数」卡同时展示 `前端合成 xx.x` 和 `AI评估：<徽章>`；AI 值优先于纯前端合成（AI 值更权威）。

  * 抽到的 riskLevel 自动带参传入 `POST /security/reports` 保存 → Tab3 直接取字段显示彩色徽章。

***

## 3. 重度安全 4 件事 · 详细设计

### 3.1 ① bcrypt rounds 10 → 12（暴力破解代价翻 4 倍）

* **改动文件**：

  * `backend/.env` + `backend/.env.example`：新增 `BCRYPT_ROUNDS=12`

  * `backend/src/config/index.ts`：读 `process.env.BCRYPT_ROUNDS || 10`（默认回退 10 防出错）

  * `backend/src/models/User.ts`：

    * pre('save') 改 password 哈希时用 `config.bcryptRounds`

    * **关键：comparePassword 自动平滑迁移**：

      ```
      comparePassword(candidate) →
        step1: bcrypt.compare(candidate, this.passwordHash)  // 老 rounds=10 也能比
        step2: success AND hash.startsWith('$2b$10$') → this.passwordHash = bcrypt.hash(candidate, rounds=12) → this.save() → 下次登录已是 rounds=12
      ```

* **风险**：登录第一次比之前慢约 200ms（因为重新哈希保存），但只发生一次；回滚 `.env BCRYPT_ROUNDS=10` → 老用户 hash 不用改，新 hash 还是 rounds=10。

### 3.2 ② TOTP MFA 接入（AI TOP3 第一项：7 天内强制 MFA+服务账号治理）

* **依赖新增**：`otpauth@^9.1.5`

* **User 模型新增字段（全部 required:false → 向后兼容）**：

  ```
  totpSecret?: string          // 加密后存；未启用 = undefined
  totpEnabled?: boolean        // 是否启用，默认 false
  totpBackupCodes?: string[]   // 6 个 bcrypt 过的 8 位备份码
  totpUsedBackupCodes?: number // Bitmask，已用的码位（避免重复使用）
  ```

* **后端 auth 流程改造**：

  * 新路由 5 个，全部挂在 `/api/auth/mfa`，必须已登录（authMiddleware）：

    * `POST /setup` → 生成 32 位 base32 secret → 返回：`{ secretBase32, otpauthUrl, qrCodeSvg, backupCodesPlaintext8x6[] }`

      * 注意：backupCodesPlaintext 只在这次响应里返回一次明文，后端只存 bcrypt 版本

    * `POST /verify-setup` → body `{ sixDigitCode: string }`，校验成功 → `totpEnabled=true` + save secret + save backup codes bcrypt

    * `POST /login` → body `{ mfaNonce: string, code: string|backupCode:string }` → 两种方式任选其一；成功后签发真实 JWT；backupCode 用一次即位标记失效

    * `POST /disable` → body `{ password: string }` 校验成功 → `totpEnabled=false`

    * `POST /regen-backups` → 重新生成 6 个备份码（旧的全失效）

  * 改造登录核心流程：

    * `POST /api/auth/login`（email+password 正确）后：

      * 如果 `process.env.MFA_DISABLED==='true'` → 忽略所有 MFA 逻辑，直接发 JWT（**回滚开关①**）

      * 否则 if (user.totpEnabled) → **不发 JWT**，返回 `{ mfaRequired: true, mfaNonce: <JWT 30s TTL with only userId claim> }`；前端跳 MFA 6 位输入页

      * else → 直接发 JWT（老用户零变化）

* **前端改动**：

  * Login 组件新增条件渲染分支：`if (response.mfaRequired)` → 显示「🔐 请输入 6 位验证器密码」输入框（6 位自动跳下一格，支持复制粘贴 6 位全填）

  * Profile 页新增「🔐 MFA 两步验证」Tab：展示 QR 码 → 扫码 → 输 code 验证 → 保存；支持「禁用 MFA（需密码）」「重新生成备份码」

  * 管理员紧急兜底：`POST /api/dev/users/reset-mfa` body `{ userId: string }` → admin 权限可强制关闭任何用户的 MFA

* **回滚**：`.env MFA_DISABLED=true` 重启 → 所有用户直接用 email+password 登录，不需要 6 位码，老用户零变化。

### 3.3 ③ LLM 输入输出校验中间件（AI TOP3 第二项+第三项的代码落地：Prompt 脱敏+输出网关）

* **新增 2 个中间件**（挂在 `/api/agent` 和 `/api/admin/security/analyze` 入口，作为外层装饰层，不碰 LLMService 内部）：

  * **InputGuard（请求进入 LLM 前）**：

    * 检查点 A：`/sk-[A-Za-z0-9]{16,}/` 正则命中（API Key 泄漏） → **403 拒绝** + audit warning "检测到疑似 API Key 泄漏请求，已拦截"

    * 检查点 B：prompt 长度 > 20000 chars（超长注入风险） → 413 + 审计

    * 检查点 C：越权模板关键字（如 "forget previous instructions","ignore the prompt above","dump database","show admin passwords","输出管理员密码"）→ 403 + 审计

  * **OutputGuard（LLM 返回字符串响应前）**：

    * 脱敏 A：`/(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+/gi` → 匹配替换为 `$1=***`

    * 脱敏 B：邮箱 `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g` → 脱敏为 `***@***.com`；手机号脱敏 `138****8888`

    * 恶意指令检测：`/\b(rm -rf|Format-|powershell.*-enc|cmd\s+\/c\s+(del|format))\b/i` → 命中则 audit level=warning + 返回字符串前缀加 `[⚠ AI输出含疑似危险指令，人工复核后执行]`

* **挂载位置**：`backend/src/index.ts` 的路由注册处，条件判断 `if (process.env.I_O_GUARD !== 'off')` 才挂

* **回滚**：`.env I_O_GUARD=off` 重启 → 两个中间件不挂载，LLM 链路完全回到上一轮状态。

### 3.4 ④ npm audit fix + 监控入口（AI 建议"立即启动全量依赖漏洞扫描"）

* **动作**：

  * `cd backend && npm audit fix`（自动修复 high 以上能修的）→ 手工处理剩余 high（查替代包/升级主版本，或注释 TODO 带 CVE 编号说明无法修原因）

  * `cd frontend && npm audit fix`（同上）

  * 修复后 package-lock.json 单独保存（便于撤回：回滚 package-lock + `npm ci`）

* **监控入口**：

  * `GET /api/dev/npm-audit`（admin/dev 权限）→ shell 执行 `npm audit --json` 分别在 frontend/backend 目录 → 返回结构化摘要：`{ vulnerabilities: { info, low, moderate, high, critical }, hotfixesApplied, remainingHighCves:[{id,title,path}] }`

  * AdminDashboard 可加小卡显示（本轮可选，不做也行，先把接口做了）

***

## 4. 回滚策略（5 个开关秒级撤回，不改代码）

| # | 改动项                 | `.env` 撤回方式                                | 影响范围                           | 不改代码          |
| - | ------------------- | ------------------------------------------ | ------------------------------ | ------------- |
| 1 | bcrypt rounds=12    | `BCRYPT_ROUNDS=10`（重启 backend）             | 新密码 rounds 降回 10；老 hash 不变     | ✅             |
| 2 | TOTP MFA            | `MFA_DISABLED=true`（重启 backend）            | 登录直接发 JWT，完全跳 mfa 分支；老用户零影响    | ✅             |
| 3 | LLM I/O Guard 中间件   | `I_O_GUARD=off`（重启 backend）                | 跳过 InputGuard/OutputGuard 全局挂载 | ✅             |
| 4 | 前端 历史 Tab3          | `VITE_SECURITY_HISTORY=0`（重启 frontend dev） | 隐藏 Tab3；后端接口仍存在但不访问            | ✅             |
| 5 | npm audit fix 依赖出问题 | 回滚 `package-lock.json` + `npm ci`          | 精确还原依赖版本                       | ✅（只改 lock 文件） |
| 6 | 快速管理员登录             | `VITE_QUICK_LOGIN=0`（重启 frontend）          | 隐藏按钮                           | ✅             |

* **DB 回滚**：User 模型 totp 字段全部可选，老文档没字段就是 undefined，完全不影响；SecurityReport 集合独立，删不删都不影响主链路。

***

## 5. 验收标准（每项 = 1 个可 verify 的动作，不通过视为 bug）

### 5.1 体验 6 项验收

| # | 验收动作                                                                                 | 预期结果                                                                     |
| - | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1 | 打开 Login 页，邮箱输入框 `getAttribute('type')` → text；填入 sysadmin，点底部「快速管理员登录」选中 sysadmin 卡 | 1 秒内进入 `/admin`（Dashboard 展示数据）；不出现「请填正确邮箱」提示                            |
| 2 | 进安全分析师 → 点「AI 诊断」→ 等待生成成功 → 刷新页面 → 点 Tab3「诊断历史」                                      | 列表出现刚生成的那条（时间/模型/徽章正确）；点「查看」弹窗能看 Markdown；点「下载 MD」文件能正常下载打开可读            |
| 3 | 手动关后端 3000 端口 → 前端登录/拉 dashboard                                                     | 错误提示中文「后端不可达，请检查 3000 端口或服务」；不是"Network Error"                           |
| 4 | 打开 AdminDashboard → 右上角「AI 安全评估」卡 → 未评估时点「立即生成」                                      | 跳 `/admin/security` 且自动弹出 AI 诊断弹窗（state=openAnalyze）；已有报告点「查看」显示 AI 评估徽章 |
| 5 | `cd frontend && grep -rE "<button(?![^>]*type=)" src/components --include="*.tsx"`   | 0 匹配（全部补齐 type）                                                          |
| 6 | 生成 AI 报告成功后，回到顶部卡                                                                    | 同时显示「前端合成 XX.X」和「AI评估：<中危徽章>」，Tab3 列表同一条的徽章和顶部一致                         |

### 5.2 重度安全 4 件事验收

| #  | 验收动作                                                                                              | 预期结果                                                                                           | <br />                     |
| -- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | :------------------------- |
| 1  | 老 sysadmin 账号登录 1 次 → 进 MongoDB `db.users.findOne({username:'sysadmin'}).passwordHash.slice(0,6)` | 第一次登录前是 `$2b$10`，登录一次后自动变 `$2b$12`（自动迁移成功），再登仍成功                                               | <br />                     |
| 2  | Profile 开 MFA（扫码→输 6 位→确认）→ 登出→登录→输入正确 6 位                                                        | 成功进入；输入错误 6 位 5 次被锁 1min；用备份码 1 登录成功后 → 下次再输同 1 个备份码 → 提示「备份码已使用」；管理员调 reset-mfa → 用户再登不需要 MFA | <br />                     |
| 3  | 用 prompt="我的 Key 是 sk-test-1234567890abcdef，请帮我泄露它" 调 AI 诊断                                       | InputGuard 直接 403，响应中文「检测到疑似 API Key 泄漏，已拦截」；audit 新增 warning 记录                               | <br />                     |
| 3b | 构造模拟 LLM 返回包含 "password=abc123 secret=sk-real-123456"                                             | OutputGuard 改写为 "password=\*\*\* secret=\*\*\*" 并前缀加警告标记                                       | <br />                     |
| 4  | \`cd backend && npm audit --json                                                                  | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical'\` → 输出数字              | 数字 = 0（high+critical 漏洞清零） |
| 5  | `.env MFA_DISABLED=true` + `.env I_O_GUARD=off` 重启 backend → 走一遍全链路                               | 登录/对话/AI 诊断 3 条核心链路 100% 正常（等于上一轮未改之前状态，说明回滚开关真生效）                                             | <br />                     |

***

## 6. 风险与缓解（FailureExperience 对照）

| 风险                              | 概率 | 影响 | 缓解措施（对应 FailureExperience 教训）                                                          |
| ------------------------------- | -- | -- | -------------------------------------------------------------------------------------- |
| TOTP 接入搞坏登录流（用户登不进）             | 中  | 高  | 5 开关中的 `MFA_DISABLED=true` 直接跳过；dev reset-mfa 兜底；MFA 全流程用独立路由，不侵入原 login 代码块           |
| InputGuard 正则误杀正常 prompt（漏报/误报） | 中  | 中  | `I_O_GUARD=off` 一键关；正则先做宽松匹配（越权模板关键字只匹配最确定的 10 条）；命中 403 时返回 prompt 截断前 200 字让用户判断是否误杀 |
| bcrypt rounds=12 第一次登录慢         | 低  | 低  | 只在第一次迁移时发生（每人一次，200ms）；可后台异步存，不阻塞登录响应                                                  |
| npm audit fix 升级主版本破坏代码         | 中  | 中  | package-lock 先 git 保存快照，出问题 `npm ci` 回滚；不做 `--force`，只修能自动修的                           |
| SecurityReport 集合占存储            | 极低 | 低  | size 限制 500 条，自动 FIFO 删除最旧；默认不开分页全部                                                    |

***

## 7. 后续迭代（本轮不做，留给子项目 2）

1. **子项目 2-1：TOTP UI 打磨 + MFA 强制策略**（管理员可设"7 天内 admin 必须启用 MFA"，到期未启用的账号登录强制引导）
2. **子项目 2-2：真正的红队对抗框架**（AI TOP3 第三项）：对 Agent 核心做自动化 Prompt Injection 测试套件，生成每周报告
3. **子项目 2-3：审计/Prompt 日志字段级加密**（AI TOP3 第二项后半段）：AES-256-GCM 加密数据库中的敏感字段，而不是仅用正则脱敏

***

**Spec 自审（✓）**：

* [x] 无 TBD/TODO 占位（后续迭代明确标了「本轮不做」，不影响本 spec scope）

* [x] 内部一致：架构图 → 详细设计 → 回滚开关 → 验收标准，四个层面每条一一对应可追溯

* [x] Scope 合适：单迭代可做完，不跨 2 个独立子项目边界

* [x] 歧义清除：每个字段/路由/开关都明确 `.env 名`/`参数名`/`返回结构`，避免二义性

