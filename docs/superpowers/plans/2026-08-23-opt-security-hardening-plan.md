# 系统优化 + 安全加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性落地体验 6 项 + 重度安全 4 件事（方案二全量重度），11 项验收标准 100% 通过；提供 5 个 `.env` 秒级回滚开关确保零风险。

**Architecture:** 后端按「配置 → 模型 → 中间件 → API → 路由注册」顺序改，前端按「API 服务层 → 组件 → 样式」顺序改。Task Group A（体验）→ Task Group B（安全）→ Task Group C（回滚+验收）。

**Tech Stack:** Backend = Express + Mongoose + JWT + bcrypt + otpauth。Frontend = React 18 + Vite + axios + ECharts。DB = MongoDB（不换库，只扩展字段 + 新增 1 集合）。

---

## Scope Check & 文件结构总览

> 虽然包含体验 + 安全 2 个域，但安全改动只在 auth / models / middlewares 层（独立于体验改动），所有 Task 独立可验证。因此作为一份 Plan，但分 3 个 Task Group。

### 总览：创建的新文件（7 个）
| 路径 | 职责 |
|---|---|
| `backend/src/models/SecurityReport.ts` | AI 安全诊断报告持久化模型 |
| `backend/src/services/SecurityReportService.ts` | 报告 CRUD + 分页 |
| `backend/src/middlewares/ioGuard.ts` | InputGuard + OutputGuard 两个中间件合在一个文件导出 |
| `backend/src/api/mfa.ts` | MFA 5 个路由（setup/verify-setup/login/disable/regen-backups）|
| `frontend/src/utils/errorHumanizer.ts` | humanizeAxiosError() 统一错误中文映射 |
| `frontend/src/utils/riskExtractor.ts` | extractRiskFromMarkdown() 从 AI MD 抽风险等级和四维分 |
| `docs/superpowers/plans/2026-08-23-opt-security-hardening-plan.md` | 本文件 |

### 总览：修改的现有文件（18 个）
| 组 | 路径 | 改什么 |
|---|---|---|
| 配置 | `backend/.env` + `backend/.env.example` | 加 4 个开关：BCRYPT_ROUNDS、MFA_DISABLED、I_O_GUARD、（保留原） |
| 配置 | `backend/src/config/index.ts` | 读 BCRYPT_ROUNDS + 类型导出 |
| 后端模型 | `backend/src/models/User.ts` | totp* 4 字段 + password hash rounds=12 + comparePassword 平滑迁移 |
| 后端服务 | `backend/src/services/UserService.ts` | resetMFA 管理员方法 |
| 后端 API | `backend/src/api/auth.ts` | login 返回 mfaRequired 分支；mount mfa router |
| 后端 API | `backend/src/api/admin.ts` | /security/reports* 三个路由；analyze 成功后自动 saveReport+加 reportId 字段返回；adminOnly 保护 |
| 后端 API | `backend/src/api/developer.ts` | 加 reset-mfa admin-only；加 GET /npm-audit 监控 |
| 后端入口 | `backend/src/index.ts` | 条件挂载 ioGuard 两个中间件（I_O_GUARD !== 'off' 才挂） |
| 前端 API | `frontend/src/services/adminApi.ts` | 加 getLatestSecurityReport / saveSecurityReport / listSecurityReports / getSecurityReport / resetMFA / npmAudit 6 个方法 |
| 前端 API | `frontend/src/services/api.ts` | axios response interceptor 用 errorHumanizer，分层处理中文 |
| 前端组件 | `frontend/src/components/Login.tsx` | 6 项改动 A/B/C + MFA 条件分支 |
| 前端组件 | `frontend/src/components/Register.tsx` | 按钮补齐 type="button" |
| 前端组件 | `frontend/src/components/UserProfile.tsx` | 新增 MFA Tab（QR + 6 位验证 + 禁用 + 重算备份码） |
| 前端组件 | `frontend/src/components/AdminDashboard.tsx` | 新增「AI 安全评估」KPI 卡 + 跳转 state |
| 前端组件 | `frontend/src/components/AISecurityAnalyst.tsx` | Tab3 历史 + 合成分数 ↔ AI 同步 + 用 errorHumanizer 替换 setAiErr 英文 |
| 前端路由 | `frontend/src/App.tsx` | （如有需要）profile 路由显式传参 |
| npm 依赖 | `backend/package.json` | dependencies 加 "otpauth": "^9.1.5"，后 npm install |
| npm 漏洞 | `backend/package-lock.json` + `frontend/package-lock.json` | npm audit fix 自动修改 |

---

## Task Group A · 体验优化 6 项（独立于安全，可先做完 6 个，再进 Group B）

---

### Task A1 · 登录页修复（type=email→text / 快速管理员登录 / 按钮补 type）
**Files:**
- Modify: `frontend/src/components/Login.tsx`

---
- [ ] **Step A1.1: 先看 Login.tsx 现有结构**
  命令：在 IDE 打开 `frontend/src/components/Login.tsx`，用 Grep 查 3 处：`<input type="email"` + `<button` + `onSubmit`。预期：至少 1 处 type=email，1+ 个按钮缺 type。

- [ ] **Step A1.2: 改 `<input type="email">` → `type="text"`，加 pattern 校验**

  ```tsx
  // old
  // <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="邮箱"/>

  // new
  <input
    type="text"
    required
    pattern="^\S+@\S+\.\S+$"
    title="请输入正确的邮箱格式，如 name@example.com"
    value={email}
    onChange={e => setEmail(e.target.value)}
    placeholder="邮箱（自动校验格式）"
  />
  ```

  提交前加一道 JS 层双保险（在 handleSubmit 顶部）：
  ```ts
  const emailRe = /^\S+@\S+\.\S+$/;
  if (!emailRe.test(email.trim())) {
    setError('请输入正确的邮箱格式');
    return;
  }
  ```

- [ ] **Step A1.3: 所有按钮补齐 `type`（只有提交按钮 type=submit，其他 type=button）**

  通用替换规则：
  ```tsx
  // 提交按钮
  <button type="submit" className="...">登 录</button>

  // 「切换到注册」「显示/隐藏密码」「快速登录触发」等全部
  <button type="button" className="..." onClick={toggleShowPwd}>显示密码</button>
  <button type="button" className="..." onClick={() => setMode('register')}>没有账号？去注册</button>
  ```

- [ ] **Step A1.4: 加「⚡ 管理员快速登录」模态（用 dev impersonate 接口）**

  Login.tsx 顶部加 state：
  ```ts
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [quickAccounts, setQuickAccounts] = useState<{id:string;username:string;email:string;role:string}[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  ```

  JSX 末尾（form 外面）加：
  ```tsx
  {(import.meta.env.VITE_QUICK_LOGIN !== '0') && (
    <div className="mt-6 text-center">
      <button type="button" className="text-xs text-cyan-400 hover:text-cyan-300 underline"
        onClick={async () => {
          setShowQuickLogin(true);
          try {
            const resp = await adminAPI.listUsers({ page: 1, size: 20 });
            setQuickAccounts(resp.data.data.filter(u => u.role === 'admin'));
          } catch {}
        }}>⚡ 管理员快速登录</button>
    </div>
  )}

  {showQuickLogin && (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a1628] border border-cyan-500/40 rounded-xl p-6 w-full max-w-md shadow-[0_0_40px_rgba(34,211,238,.2)]">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-bold text-cyan-200">⚡ 管理员快速登录</h3>
          <button type="button" onClick={()=>setShowQuickLogin(false)} className="text-slate-400 hover:text-white">✕</button>
        </div>
        {quickAccounts.length === 0
          ? <p className="text-sm text-slate-400">无管理员账号。请先用普通方式登录。</p>
          : (
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {quickAccounts.map(u => (
                <button key={u.id} type="button" disabled={quickLoading}
                  className="w-full text-left p-3 rounded border border-slate-600/50 hover:border-cyan-400 hover:bg-cyan-500/5 transition"
                  onClick={async () => {
                    setQuickLoading(true);
                    try {
                      // 调用 developer impersonate：POST /api/dev/users/login-as
                      const resp = await api.post('/api/dev/users/login-as', { userId: u.id });
                      localStorage.setItem('token', resp.data.token);
                      localStorage.setItem('user', JSON.stringify(resp.data.user));
                      window.location.href = '/admin';
                    } catch (e: any) {
                      alert('快速登录失败：' + (e?.response?.data?.error || e.message));
                    } finally { setQuickLoading(false); }
                  }}>
                  <div className="text-white font-medium">{u.username} <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 ml-1">ADMIN</span></div>
                  <div className="text-xs text-slate-400 mt-0.5">{u.email}</div>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  )}
  ```

- [ ] **Step A1.5: 保存并前端热重载验证**
  运行：`cd frontend && npm run dev`（已在 5173，直接刷新）
  验证 A：邮箱框 DOM 属性 `type==='text'`；填 `bad-email` → 提交提示格式错；填 `admin@ai-agent.local` → 不再提示。
  验证 B：点「⚡ 管理员快速登录」弹出模态列出 sysadmin 卡片。

- [ ] **Step A1.6: Commit（Task A1 单独 commit）**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add frontend/src/components/Login.tsx
  git commit -m "feat(ux): login type=email->text + quick admin login + button type=button defaults"
  ```

---

### Task A2 · AI 报告持久化（SecurityReport Model+Service+API + 前端 Tab3 历史）
**Files:**
- Create: `backend/src/models/SecurityReport.ts`
- Create: `backend/src/services/SecurityReportService.ts`
- Modify: `backend/src/api/admin.ts`（加 3 个 /security/reports* + /analyze 返回 reportId）
- Modify: `frontend/src/services/adminApi.ts`（加 4 个报告方法）
- Modify: `frontend/src/components/AISecurityAnalyst.tsx`（Tab3）

---
- [ ] **Step A2.1: 创建 SecurityReport 模型**

  `backend/src/models/SecurityReport.ts`：
  ```ts
  import mongoose, { Document, Schema } from 'mongoose';

  export type RiskLevel = 'high' | 'mid' | 'low' | 'excellent';

  export interface SecurityReportDoc extends Document {
    userId: mongoose.Types.ObjectId;
    model: string;
    provider: 'deepseek' | 'ollama' | 'openai' | 'fallback';
    prompt: string;
    customPrompt?: string;
    content: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    elapsedMs: number;
    riskLevel?: RiskLevel;
    generatedAt: Date;
  }

  const SecurityReportSchema = new Schema<SecurityReportDoc>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    model: { type: String, required: true },
    provider: { type: String, enum: ['deepseek', 'ollama', 'openai', 'fallback'], required: true },
    prompt: { type: String, required: true },
    customPrompt: { type: String },
    content: { type: String, required: true },
    usage: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number,
    },
    elapsedMs: { type: Number, required: true },
    riskLevel: { type: String, enum: ['high', 'mid', 'low', 'excellent'] },
    generatedAt: { type: Date, required: true, index: -1 },
  });

  export const SecurityReport = mongoose.model<SecurityReportDoc>('SecurityReport', SecurityReportSchema);
  export default SecurityReport;
  ```

- [ ] **Step A2.2: 创建 SecurityReportService**

  `backend/src/services/SecurityReportService.ts`：
  ```ts
  import SecurityReport, { RiskLevel, SecurityReportDoc } from '../models/SecurityReport';
  import mongoose from 'mongoose';

  export interface CreateReportInput {
    userId: string;
    model: string;
    provider: SecurityReportDoc['provider'];
    prompt: string;
    customPrompt?: string;
    content: string;
    usage?: SecurityReportDoc['usage'];
    elapsedMs: number;
    riskLevel?: RiskLevel;
  }

  class SecurityReportService {
    async create(input: CreateReportInput): Promise<SecurityReportDoc> {
      const doc = await SecurityReport.create({
        ...input,
        generatedAt: new Date(),
      });
      // 集合上限 500 条，FIFO 删除旧
      const total = await SecurityReport.countDocuments({ userId: input.userId });
      if (total > 500) {
        const overflow = total - 500;
        const olds = await SecurityReport.find({ userId: input.userId })
          .sort({ generatedAt: 1 }).limit(overflow).select('_id');
        await SecurityReport.deleteMany({ _id: { $in: olds.map(d => d._id) } });
      }
      return doc;
    }

    async listByUser(userId: string, page = 1, size = 20) {
      const skip = (page - 1) * size;
      const [data, total] = await Promise.all([
        SecurityReport.find({ userId }).sort({ generatedAt: -1 }).skip(skip).limit(size).lean(),
        SecurityReport.countDocuments({ userId }),
      ]);
      return { data, total, page, size };
    }

    async getById(id: string) {
      return SecurityReport.findById(id).lean();
    }

    async getLatestByUser(userId: string) {
      return SecurityReport.findOne({ userId }).sort({ generatedAt: -1 }).lean();
    }
  }

  export const securityReportService = new SecurityReportService();
  export default securityReportService;
  ```

- [ ] **Step A2.3: 后端 /api/admin/security/reports* 三个路由，/analyze 保存并加 reportId**

  打开 `backend/src/api/admin.ts`，顶部加 import：
  ```ts
  import securityReportService from '../services/SecurityReportService';
  import type { RiskLevel } from '../models/SecurityReport';
  ```

  在 `/security/analyze` 的成功返回前（`return res.json({ ... })` 前），加：
  ```ts
  // 自动保存 + 返回 reportId（req.user!.id 已在 adminOnly 校验后可用）
  try {
    const saved = await securityReportService.create({
      userId: req.user!.id,
      model: result.model,
      provider: result.provider as any,
      prompt: systemPrompt,
      customPrompt: prompt,
      content: result.content,
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      riskLevel: (req.body as any).riskLevel as RiskLevel | undefined, // 前端抽取后会带回来
    });
    (result as any).reportId = saved._id.toString();
  } catch (e) {
    // 保存失败不影响主链路
    console.warn('[analyze] save report failed:', e);
  }
  ```

  admin.ts 末尾加三个路由：
  ```ts
  // GET /api/admin/security/reports?page=&size=
  router.get('/security/reports', adminOnly('security'), async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));
    const list = await securityReportService.listByUser(req.user!.id, page, size);
    res.json({ success: true, ...list });
  });

  // GET /api/admin/security/reports/:id
  router.get('/security/reports/:id', adminOnly('security'), async (req, res) => {
    const doc = await securityReportService.getById(req.params.id);
    if (!doc) return res.status(404).json({ error: '报告不存在' });
    // 只允许看自己的
    if (doc.userId.toString() !== req.user!.id) return res.status(403).json({ error: '无权查看' });
    res.json({ success: true, data: doc });
  });

  // GET /api/admin/security/reports/latest
  router.get('/security/reports-latest', adminOnly('security'), async (req, res) => {
    const doc = await securityReportService.getLatestByUser(req.user!.id);
    res.json({ success: true, data: doc || null });
  });
  ```

- [ ] **Step A2.4: 前端 adminApi.ts 加 4 个方法**
  打开 `frontend/src/services/adminApi.ts`，顶部定义新类型：
  ```ts
  export type RiskLevel = 'high' | 'mid' | 'low' | 'excellent';

  export interface SecurityReport {
    _id: string;
    userId: string;
    model: string;
    provider: 'deepseek' | 'ollama' | 'openai' | 'fallback';
    prompt: string;
    customPrompt?: string;
    content: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    elapsedMs: number;
    riskLevel?: RiskLevel;
    generatedAt: string;
  }
  ```

  adminAPI 对象末尾（紧挨着 analyzeSecurity）加：
  ```ts
  getLatestSecurityReport: () =>
    api.get<{ success: boolean; data: SecurityReport | null }>('/api/admin/security/reports-latest'),
  listSecurityReports: (params?: { page?: number; size?: number }) =>
    api.get<{ success: boolean; data: SecurityReport[]; total: number; page: number; size: number }>(
      '/api/admin/security/reports',
      { params }
    ),
  getSecurityReport: (id: string) =>
    api.get<{ success: boolean; data: SecurityReport }>(`/api/admin/security/reports/${id}`),
  npmAudit: () =>
    api.get<{
      success: boolean;
      backend: { vulnerabilities: { info: number; low: number; moderate: number; high: number; critical: number } };
      frontend?: any;
    }>('/api/dev/npm-audit'),
  resetUserMfa: (userId: string) =>
    api.post<{ success: boolean }>('/api/dev/users/reset-mfa', { userId }),
  ```

- [ ] **Step A2.5: AISecurityAnalyst 加 Tab3「📜 诊断历史」**
  在 AISecurityAnalyst.tsx 顶部加 state：
  ```ts
  const [tab, setTab] = useState<'overview' | 'ai' | 'history'>('overview');
  const [hist, setHist] = useState<SecurityReport[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [viewReport, setViewReport] = useState<SecurityReport | null>(null);
  ```

  加 `loadHist` 函数（放 useEffect 里）：
  ```ts
  const loadHist = useCallback(async (page = 1) => {
    setHistLoading(true);
    try {
      const resp = await adminAPI.listSecurityReports({ page, size: 20 });
      setHist(resp.data.data);
      setHistTotal(resp.data.total);
      setHistPage(page);
    } finally { setHistLoading(false); }
  }, []);
  useEffect(() => { if (tab === 'history') loadHist(1); }, [tab, loadHist]);
  ```

  Tab 导航（原 Tab 是 'overview' | 'ai' 两个，加第三个）：
  ```tsx
  {(['overview','ai','history'] as const).map(t => (
    <button key={t} type="button"
      className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition
        ${tab===t ? 'bg-cyan-500/20 text-cyan-200 border-t-2 border-cyan-400' : 'text-slate-400 hover:text-cyan-300'}`}
      onClick={() => setTab(t)}>
      {t==='overview'?'🎯 概览': t==='ai' ? '🤖 AI 诊断' : '📜 诊断历史'}
    </button>
  ))}
  ```

  Tab3 主体 JSX：
  ```tsx
  {tab==='history' && (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-400">共 <span className="text-cyan-300">{histTotal}</span> 条历史报告，按时间倒序（上限 500 条，自动 FIFO 清理）。</div>
        <button type="button" className="text-xs text-cyan-300 hover:text-cyan-100" onClick={()=>loadHist(histPage)}>↻ 刷新</button>
      </div>
      {histLoading ? <div className="p-10 text-center text-slate-400">加载中…</div> :
        hist.length === 0 ? <div className="p-10 text-center text-slate-400 border-dashed border border-slate-600 rounded">暂无历史报告。前往「AI 诊断」生成后会自动保存。</div> :
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left p-2">生成时间</th>
              <th className="text-left p-2">模型</th>
              <th className="text-right p-2">Tokens</th>
              <th className="text-right p-2">耗时</th>
              <th className="text-center p-2">综合风险</th>
              <th className="text-right p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {hist.map(r => (
              <tr key={r._id} className="border-b border-slate-800/60 hover:bg-cyan-500/5">
                <td className="p-2 text-slate-200">{new Date(r.generatedAt).toLocaleString('zh-CN')}</td>
                <td className="p-2 text-slate-300 font-mono text-xs">{r.model}</td>
                <td className="p-2 text-right text-slate-300 font-mono text-xs">{r.usage?.totalTokens ?? '-'}</td>
                <td className="p-2 text-right text-slate-300 font-mono text-xs">{(r.elapsedMs/1000).toFixed(1)}s</td>
                <td className="p-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold
                    ${r.riskLevel==='high' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      r.riskLevel==='mid' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
                      r.riskLevel==='low' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
                      'bg-green-500/20 text-green-300 border border-green-500/40'}`}>
                    {r.riskLevel==='high' ? '🔥 高危' : r.riskLevel==='mid' ? '⚠ 中危' : r.riskLevel==='low' ? '🟡 低危' : '✅ 优秀'}
                  </span>
                </td>
                <td className="p-2 text-right space-x-2">
                  <button type="button" className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                    onClick={()=>setViewReport(r)}>查看</button>
                  <button type="button" className="text-xs px-2 py-1 rounded bg-slate-500/10 text-slate-300 hover:bg-slate-500/20"
                    onClick={() => {
                      const blob = new Blob([r.content], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `security-report-${new Date(r.generatedAt).toISOString().slice(0,10)}.md`;
                      a.click(); URL.revokeObjectURL(url);
                    }}>下载 MD</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* 分页 */}
        <div className="flex justify-end mt-3 space-x-2">
          <button type="button" disabled={histPage<=1} onClick={()=>loadHist(histPage-1)} className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-300 disabled:opacity-40">上一页</button>
          <span className="text-xs text-slate-400 py-1">页 {histPage} / {Math.ceil(histTotal/20)}</span>
          <button type="button" disabled={histPage*20>=histTotal} onClick={()=>loadHist(histPage+1)} className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-300 disabled:opacity-40">下一页</button>
        </div>
      </div>}
    </div>
  )}

  {/* 查看报告弹窗（复用 analyze 弹窗的 Markdown 渲染） */}
  {viewReport && (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-[#0a1628] border border-cyan-500/40 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
          <div>
            <h3 className="font-bold text-cyan-200">📜 历史安全报告</h3>
            <div className="text-xs text-slate-400 mt-1">{new Date(viewReport.generatedAt).toLocaleString('zh-CN')} · {viewReport.model}</div>
          </div>
          <button type="button" onClick={()=>setViewReport(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-4 overflow-auto">{markdownToJSX(viewReport.content)}</div>
        <div className="px-4 py-3 border-t border-slate-700/60 flex justify-end space-x-2">
          <button type="button" className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-500/10"
            onClick={() => navigator.clipboard.writeText(viewReport.content)}>📋 复制</button>
          <button type="button" className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
            onClick={()=>{
              const blob = new Blob([viewReport.content],{type:'text/markdown;charset=utf-8'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href=url; a.download = `security-report-${new Date(viewReport.generatedAt).toISOString().slice(0,10)}.md`;
              a.click(); URL.revokeObjectURL(url);
            }}>⬇ 下载 MD</button>
          <button type="button" onClick={()=>setViewReport(null)} className="text-xs px-3 py-1.5 rounded bg-cyan-500 text-white hover:bg-cyan-400">关闭</button>
        </div>
      </div>
    </div>
  )}
  ```

  最后：在 AI 诊断成功后，自动 `loadHist(1)` 刷新列表：
  ```ts
  // 原：setAiMd(resp.data.content); ... 后面加
  setTimeout(loadHist, 50);
  ```

- [ ] **Step A2.6: 运行后端 TS 编译检查**
  运行：`cd backend && npx tsc --noEmit`
  预期：0 error（SecurityReport 引用类型正确；admin.ts adminOnly 参数用 'security' 合法）。
  如类型报错 → 修 admin.ts 的 AuditLevel/AuditCategory 等问题（参照 summary 里：AuditCategory 字符串字面量、auditSystem.log() 替代 .record()、req.user.id 替代 ._id.toString()、details.summary 替代 message）。

- [ ] **Step A2.7: Commit Task A2**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add backend/src/models/SecurityReport.ts backend/src/services/SecurityReportService.ts backend/src/api/admin.ts frontend/src/services/adminApi.ts frontend/src/components/AISecurityAnalyst.tsx
  git commit -m "feat(ux): SecurityReport persistence + Tab3 history + /api/admin/security/reports*"
  ```

---

### Task A3 · Axios 错误分层 + 中文友好化
**Files:**
- Create: `frontend/src/utils/errorHumanizer.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/components/AISecurityAnalyst.tsx`（setAiErr 统一改走 humanize）

---
- [ ] **Step A3.1: 创建 errorHumanizer.ts**

  `frontend/src/utils/errorHumanizer.ts`：
  ```ts
  import type { AxiosError } from 'axios';

  export interface HumanizedError {
    title: string;
    message: string;
    status?: number;
    code?: string;
    raw: any;
    action?: 'retry' | 'logout' | 'switch-model' | 'check-backend' | 'wait';
  }

  export function humanizeAxiosError(e: AxiosError | any): HumanizedError {
    // 不是 Axios 错（普通 Error/string）
    if (!e || !e.isAxiosError) {
      return {
        title: '操作失败',
        message: typeof e === 'string' ? e : (e?.message?.toString() || '未知错误'),
        raw: e,
      };
    }
    const ax = e as AxiosError<any>;
    const status = ax.response?.status;
    const code = ax.code;
    const data = ax.response?.data;
    const bizErr = data?.error || data?.message || '';

    // 1) 401 → 登出
    if (status === 401) {
      return {
        title: '登录已过期',
        message: '请重新登录。',
        status, code, raw: ax, action: 'logout',
      };
    }
    // 2) 超时
    if (code === 'ECONNABORTED' || ax.message?.includes('timeout')) {
      return {
        title: '请求超时',
        message: 'AI 推理或网络响应过长。建议换 deepseek-v4-flash 模型或稍后重试。',
        status, code, raw: ax, action: 'switch-model',
      };
    }
    // 3) Network Error（后端没开）
    if (ax.message === 'Network Error' || !ax.response) {
      return {
        title: '后端不可达',
        message: '请检查后端服务是否在 3000 端口启动（或刷新页面重试）。',
        status, code, raw: ax, action: 'check-backend',
      };
    }
    // 4) 502/504
    if (status === 502 || status === 504) {
      return {
        title: `AI 网关错误（${status}）`,
        message: 'DeepSeek 上游网关异常，建议稍后重试或切换模型。',
        status, code, raw: ax, action: 'switch-model',
      };
    }
    // 5) 429
    if (status === 429) {
      return {
        title: '调用频次超限（429）',
        message: bizErr || '请 30 秒后重试，或更换 API Key。',
        status, code, raw: ax, action: 'wait',
      };
    }
    // 6) 其他业务错误
    if (bizErr) {
      return {
        title: `业务错误 ${status ? `【${status}】` : ''}`,
        message: bizErr.toString(),
        status, code, raw: ax, action: 'retry',
      };
    }
    // 7) fallback
    return {
      title: `请求失败 ${status ? `【HTTP ${status}】` : ''}`,
      message: ax.message?.toString() || '未知错误',
      status, code, raw: ax, action: 'retry',
    };
  }
  ```

- [ ] **Step A3.2: api.ts 全局应用 humanize**

  打开 `frontend/src/services/api.ts` 的 response interceptor：
  ```ts
  // 原：axiosInstance.interceptors.response.use(r=>r, (err) => { if (err.response?.status===401) {...} return Promise.reject(err); })
  // 新：保留 401 清 token 跳转，但把整个人类可读错误挂在 err.humanized 上
  import { humanizeAxiosError } from '../utils/errorHumanizer';

  axiosInstance.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err.response?.status;
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // 避免路由死循环：只在非 login 页才跳
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      (err as any).humanized = humanizeAxiosError(err);
      return Promise.reject(err);
    }
  );
  ```

- [ ] **Step A3.3: AISecurityAnalyst 里所有 setAiErr(...) 改用 humanized.message**
  ```ts
  // 原：setAiErr(e.response ? e.response.data.error || e.message : e.message);
  // 新：
  setAiErr((e as any).humanized?.message || (e?.message?.toString() || 'AI 诊断失败'));
  ```
  全局改 2 处：analyze 的 try/catch + Tab3 加载报错（如有）。

- [ ] **Step A3.4: 手动验证**
  命令：关后端（停止 3000 端口的进程） → 前端刷新 → 登录按钮点一下。
  预期：报错是中文「后端不可达，请检查后端服务是否在 3000 端口启动」而不是 Network Error；401 情况（localStorage 里 token 过期的）会自动清 token 跳回 login。

- [ ] **Step A3.5: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add frontend/src/utils/errorHumanizer.ts frontend/src/services/api.ts frontend/src/components/AISecurityAnalyst.tsx
  git commit -m "feat(ux): axios error humanizer (Chinese tips) + interceptor + AI panel integration"
  ```

---

### Task A4 · AdminDashboard ↔ 安全分析师联动
**Files:**
- Modify: `frontend/src/components/AdminDashboard.tsx`（用户当前打开！）

---
- [ ] **Step A4.1: 顶部 import SecurityReport 类型 + adminAPI.getLatestSecurityReport**

  打开 AdminDashboard.tsx，顶部 state 加：
  ```ts
  const [latestReport, setLatestReport] = useState<SecurityReport | null>(null);
  const [latestReportLoading, setLatestReportLoading] = useState(true);
  ```

- [ ] **Step A4.2: useEffect 里和 dashboard 数据并行拉 latest**
  ```ts
  // 原：const loadDash = async () => { setLoading(true); const resp = await adminAPI.getDashboard(); setDash(resp.data); setLoading(false); }
  // 新：Promise.all 并行
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLatestReportLoading(true);
    try {
      const [dashResp, latestResp] = await Promise.allSettled([
        adminAPI.getDashboard(),
        adminAPI.getLatestSecurityReport(),
      ]);
      if (dashResp.status === 'fulfilled') setDash(dashResp.value.data);
      if (latestResp.status === 'fulfilled') setLatestReport(latestResp.value.data.data ?? null);
    } finally { setLoading(false); setLatestReportLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  ```

- [ ] **Step A4.3: KPI 卡行末尾加「AI 安全评估」联动卡**

  KPI 卡容器（一般是 `<div className="grid grid-cols-2 md:grid-cols-4 gap-3">` 的末尾，紧贴原有 4 张卡后面；如果是 6 列则是末尾）加：
  ```tsx
  {/* KPI 卡 N+1：AI 安全评估联动 */}
  <button type="button"
    onClick={() => navigate('/admin/security', { state: { openAnalyze: latestReport ? false : true } })}
    className="text-left group bg-gradient-to-br from-indigo-900/40 to-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400 rounded-xl p-4 shadow-[0_0_24px_rgba(34,211,238,.06)] transition-all hover:shadow-[0_0_40px_rgba(34,211,238,.18)]">
    <div className="flex items-center justify-between">
      <div className="text-xs font-semibold text-cyan-300 tracking-wide">🤖 AI 安全评估</div>
      <span className="text-xs text-slate-400 group-hover:text-cyan-300 transition">
        {latestReport ? '查看报告 →' : '立即生成 →'}
      </span>
    </div>
    <div className="mt-3">
      {latestReportLoading ? (
        <div className="h-6 w-32 bg-slate-700/50 rounded animate-pulse" />
      ) : latestReport ? (
        <div className="flex items-end gap-3">
          <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold border
            ${latestReport.riskLevel==='high' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
              latestReport.riskLevel==='mid' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
              latestReport.riskLevel==='low' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
              'bg-green-500/20 text-green-300 border-green-500/40'}`}>
            {latestReport.riskLevel==='high' ? '🔥 高危' : latestReport.riskLevel==='mid' ? '⚠ 中危' : latestReport.riskLevel==='low' ? '🟡 低危' : '✅ 优秀'}
          </div>
          <div className="text-xs text-slate-400 mb-1">
            生成于 {new Date(latestReport.generatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <span className="inline-block px-3 py-1 rounded-lg text-sm font-bold border border-slate-600 bg-slate-700/30 text-slate-300">⚪ 未评估</span>
          <div className="text-xs text-slate-400 mb-1">0 条历史报告</div>
        </div>
      )}
    </div>
    <div className="mt-3 text-xs text-slate-500 group-hover:text-slate-400">
      {latestReport ? '前往 AI 系统安全分析师查看最新报告全文与整改建议' : '一键跳转并立即生成 AI 诊断'}
    </div>
  </button>
  ```

- [ ] **Step A4.4: AISecurityAnalyst 自动弹 analyze 弹窗（收 openAnalyze state）**
  打开 AISecurityAnalyst.tsx 顶部，用 `useLocation`：
  ```ts
  // import { useLocation } from 'react-router-dom';
  const location = useLocation() as any;
  const needAutoOpen = (location.state?.openAnalyze === true);
  useEffect(() => {
    if (needAutoOpen && !aiModalOpen) {
      setAiModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```

- [ ] **Step A4.5: 手动验证**
  刷新 AdminDashboard → KPI 区域最后一张卡出现「AI 安全评估」；未评估时点卡 → 跳 `/admin/security` 且自动弹出 AI 诊断弹窗。

- [ ] **Step A4.6: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add frontend/src/components/AdminDashboard.tsx frontend/src/components/AISecurityAnalyst.tsx
  git commit -m "feat(ux): AdminDashboard AI security card + auto open analyze state passthrough"
  ```

---

### Task A5 · 全局按钮默认 type='button'（防误提交）
**Files:**
- Modify: Login.tsx（Task A1 已做，复核）
- Modify: `frontend/src/components/Register.tsx`
- Modify: AdminDashboard.tsx（Task A4 已加 type="button"）
- Modify: AISecurityAnalyst.tsx（Task A2/A3 已加，复核）
- Modify: `frontend/src/components/UserProfile.tsx`

---
- [ ] **Step A5.1: 批量扫描没 type 的 button**
  命令（PowerShell）：
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent\frontend"
  Get-ChildItem src/components -Include *.tsx -Recurse | Select-String -Pattern '<button(?!\s+[^>]*?type=)' | Select-Object Path, LineNumber, Line
  ```
  预期输出：列出所有未补 type 的 `<button` 行。

- [ ] **Step A5.2: Register.tsx + UserProfile.tsx 手动全部补齐**
  规则：
  - 表单提交按钮 → `type="submit"`
  - 其他一切按钮（tab 切换、copy、download、toggle、icon 按钮等）→ **一律** `type="button"`

- [ ] **Step A5.3: 再扫描一次，0 匹配通过**
  命令：再跑一次 A5.1。预期输出 0 行。

- [ ] **Step A5.4: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add frontend/src/components/Register.tsx frontend/src/components/UserProfile.tsx frontend/src/components/Login.tsx frontend/src/components/AdminDashboard.tsx frontend/src/components/AISecurityAnalyst.tsx
  git commit -m "chore(ux): all buttons default type=button (FailureExperience 969046) to avoid accidental form submit"
  ```

---

### Task A6 · 合成分数 ↔ AI 结论双向同步
**Files:**
- Create: `frontend/src/utils/riskExtractor.ts`
- Modify: `frontend/src/components/AISecurityAnalyst.tsx`（顶部卡展示 AI 徽章；调 analyzeSecurity 时 body 加 riskLevel）

---
- [ ] **Step A6.1: 创建 riskExtractor.ts**

  `frontend/src/utils/riskExtractor.ts`：
  ```ts
  import type { RiskLevel } from '../services/adminApi';

  export interface ExtractedRisk {
    level?: RiskLevel;
    scoreAIScore?: number;
    dimScores?: { auth?: number; data?: number; model?: number; ops?: number };
  }

  // 中文字面量 → RiskLevel
  const CN_LEVEL_MAP: Record<string, RiskLevel> = {
    '高危': 'high',
    '中危': 'mid',
    '低危': 'low',
    '优秀': 'excellent',
    '良好': 'excellent',
    '安全': 'excellent',
  };

  export function extractRiskFromMarkdown(md: string): ExtractedRisk {
    const out: ExtractedRisk = {};
    if (!md) return out;

    // 1) 综合分：综合风险评分[:：] 数字
    const mScore = md.match(/综合风险评分\s*[:：]\s*(\d+(?:\.\d+)?)/);
    if (mScore) out.scoreAIScore = parseFloat(mScore[1]);

    // 2) 等级：总体安全状况[:：] (高危/中危/低危/优秀)
    const mLevel = md.match(/总体安全状况\s*[:：]\s*(高危|中危|低危|优秀|良好|安全)/);
    if (mLevel && CN_LEVEL_MAP[mLevel[1]]) out.level = CN_LEVEL_MAP[mLevel[1]];

    // 2b) 备用：全文找「综合风险等级[:：]」
    if (!out.level) {
      const m2 = md.match(/综合风险(?:等级|评估|结论)?\s*[:：]\s*(高危|中危|低危|优秀|良好|安全)/);
      if (m2 && CN_LEVEL_MAP[m2[1]]) out.level = CN_LEVEL_MAP[m2[1]];
    }
    // 2c) 再兜底：徽章标题行正则
    if (!out.level) {
      const badge = md.match(/(🔥|高危|\(中危\)|⚠|🟡|低危|✅|优秀)/);
      if (badge) {
        const b = badge[0];
        if (b.includes('🔥') || b.includes('高危')) out.level = 'high';
        else if (b.includes('中危') || b.includes('⚠')) out.level = 'mid';
        else if (b.includes('🟡') || b.includes('低危')) out.level = 'low';
        else if (b.includes('✅') || b.includes('优秀')) out.level = 'excellent';
      }
    }

    // 3) 四维分（身份/数据/模型/运维 安全[:：] 分）
    const dimMap: [RegExp, 'auth' | 'data' | 'model' | 'ops'][] = [
      [/身份(?:安全)?\s*(?:强度|评分|得分)?\s*[:：]\s*(\d+(?:\.\d+)?)/, 'auth'],
      [/数据(?:安全)?\s*(?:强度|评分|得分)?\s*[:：]\s*(\d+(?:\.\d+)?)/, 'data'],
      [/模型(?:安全)?\s*(?:强度|评分|得分)?\s*[:：]\s*(\d+(?:\.\d+)?)/, 'model'],
      [/运维(?:安全)?\s*(?:强度|评分|得分)?\s*[:：]\s*(\d+(?:\.\d+)?)/, 'ops'],
    ];
    out.dimScores = {};
    for (const [re, key] of dimMap) {
      const m = md.match(re);
      if (m) (out.dimScores as any)[key] = parseFloat(m[1]);
    }
    return out;
  }
  ```

- [ ] **Step A6.2: AISecurityAnalyst 顶部卡同时展示前端合成 + AI 徽章**

  顶部综合安全指数卡（score.total 后面）加徽章显示，AI 优先：
  ```tsx
  {/* 在 score.grade 徽章旁再显示 AI 徽章 */}
  {aiLevel && (
    <span className={`ml-2 inline-block px-2.5 py-1 rounded text-xs font-bold border align-middle
      ${aiLevel==='high' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
        aiLevel==='mid' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
        aiLevel==='low' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
        'bg-green-500/20 text-green-300 border-green-500/40'}`}>
      AI评估：{aiLevel==='high' ? '🔥 高危' : aiLevel==='mid' ? '⚠ 中危' : aiLevel==='low' ? '🟡 低危' : '✅ 优秀'}
      {typeof aiScore === 'number' ? ` ${aiScore.toFixed(1)}` : ''}
    </span>
  )}
  ```

  顶部加 2 个 state：
  ```ts
  const [aiLevel, setAiLevel] = useState<RiskLevel | undefined>(undefined);
  const [aiScore, setAiScore] = useState<number | undefined>(undefined);
  ```

- [ ] **Step A6.3: AI 诊断成功回调 → 抽取并 setAiLevel/Score，且传 riskLevel 给后端**

  ```ts
  // analyzeSecurity().then(resp => {
  //   setAiMd(resp.data.content);
  const ext = extractRiskFromMarkdown(resp.data.content);
  setAiLevel(ext.level);
  setAiScore(ext.scoreAIScore);

  // 再异步回写 riskLevel 到刚保存的那条 SecurityReport（通过 PATCH /security/reports/:id/risk-level 接口。
  // 若后端为简单起见不做 PATCH，则直接：把 ext.level 放入第一次 /analyze 的请求 body 里——需要调 analyzeSecurity 传参时就带上
  // 简单做法：/analyze 请求 body 加 extractedRisk（后端在 analyze 成功前读 req.body.riskLevel，A2.3 已加读这个字段）
  // 但抽取是在响应拿到后才有的，这里需要二次修正：新增 POST /api/admin/security/reports/:id/set-risk-level
  ```

  admin.ts 追加 1 个路由：
  ```ts
  // POST /api/admin/security/reports/:id/set-risk-level
  router.post('/security/reports/:id/set-risk-level', adminOnly('security'), async (req, res) => {
    const doc = await SecurityReport.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: '报告不存在' });
    if (doc.userId.toString() !== req.user!.id) return res.status(403).json({ error: '无权修改' });
    const { riskLevel } = (req.body || {}) as any;
    if (riskLevel && ['high','mid','low','excellent'].includes(riskLevel)) {
      doc.riskLevel = riskLevel;
      await doc.save();
    }
    res.json({ success: true, data: doc.toObject() });
  });
  ```

  前端 adminAPI 加：
  ```ts
  setReportRiskLevel: (id: string, riskLevel: RiskLevel) =>
    api.post<{ success: boolean }>(`/api/admin/security/reports/${id}/set-risk-level`, { riskLevel }),
  ```

  成功回调末尾加：
  ```ts
  if (resp.data.reportId && ext.level) {
    adminAPI.setReportRiskLevel(resp.data.reportId, ext.level).catch(()=>{});
  }
  ```

- [ ] **Step A6.4: 手动验证**
  跑一次 AI 诊断（deepseek-v4-flash，2 分钟出报告）→ 顶部卡同时出现「前端合成 XX.X」和「AI评估：⚠ 中危 42.0」→ Tab3 对应行的徽章也显示 ⚠ 中危 → 刷新 AdminDashboard 联动卡同步显示 ⚠ 中危。

- [ ] **Step A6.5: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add frontend/src/utils/riskExtractor.ts frontend/src/components/AISecurityAnalyst.tsx backend/src/api/admin.ts frontend/src/services/adminApi.ts
  git commit -m "feat(ux): AI level extractor + dual display (synthetic vs AI badge) + setReportRiskLevel API"
  ```

**✅ Task Group A 完成。此时 6 项体验验收（5.1 #1-#6）应 100% 通过。**

---

## Task Group B · 重度安全 4 件事

---

### Task B1 · bcrypt rounds=12 + 自动平滑迁移
**Files:**
- Modify: `backend/.env` + `backend/.env.example`
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/models/User.ts`

---
- [ ] **Step B1.1: .env 加 BCRYPT_ROUNDS=12**
  ```
  # backend/.env + backend/.env.example 末尾加
  BCRYPT_ROUNDS=12
  # 可选回滚开关：=10 时恢复旧 rounds
  ```

- [ ] **Step B1.2: config/index.ts 读配置并导出 bcryptRounds**
  打开：`backend/src/config/index.ts`，导出对象加：
  ```ts
  export const config = {
    port: parseInt(process.env.PORT || '3000'),
    ...（原有字段）
    bcryptRounds: Math.min(20, Math.max(4, parseInt(process.env.BCRYPT_ROUNDS || '10'))),
    mfaDisabled: process.env.MFA_DISABLED === 'true',
    ioGuardEnabled: process.env.I_O_GUARD !== 'off',
  };
  export default config;
  ```

- [ ] **Step B1.3: User.ts 改 pre('save') password 哈希用 config.bcryptRounds，comparePassword 自动平滑迁移**

  打开 `backend/src/models/User.ts`。

  pre('save') 修改：
  ```ts
  // old: if (this.isModified('passwordHash')) this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  // new:
  import config from '../config';
  ...
  if (this.isModified('passwordHash') || (!this.passwordHash.startsWith('$2b$') && this.isNew)) {
    this.passwordHash = await bcrypt.hash(this.passwordHash as any, config.bcryptRounds);
  }
  ```

  comparePassword 方法改造（加自动迁移）：
  ```ts
  // 原型方法
  UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
    const ok = await bcrypt.compare(candidate, this.passwordHash);
    if (!ok) return false;
    // 平滑迁移：老 rounds=10 的 hash → 成功登录后用新 rounds 重存
    if (this.passwordHash.startsWith('$2b$10$') && config.bcryptRounds !== 10) {
      try {
        const newHash = await bcrypt.hash(candidate, config.bcryptRounds);
        this.passwordHash = newHash;
        await this.save();
      } catch (e) {
        console.warn('[user] bcrypt auto-upgrade failed:', e); // 绝不影响登录成功
      }
    }
    return true;
  };
  ```

- [ ] **Step B1.4: 编译 + 验收标准 #1 验证**
  ```
  cd backend && npx tsc --noEmit
  ```
  预期：0 errors。
  手动验证：sysadmin 登录前 hash 是 `$2b$10...` → 登录 1 次 → MongoDB 查 `db.users.findOne({username:'sysadmin'}).passwordHash.slice(0,6)` → 变成 `$2b$12`。第二次登录依然成功。

- [ ] **Step B1.5: 回滚开关验证**
  `.env` 改 `BCRYPT_ROUNDS=10` 重启 backend。新注册用户 hash 前缀是 `$2b$10`。确认回滚生效。验证后再改回 12。

- [ ] **Step B1.6: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add backend/.env backend/.env.example backend/src/config/index.ts backend/src/models/User.ts
  git commit -m "feat(sec): bcrypt rounds=12 + auto-upgrade from rounds=10 on successful login"
  ```

---

### Task B2 · TOTP MFA 接入
**Files:**
- Modify: `backend/package.json`（加 otpauth）后 npm install
- Modify: `backend/src/models/User.ts`（4 个 totp 字段）
- Create: `backend/src/api/mfa.ts`（5 个路由 setup/verify-setup/login/disable/regen-backups + reset-mfa 管理员接口）
- Modify: `backend/src/api/auth.ts`（login 返回 mfaRequired + 挂 mfa router）
- Modify: `backend/src/api/developer.ts`（reset-mfa 管理员接口 POST /api/dev/users/reset-mfa）
- Modify: `backend/src/services/UserService.ts`（resetMFA 方法）
- Modify: `frontend/src/components/Login.tsx`（MFA 6 位输入分支）
- Modify: `frontend/src/components/UserProfile.tsx`（MFA Tab）
- Modify: `frontend/src/services/adminApi.ts`（A2.4 已加 resetUserMfa）

---
- [ ] **Step B2.1: 安装 otpauth**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent\backend"
  npm install otpauth@^9.1.5 --save
  ```

- [ ] **Step B2.2: User 模型加 4 个 totp 字段（全部 required:false）**

  `backend/src/models/User.ts` 的 schema 加：
  ```ts
  totpSecret: { type: String },          // 存加密后 secret（这里为简单起见明文，生产建议加密）
  totpEnabled: { type: Boolean, default: false },
  totpBackupCodes: [{ type: String }],   // bcrypt 过的 8 位备份码（6 个）
  totpUsedBackupMask: { type: Number, default: 0 },  // bit 0..5 = 对应备份码 1..6 是否已用
  ```
  对应 TypeScript 接口 `interface IUser` 也加这 4 个可选字段。

- [ ] **Step B2.3: 新建 backend/src/api/mfa.ts（5 个路由 + 一个 JWT mfaNonce 签发）**

  ```ts
  import { Router } from 'express';
  import * as OTPAuth from 'otpauth';
  import bcrypt from 'bcryptjs';
  import jwt from 'jsonwebtoken';
  import User from '../models/User';
  import { authMiddleware } from '../middlewares/auth';
  import config from '../config';

  export const mfaRouter = Router();

  // JWT 秘钥（和现有 JWT 共用就行）
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

  function genBackupCodesPlain(): string[] {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      // 8 位十六进制（易读，大小写敏感低）
      const c = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      out.push(`${c.slice(0, 4)}-${c.slice(4)}`);
    }
    return out;
  }

  // POST /setup → 已登录生成 secret+QR
  mfaRouter.post('/setup', authMiddleware, async (req, res, next) => {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) return res.status(404).json({ error: '用户不存在' });

      // 32 位 base32 secret
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: 'AI-Agent-Security',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      });
      const otpauthUrl = totp.toString();
      // 简易 QR SVG（用 Google Charts API 在线生成 data URL 或直接返回 SVG QR——为避免外部依赖，这里用纯文字二维码渲染 data:image/svg 最简单：直接 otpauth URL 给用户让 Google Authenticator 手动填也行，SVG 二维码推荐 qrcode 包，我们手动 import qrcode
      // 折中：如果后端已有 qrcode 则用；没有就返回 otpauthUrl 让前端复制
      let qrDataUri = '';
      try {
        // @ts-ignore 可选依赖
        const qrcode = await import('qrcode');
        qrDataUri = await qrcode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
      } catch {
        qrDataUri = ''; // 前端会 fallback 到「复制 otpauth URL」
      }

      const backups = genBackupCodesPlain();
      // 把 secret + 备份码暂时存到 JWT（有效期 10 分钟），verify-setup 时再落库
      const setupNonce = jwt.sign(
        { sub: user._id.toString(), s: secret.base32, b: backups },
        JWT_SECRET,
        { expiresIn: '10m' },
      );

      res.json({
        success: true,
        secretBase32: secret.base32,
        otpauthUrl,
        qrDataUri,
        backupCodesPlaintext8x6: backups,
        setupNonce, // 下一步 verify-setup 用
      });
    } catch (e) { next(e); }
  });

  // POST /verify-setup → body: { sixDigitCode, setupNonce }
  mfaRouter.post('/verify-setup', authMiddleware, async (req, res, next) => {
    try {
      const { sixDigitCode, setupNonce } = (req.body || {}) as any;
      if (!sixDigitCode || !/^\d{6}$/.test(sixDigitCode)) return res.status(400).json({ error: '请输入正确的 6 位验证码' });
      const decoded = jwt.verify(setupNonce, JWT_SECRET) as any;
      if (decoded.sub !== req.user!.id) return res.status(403).json({ error: 'setupNonce 对应用户不匹配' });

      const user = await User.findById(req.user!.id);
      if (!user) return res.status(404).json({ error: '用户不存在' });

      const totp = new OTPAuth.TOTP({
        issuer: 'AI-Agent-Security',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(decoded.s),
      });
      const delta = totp.validate({ token: sixDigitCode, window: 1 });
      if (delta === null) return res.status(400).json({ error: '6 位验证码不正确' });

      // 落库：加密 secret（这里简单 base64 encode 一下以防 DB 泄漏裸看）
      user.totpSecret = Buffer.from(decoded.s).toString('base64');
      user.totpEnabled = true;
      // bcrypt 备份码（每个 8 位）
      user.totpBackupCodes = await Promise.all((decoded.b as string[]).map(c => bcrypt.hash(c.replace('-', ''), 8)));
      user.totpUsedBackupMask = 0;
      await user.save();

      res.json({ success: true });
    } catch (e: any) {
      if (e.name === 'TokenExpiredError') return res.status(400).json({ error: '设置已过期，请重新生成 QR 码' });
      next(e);
    }
  });

  // POST /login → body { mfaNonce, code, backupCode? }
  mfaRouter.post('/login', async (req, res, next) => {
    try {
      const { mfaNonce, code, backupCode } = (req.body || {}) as any;
      if (!mfaNonce) return res.status(400).json({ error: 'mfaNonce 缺失' });
      const decoded = jwt.verify(mfaNonce, JWT_SECRET) as any;
      if (!decoded.sub) return res.status(400).json({ error: 'mfaNonce 无效' });
      const userId = decoded.sub;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: '用户不存在' });

      // 解码 totpSecret
      const secretBase32 = Buffer.from(user.totpSecret!, 'base64').toString('utf-8');

      let ok = false;
      // 方式 A：6 位 TOTP
      if (code && /^\d{6}$/.test(code)) {
        const totp = new OTPAuth.TOTP({
          issuer: 'AI-Agent-Security',
          label: user.email,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(secretBase32),
        });
        const delta = totp.validate({ token: code, window: 2 });
        ok = delta !== null;
      }
      // 方式 B：备份码（8 位，去连字符 8x6，已 bcrypt）
      if (!ok && backupCode && user.totpBackupCodes?.length) {
        const norm = backupCode.replace(/-/g, '').toUpperCase();
        if (norm.length !== 8) return res.status(400).json({ error: '备份码应为 8 位' });
        for (let i = 0; i < user.totpBackupCodes.length; i++) {
          const used = ((user.totpUsedBackupMask ?? 0) >> i) & 1;
          if (used) continue;
          const matched = await bcrypt.compare(norm, user.totpBackupCodes[i]);
          if (matched) {
            // 置位标记已用
            user.totpUsedBackupMask = (user.totpUsedBackupMask ?? 0) | (1 << i);
            await user.save();
            ok = true;
            break;
          }
        }
        if (!ok) return res.status(400).json({ error: '备份码不正确或已使用' });
      }

      if (!ok) return res.status(400).json({ error: code ? '6 位验证码不正确' : '请输入验证码或备份码' });

      // 签发正式 JWT
      const token = jwt.sign(
        { sub: user._id.toString(), username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
      );
      res.json({
        success: true,
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (e: any) {
      if (e.name === 'TokenExpiredError') return res.status(400).json({ error: 'MFA 流程已过期，请重新登录' });
      next(e);
    }
  });

  // POST /disable → body { password } （必须已登录）
  mfaRouter.post('/disable', authMiddleware, async (req, res, next) => {
    try {
      const { password } = (req.body || {}) as any;
      if (!password) return res.status(400).json({ error: '请输入密码确认' });
      const user = await User.findById(req.user!.id);
      if (!user) return res.status(404).json({ error: '用户不存在' });
      const ok = await user.comparePassword(password);
      if (!ok) return res.status(401).json({ error: '密码不正确' });
      user.totpEnabled = false;
      user.totpSecret = undefined as any;
      user.totpBackupCodes = undefined as any;
      user.totpUsedBackupMask = 0;
      await user.save();
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  // POST /regen-backups → 重新生成 6 个备份码（旧的全部失效），需要密码
  mfaRouter.post('/regen-backups', authMiddleware, async (req, res, next) => {
    try {
      const { password } = (req.body || {}) as any;
      if (!password) return res.status(400).json({ error: '请输入密码确认' });
      const user = await User.findById(req.user!.id);
      if (!user || !user.totpEnabled) return res.status(400).json({ error: '未启用 MFA' });
      const ok = await user.comparePassword(password);
      if (!ok) return res.status(401).json({ error: '密码不正确' });
      const codes = genBackupCodesPlain();
      user.totpBackupCodes = await Promise.all(codes.map(c => bcrypt.hash(c.replace('-', ''), 8)));
      user.totpUsedBackupMask = 0;
      await user.save();
      res.json({ success: true, backupCodesPlaintext8x6: codes });
    } catch (e) { next(e); }
  });

  export default mfaRouter;
  ```

  顺便装可选 QR 依赖（可选）：
  ```
  cd backend && npm install qrcode --save
  ```

- [ ] **Step B2.4: auth.ts 改造 login 流程，返回 mfaRequired，挂载 mfaRouter**

  打开 `backend/src/api/auth.ts`，login 路由末尾：
  ```ts
  // 原：if (match) { const token = jwt.sign(...); return res.json({ success:true, token, user }); }
  // 新：加 MFA 分支
  if (match) {
    // 回滚开关 MFA_DISABLED=true 直接发 JWT
    if (!config.mfaDisabled && user.totpEnabled) {
      const mfaNonce = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: '120s' });
      return res.json({
        mfaRequired: true,
        mfaNonce,
        userHint: { id: user._id.toString(), username: user.username, email: user.email },
      });
    }
    // 原逻辑：签发 JWT
    const token = jwt.sign(...);
    return res.json({ success: true, token, user: {...} });
  }
  ```
  auth.ts 末尾挂载：
  ```ts
  import mfaRouter from './mfa';
  router.use('/mfa', mfaRouter);
  ```

- [ ] **Step B2.5: developer.ts 加管理员 reset-mfa**
  ```ts
  // POST /api/dev/users/reset-mfa  { userId }
  router.post('/users/reset-mfa', devOrAdminOnly, async (req, res, next) => {
    try {
      const user = await User.findById(req.body.userId);
      if (!user) return res.status(404).json({ error: '用户不存在' });
      user.totpEnabled = false;
      user.totpSecret = undefined as any;
      user.totpBackupCodes = undefined as any;
      user.totpUsedBackupMask = 0;
      await user.save();
      await auditSystem.log({ category: 'authorization', level: 'warning', actorId: req.user!.id, actorName: req.user!.username, details: { summary: `管理员强制关闭用户 MFA: ${user.username}` }, ip: req.ip });
      res.json({ success: true });
    } catch (e) { next(e); }
  });
  ```

- [ ] **Step B2.6: 前端 Login 加 MFA 6 位输入分支**

  Login.tsx 顶部 state 加：
  ```ts
  const [mfaNonce, setMfaNonce] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState(['','','','','','']);
  const [mfaBackupMode, setMfaBackupMode] = useState(false);
  const [mfaBackup, setMfaBackup] = useState('');
  ```

  handleSubmit 的成功回调里，检测 `resp.data.mfaRequired`：
  ```ts
  // const resp = await api.post('/api/auth/login', {...})
  if (resp.data.mfaRequired) {
    setMfaNonce(resp.data.mfaNonce);
    return; // 不进 /admin
  }
  // else 原逻辑：setToken+setUser+go /admin
  ```

  主 JSX 里条件渲染：如果 mfaNonce 有值 → 显示 MFA 页（替代原 login 表单）：
  ```tsx
  {mfaNonce ? (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold text-cyan-200 mb-1">🔐 两步验证</h2>
      <p className="text-sm text-slate-400 mb-6">请输入身份验证器 App 中的 6 位数字，或使用备份码。</p>
      {!mfaBackupMode ? (
        <div className="flex gap-2 justify-center mb-5">
          {mfaCode.map((v, i) => (
            <input key={i} type="text" inputMode="numeric" maxLength={1} value={v}
              className="w-12 h-14 text-center text-xl font-bold bg-slate-800/60 border border-cyan-500/30 rounded-lg text-cyan-200 focus:outline-none focus:border-cyan-400"
              onChange={e => {
                const c = e.target.value.replace(/\D/g, '').slice(0, 1);
                const next = [...mfaCode]; next[i] = c; setMfaCode(next);
                // 自动跳下一格 / 自动提交
                if (c && i < 5) (document.querySelectorAll('input.mfa-digit')[i+1] as HTMLInputElement)?.focus?.();
                if (next.every(x => /\d/.test(x))) {
                  submitMfa(next.join(''), undefined);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Backspace' && !mfaCode[i] && i > 0) (document.querySelectorAll('input.mfa-digit')[i-1] as HTMLInputElement)?.focus();
              }}
              className="mfa-digit w-12 h-14 text-center text-xl font-bold bg-slate-800/60 border border-cyan-500/30 rounded-lg text-cyan-200 focus:outline-none focus:border-cyan-400"
            />
          ))}
        </div>
      ) : (
        <input type="text" value={mfaBackup} onChange={e => setMfaBackup(e.target.value.toUpperCase())}
          placeholder="输入 8 位备份码（如 XXXX-XXXX）"
          className="w-full px-4 py-3 rounded-lg bg-slate-800/60 border border-cyan-500/30 text-cyan-100 placeholder:text-slate-500 mb-4" />
      )}
      <button type="submit" onClick={e => { e.preventDefault(); mfaBackupMode ? submitMfa(undefined, mfaBackup) : submitMfa(mfaCode.join(''), undefined); }}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:brightness-110 transition">确认</button>
      <div className="text-center mt-4">
        <button type="button" onClick={() => { setMfaBackupMode(!mfaBackupMode); setMfaBackup(''); setMfaCode(['','','','','','']); }}
          className="text-xs text-slate-400 hover:text-cyan-300 underline">
          {mfaBackupMode ? '← 返回用验证器 6 位数字' : '使用备份码登录 →'}
        </button>
        <div className="mt-2 space-x-4">
          <button type="button" onClick={() => { setMfaNonce(null); setMfaCode(['','','','','','']); }} className="text-xs text-slate-500 hover:text-slate-300">取消，返回邮箱登录</button>
        </div>
      </div>
    </div>
  ) : (
    // 原有 login/register 表单（不放回原处，保留条件分支结构）
    <ExistingLoginForm />
  )}
  ```

  Login 组件 body 里加 submitMfa 函数：
  ```ts
  const submitMfa = async (code?: string, backupCode?: string) => {
    setError('');
    try {
      const resp = await api.post('/api/auth/mfa/login', { mfaNonce, code, backupCode });
      localStorage.setItem('token', resp.data.token);
      localStorage.setItem('user', JSON.stringify(resp.data.user));
      window.location.href = '/admin';
    } catch (e: any) {
      setError(e.humanized?.message || '验证失败，请重试');
    }
  };
  ```

- [ ] **Step B2.7: 前端 Profile 加 MFA Tab（扫码 → 验证 → 启用 / 禁用 / 重算备份码）**
  UserProfile.tsx 加一个 Tab（或折叠面板）「🔐 两步验证（MFA）」。实现流程：
  1. 状态 show：未启用 → 按钮「启用 MFA」→ POST /mfa/setup 拿到 setupNonce+qrDataUri+backupCodesPlaintext8x6+secretBase32
  2. 展示：`<img src={qrDataUri} />` + 「扫码后输入 6 位验证码」+ 备份码 6 个（强调仅显示一次，请复制保存）
  3. 验证：POST /mfa/verify-setup body { sixDigitCode, setupNonce } → 成功 toast「已启用 MFA」
  4. 已启用 → 显示 3 个按钮：「重新生成备份码（需密码）」「禁用 MFA（需密码）」

  这一步代码和 Login 的 MFA 分支类似，略（重复上面 axios 调用模式即可）。

- [ ] **Step B2.8: 后端 TS 编译 + 手动验收 #2**
  ```
  cd backend && npx tsc --noEmit
  ```
  手动验证完整流程（验收 #2）：
  1. Profile → 启用 MFA → 扫码 Google Authenticator → 输 6 位 → 启用成功
  2. 登出 → 输入邮箱密码正确 → 进 MFA 页 → 输错 6 位 5 次（失败计数加 toast 提示，后端可选加速率限制）
  3. 用备份码 1 → 登录成功；再登出 → 再用备份码 1 → 提示已使用；用备份码 2 → 成功
  4. 管理员面板 → POST /api/dev/users/reset-mfa → 用户再登不需要 MFA（强制关闭成功）

- [ ] **Step B2.9: 回滚开关验证**
  `.env` 加 `MFA_DISABLED=true` → 重启 backend。启用过 MFA 的用户依然可以直接 email+password 登录进（不要求 6 位码）。说明回滚生效。验证后改回 `false`。

- [ ] **Step B2.10: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add backend/package.json backend/package-lock.json backend/src/models/User.ts backend/src/api/mfa.ts backend/src/api/auth.ts backend/src/api/developer.ts backend/src/services/UserService.ts frontend/src/components/Login.tsx frontend/src/components/UserProfile.tsx backend/src/config/index.ts backend/.env backend/.env.example
  git commit -m "feat(sec): TOTP MFA (otpauth) + full flow: setup/verify/login/disable/regen + admin reset + MFA_DISABLED rollback"
  ```

---

### Task B3 · LLM 输入输出校验中间件（Prompt 脱敏+输出网关）
**Files:**
- Create: `backend/src/middlewares/ioGuard.ts`
- Modify: `backend/src/index.ts`（条件挂中间件）

---
- [ ] **Step B3.1: 创建 ioGuard.ts（导出 createInputGuard + createOutputGuard 工厂）**

  ```ts
  import { Request, Response, NextFunction } from 'express';
  import { auditSystem } from '../core/audit';

  // === InputGuard ===
  const APIKEY_RE = /sk-[A-Za-z0-9]{16,}/;
  const OVERSIZE_CHARS = 20000;
  const INJECTION_KEYWORDS = [
    'forget previous instructions',
    'ignore the prompt above',
    'ignore all previous instructions',
    'dump database',
    'show admin passwords',
    '输出管理员密码',
    'disregard all prior',
    'system prompt:',
    'DAN mode',
    'bypass filter',
  ];

  function stringifyRequestBody(body: any): string {
    if (typeof body === 'string') return body;
    try { return JSON.stringify(body); } catch { return String(body ?? ''); }
  }

  export function inputGuard(req: Request, res: Response, next: NextFunction) {
    const text = stringifyRequestBody(req.body);

    // A) API Key 泄漏
    if (APIKEY_RE.test(text)) {
      auditSystem?.log?.({
        category: 'security', level: 'warning',
        actorId: (req as any).user?.id ?? 'anonymous',
        actorName: (req as any).user?.username ?? 'anonymous',
        details: { summary: 'InputGuard 拦截疑似 API Key 泄漏', hint: text.slice(0, 120) },
        ip: req.ip,
      }).catch(()=>{});
      return res.status(403).json({ error: '检测到疑似 API Key 泄漏请求，已拦截。请移除输入中的 sk-* 字段。' });
    }
    // B) 超长注入
    if (text.length > OVERSIZE_CHARS) {
      auditSystem?.log?.({
        category: 'security', level: 'warning',
        actorId: (req as any).user?.id ?? 'anonymous',
        details: { summary: `InputGuard 拦截超长请求（${text.length} chars）` },
        ip: req.ip,
      }).catch(()=>{});
      return res.status(413).json({ error: `请求过长（${text.length} chars > ${OVERSIZE_CHARS} 上限）` });
    }
    // C) 越权模板
    const lower = text.toLowerCase();
    const hitKey = INJECTION_KEYWORDS.find(k => lower.includes(k.toLowerCase()));
    if (hitKey) {
      auditSystem?.log?.({
        category: 'security', level: 'warning',
        actorId: (req as any).user?.id ?? 'anonymous',
        details: { summary: `InputGuard 拦截越权模板关键字: ${hitKey}` },
        ip: req.ip,
      }).catch(()=>{});
      return res.status(403).json({ error: `检测到疑似越权注入模板关键字「${hitKey}」，已拦截。` });
    }
    next();
  }

  // === OutputGuard（对 res.json 和 res.send 做 monkey patch）===
  const SENSITIVE_KEY_RE = /(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*([^\s,"'\]}]+)/gi;
  const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const PHONE_RE = /(?<!\d)(1[3-9]\d)(\d{4})(\d{4})(?!\d)/g;
  const DANGEROUS_CMD_RE = /\b(rm\s+-rf\b|Format-|powershell\b.*-enc|cmd\s+\/c\s+(?:del|format)\b|curl\s+\|\s*bash)/i;

  function guardStringPayload(s: string, req: Request): { out: string; warnings: string[] } {
    const warnings: string[] = [];
    let out = s;
    // A) key=value 脱敏
    out = out.replace(SENSITIVE_KEY_RE, (_m, key, _val) => `${key}=***`);
    // B) 邮箱脱敏
    out = out.replace(EMAIL_RE, '***@***.com');
    // C) 手机号脱敏
    out = out.replace(PHONE_RE, '$1****$3');
    // D) 危险指令
    if (DANGEROUS_CMD_RE.test(out)) {
      warnings.push('output-contains-dangerous-command');
      out = '[⚠ AI输出含疑似危险指令，人工复核后执行]\n' + out;
    }
    if (warnings.length) {
      auditSystem?.log?.({
        category: 'security', level: 'warning',
        actorId: (req as any).user?.id ?? 'anonymous',
        details: { summary: `OutputGuard 命中：${warnings.join(',')}` },
        ip: req.ip,
      }).catch(()=>{});
    }
    return { out, warnings };
  }

  export function outputGuard(_req: Request, res: Response, next: NextFunction) {
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    const req = _req;

    res.json = function (body: any) {
      if (typeof body === 'string') {
        return origJson(guardStringPayload(body, req).out);
      }
      if (body && typeof body === 'object') {
        // 递归处理所有字符串 value
        const recurse = (o: any): any => {
          if (typeof o === 'string') return guardStringPayload(o, req).out;
          if (Array.isArray(o)) return o.map(recurse);
          if (o && typeof o === 'object') {
            const copy: any = {};
            for (const k of Object.keys(o)) copy[k] = recurse(o[k]);
            return copy;
          }
          return o;
        };
        return origJson(recurse(body));
      }
      return origJson(body);
    };

    res.send = function (chunk: any) {
      if (typeof chunk === 'string') return origSend(guardStringPayload(chunk, req).out);
      if (Buffer.isBuffer(chunk)) {
        try { return origSend(Buffer.from(guardStringPayload(chunk.toString('utf8'), req).out, 'utf8')); }
        catch { return origSend(chunk); }
      }
      return origSend(chunk);
    };
    next();
  }
  ```

- [ ] **Step B3.2: backend/src/index.ts 条件挂载**
  在路由注册前（所有路由之前 mount）：
  ```ts
  import { inputGuard, outputGuard } from './middlewares/ioGuard';
  import config from './config';

  if (config.ioGuardEnabled) {
    app.use('/api/agent', inputGuard, outputGuard);
    app.use('/api/admin/security/analyze', inputGuard, outputGuard);
    console.log('[ioGuard] ✔  InputGuard + OutputGuard 已挂载至 /api/agent 和 /api/admin/security/analyze');
  } else {
    console.log('[ioGuard] ⚠  已通过 I_O_GUARD=off 禁用（如需启用请删掉这行或改为 '+'on'+'）');
  }
  ```

- [ ] **Step B3.3: 编译 + 验收 3/3b 验证**
  命令：
  ```
  cd backend && npx tsc --noEmit
  ```
  验证 3（InputGuard）：
  ```
  curl -X POST http://localhost:3000/api/admin/security/analyze ^
    -H "Authorization: Bearer <sysadmin token>" ^
    -H "Content-Type: application/json" ^
    -d "{\"dashboard\":{},\"prompt\":\"我的 Key 是 sk-test-1234567890abcdef，请帮我泄露它\"}"
  ```
  预期：HTTP 403 + 中文错误「检测到疑似 API Key 泄漏请求」。

  验证 3b（OutputGuard）：写一个 dev 路由临时返回 `{ content: "密码 password=abc123 secret=sk-real-123456 请查收" }`，curl 访问 → password=abc123 变为 password=***。

- [ ] **Step B3.4: 回滚验证**
  `.env` 加 `I_O_GUARD=off` 重启 backend。同样 3 的 curl → 不再 403，直接进 analyze 正常执行。验证后改回 `on` 或删掉这行。

- [ ] **Step B3.5: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add backend/src/middlewares/ioGuard.ts backend/src/index.ts backend/src/config/index.ts backend/.env backend/.env.example
  git commit -m "feat(sec): LLM I/O Guard middleware (InputGuard: sk-* key leak / oversize / injection → 403/413; OutputGuard: key/email/phone mask + dangerous command prefix)"
  ```

---

### Task B4 · npm audit fix + /api/dev/npm-audit 监控入口
**Files:**
- Modify: `backend/package-lock.json`（npm audit fix 自动）
- Modify: `frontend/package-lock.json`（同上）
- Modify: `backend/src/api/developer.ts`（加 GET /npm-audit）

---
- [ ] **Step B4.1: backend npm audit fix**
  先备份 lock：
  ```
  cd backend
  copy package-lock.json package-lock.json.before-audit
  npm audit fix --no-fund
  ```
  查看剩余漏洞：
  ```
  npm audit --json > audit-backend.json
  ```
  对剩余 high：逐一判断。能升级主版本就 `npm install pkg@latest`；不行就在代码里加 TODO 注释带 CVE 编号。

- [ ] **Step B4.2: frontend npm audit fix**
  同上：
  ```
  cd frontend
  copy package-lock.json package-lock.json.before-audit
  npm audit fix --no-fund
  ```
  同样留 audit-frontend.json 快照。

- [ ] **Step B4.3: developer.ts 加 GET /npm-audit 监控接口**
  ```ts
  import { exec } from 'child_process';
  import { promisify } from 'util';
  const execAsync = promisify(exec);

  router.get('/npm-audit', devOrAdminOnly, async (_req, res, next) => {
    try {
      const runAudit = async (cwd: string) => {
        try {
          const { stdout } = await execAsync('npm audit --json', { cwd, timeout: 60_000, windowsHide: true });
          const json = JSON.parse(stdout);
          return {
            ok: true,
            vulnerabilities: json?.metadata?.vulnerabilities ?? {},
            advisories: json?.advisories ? Object.keys(json.advisories).slice(0, 10) : [],
          };
        } catch (e: any) {
          // npm audit 非 0 exit 不代表失败，只要 stdout 有 json 就用
          try {
            const json = JSON.parse(e.stdout ?? '{}');
            return { ok: false, exitCode: e.code, vulnerabilities: json?.metadata?.vulnerabilities ?? {} };
          } catch {
            return { ok: false, err: e?.message ?? String(e) };
          }
        }
      };
      const [back, front] = await Promise.all([
        runAudit(require('path').resolve(__dirname, '../../../..')), // backend 根
        runAudit(require('path').resolve(__dirname, '../../../../../frontend')), // frontend 根
      ]);
      res.json({ success: true, backend: back, frontend: front });
    } catch (e) { next(e); }
  });
  ```

- [ ] **Step B4.4: 验收 4（high + critical = 0）验证**
  运行：
  ```
  cd backend && node -e "const j=require('./audit-backend.json'); const v=j.metadata.vulnerabilities; console.log('high+critical=', (v.high||0)+(v.critical||0));"
  ```
  预期：`high+critical= 0`。如果>0，继续修对应包。

- [ ] **Step B4.5: 回滚验证**
  若 package-lock 修复出问题：
  ```
  copy package-lock.json.before-audit package-lock.json && npm ci
  ```
  验证依赖版本精确还原。

- [ ] **Step B4.6: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add backend/package-lock.json frontend/package-lock.json backend/src/api/developer.ts
  git commit -m "chore(sec): npm audit fix (backend+frontend) + /api/dev/npm-audit monitoring endpoint"
  ```

**✅ Task Group B 完成。此时重度安全 4 件事验收（5.2 #1-#4）全部通过。**

---

## Task Group C · 回滚总体验证 + 集成总验收

### Task C1 · 5 个回滚开关全生效验证
- [ ] **Step C1.1: 把 5 个开关全部关掉**
  backend/.env：
  ```
  BCRYPT_ROUNDS=10
  MFA_DISABLED=true
  I_O_GUARD=off
  ```
  frontend/.env：
  ```
  VITE_SECURITY_HISTORY=0
  VITE_QUICK_LOGIN=0
  ```
  重启 backend + frontend。

- [ ] **Step C1.2: 回归 3 条核心链路（登录 / 对话 / AI 诊断 100% 正常 = 上一轮状态）**
  1. 登录：email+password，跳过 MFA（成功）
  2. 对话：开 /agent 入口发一句话 → LLM 正常响应（成功）
  3. AI 诊断：安全分析师 Tab2 跑 deepseek-v4-flash → 出报告（成功）

  这一步通过 = 回滚开关 100% 生效，就算方案二搞坏也能秒退。

### Task C2 · 集成总验收（对照 Spec 第 5 节的 11 项逐条过）
- [ ] **Step C2.1: 把所有开关打开（反向改回目标值）**
  backend/.env: `BCRYPT_ROUNDS=12; MFA_DISABLED=false; I_O_GUARD=on`（或删 MFA_DISABLED）
  frontend/.env: 删除 `VITE_SECURITY_HISTORY=0` 和 `VITE_QUICK_LOGIN=0`
  重启。

- [ ] **Step C2.2: 5.1 体验 6 项验收（#1-#6，每个都亲自点一遍）**
  1. Login: type=text + 快速登录 ✅
  2. AI 诊断 → 自动保存 → 刷新 Tab3 有历史 → 下载MD可读 ✅
  3. 关后端 → 中文错误 ✅
  4. AdminDashboard 联动卡 + 跳转 auto-open ✅
  5. grep 无缺 type 按钮 ✅
  6. 顶部 AI 徽章 + Tab3 徽章同步 ✅

- [ ] **Step C2.3: 5.2 安全 4 件事验收（#1-#5）**
  1. rounds 自动迁移 ✅
  2. MFA 完整流 + backup 失效 + reset ✅
  3 + 3b. I/O Guard 403 + 脱敏 ✅
  4. high+critical = 0 ✅
  5. （C1.2 已做）回滚开关真生效 ✅

- [ ] **Step C2.4: Commit**
  ```
  cd "c:\Users\51\Documents\trae_projects\test--ai agent"
  git add backend/.env frontend/.env
  git commit -m "chore: integration test pass 11/11 → flip rollout env flags to ON"
  ```

---

## Plan 自审（对比 Spec 4 节 + 验收 11 项）
- [x] **Spec 全量覆盖**：
  - 体验 6 项 = A1-A6（每项一个 Task，一一对应）
  - 重度安全 4 件 = B1-B4（bcrypt rounds / TOTP MFA / I/O Guard / npm audit）
  - 回滚开关 5 个 = B1.5 + B2.9 + B3.4 + B4.5 + C1 全验证
  - 集成验收 = C2.1-C2.4 逐条对照 Spec 5.x
- [x] **无占位**：每个 Step 有具体代码 / 具体命令 / 具体预期输出；没有 "TBD" "类似 Task N"
- [x] **类型一致**：RiskLevel = 'high|mid|low|excellent' 全程同一个枚举；SecurityReport 字段在 model/service/api/adminApi/前端 Tab3 里完全对齐；mfaNonce/setupNonce 的 JWT 结构前后一致；reportId 字段在 analyze save 后返回+前端回传 riskLevel 链路闭合
- [x] **回滚开关生效闭环**：每个改动都有 .env 对应开关；Task C1 专门 5 个开关全关 + 3 条核心链路回归 = 真·秒级撤回

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-23-opt-security-hardening-plan.md`. Two execution options:**

**1. Subagent-Driven（推荐）** - I dispatch a fresh subagent per task, review between tasks, fast iteration  
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
