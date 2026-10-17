import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI, DashboardData as IDash, RiskLevel, SecurityReport } from '../services/adminApi';
import { extractRiskFromMarkdown } from '../utils/riskExtractor';
import { AlertTriangle, Users, Database, Cpu, Wrench, History, Gauge, ChevronLeft, ChevronRight, Download, Copy, X, Loader2, RefreshCw, Eye } from 'lucide-react';

/* ============================================================
 *  AI 系统安全分析师
 *  - Tab 1: 现状分析（4维度安全强度进度条 + 风险主体TOP）
 *  - Tab 2: 风险评估（红线问题分析 + 处置概览 + 各单位薄弱分析）
 * ============================================================ */

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type TabKey = 'current' | 'risk' | 'history';

function progressColor(v: number): string {
  if (v < 60) return 'high';
  if (v < 80) return 'mid';
  if (v <= 90) return 'low';
  return 'ok';
}
function scoreGrade(v: number): { cls: string; txt: string } {
  if (v < 60) return { cls: 'badge high', txt: '中等风险' };
  if (v < 80) return { cls: 'badge mid', txt: '总体平稳' };
  return { cls: 'badge excellent', txt: '状态优秀' };
}
function scoreTextColor(v: number): string {
  if (v < 60) return 'var(--c-red)';
  if (v < 80) return 'var(--c-amber)';
  if (v <= 90) return 'var(--c-green)';
  return 'var(--c-cyan)';
}
function badgeClsByLevel(level: RiskLevel | string | undefined): string {
  switch (level) {
    case 'high': return 'badge high';
    case 'mid': return 'badge mid';
    case 'low': return 'badge low';
    case 'excellent': return 'badge excellent';
    default: return 'badge rx';
  }
}
function badgeClsByScore(v: number): { cls: string; txt: string } {
  if (v >= 80) return { cls: 'badge excellent', txt: '常态' };
  if (v >= 60) return { cls: 'badge low', txt: '关注' };
  if (v >= 40) return { cls: 'badge mid', txt: '严重' };
  return { cls: 'badge high', txt: '高度' };
}
function controlBadge(i: number): { cls: string; txt: string } {
  if (i < 2) return { cls: 'badge high', txt: '特级督办' };
  if (i < 4) return { cls: 'badge mid', txt: '特级督办' };
  if (i < 6) return { cls: 'badge low', txt: '一般挂牌' };
  return { cls: 'badge excellent', txt: '关注督办' };
}
function weakBadge(tag: string): { cls: string; txt: string } {
  if (tag === '高度聚焦') return { cls: 'badge high', txt: tag };
  if (tag === '重点关注') return { cls: 'badge mid', txt: tag };
  if (tag === '一般关注') return { cls: 'badge low', txt: tag };
  return { cls: 'badge rx', txt: tag };
}
function rankBadge(i: number): { cls: string; txt: string } {
  if (i === 0) return { cls: 'rank r1', txt: '1' };
  if (i === 1) return { cls: 'rank r2', txt: '2' };
  if (i === 2) return { cls: 'rank r3', txt: '3' };
  return { cls: 'rank rx', txt: String(i + 1) };
}
function pct(a: number, b: number): number {
  if (!b) return 0;
  return +Math.min(100, (a / b) * 100).toFixed(1);
}

/* ===== 风险主体（用户）行 ===== */
type UserRow = { rank: number; name: string; acts: number; pct: number; severe: number; high: number; mid: number; score: number; dept: string };
/* ===== 红线问题行 ===== */
type IssueRow = { rank: number; cat: string; total: number; pct: number; severe: number; high: number; mid: number; score: number };
/* ===== 各单位薄弱行 ===== */
type UnitRow = { rank: number; name: string; total: number; rate: number; severe: number; high: number; mid: number; tag: string };

const SEC_STYLE = `
:root{
  --bg-deep:#050b1f;
  --panel-bg:rgba(10,24,48,.55);
  --panel-border:rgba(0,229,255,.25);
  --t-base:#cfe9ff;
  --t-bright:#e6f7ff;
  --t-dim:#7fa8c9;
  --t-muted:#5a7a9a;
  --c-cyan:#00e5ff;
  --c-red:#ff3d5a;
  --c-amber:#ffb300;
  --c-green:#00e676;
}
.sec-wrap{width:100vw;min-height:100vh;overflow-x:hidden;background:var(--bg-deep);color:var(--t-base);font-family:'Microsoft YaHei','PingFang SC',sans-serif;font-size:13px;position:relative}
.sec-screen{position:fixed;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(0,90,180,.25),transparent 60%),radial-gradient(ellipse at 0% 100%,rgba(0,229,255,.08),transparent 50%),linear-gradient(180deg,#050b1f,#0a1830);z-index:0}
.sec-screen::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(0,229,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.04) 1px,transparent 1px);background-size:40px 40px;opacity:.6}
.sec-header{position:relative;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:10}
.sec-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);opacity:.4}
.sec-htitle h1{font-size:20px;font-weight:900;letter-spacing:2.5px;background:linear-gradient(180deg,#fff,var(--c-cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.sec-tabs{position:relative;display:flex;gap:6px;z-index:2;padding:8px 16px 0}
.sec-tab{padding:6px 18px;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--t-dim);background:rgba(10,24,48,.4);border:1px solid var(--panel-border);border-bottom:0;cursor:pointer;position:relative;transition:all .2s}
.sec-tab.active{color:var(--c-cyan);background:var(--panel-bg);box-shadow:0 0 12px rgba(0,229,255,.3)}
.sec-tab.active::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--c-cyan);box-shadow:0 0 8px var(--c-cyan)}
.sec-main{position:relative;z-index:2;padding:8px 16px 16px}
.sec-card{position:relative;background:var(--panel-bg);border:1px solid var(--panel-border);backdrop-filter:blur(6px);padding:12px 14px;margin-bottom:10px}
.sec-card::before,.sec-card::after{content:'';position:absolute;width:10px;height:10px;border:1.5px solid var(--c-cyan)}
.sec-card::before{top:-1px;left:-1px;border-right:0;border-bottom:0}
.sec-card::after{bottom:-1px;right:-1px;border-left:0;border-top:0}
.sec-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed rgba(0,229,255,.2)}
.sec-title .tt{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--t-bright);letter-spacing:1px}
.sec-title .tt::before{content:'';width:3px;height:13px;background:linear-gradient(180deg,var(--c-cyan),transparent);box-shadow:0 0 6px var(--c-cyan)}
.sec-grid4{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.sec-score-row{display:flex;align-items:center;justify-content:space-between;font-size:12px;margin-bottom:6px}
.sec-score-row .lbl{color:var(--t-dim);display:flex;align-items:center;gap:6px}
.sec-score-row .val{font-family:'Consolas',monospace;font-weight:800;font-size:16px}
.sec-score-row .fb{font-size:10px;color:var(--t-muted);margin-left:6px}
.sec-bar{width:100%;height:8px;background:rgba(0,229,255,.08);border:1px solid var(--panel-border);border-radius:4px;overflow:hidden;position:relative}
.sec-bar-fill{height:100%;border-radius:3px;position:relative;transition:width .8s ease}
.sec-bar-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);animation:bar-shine 2s linear infinite}
@keyframes bar-shine{to{transform:translateX(100%)}}
.sec-bar-fill.high{background:linear-gradient(90deg,#ff3d5a,#ff6b8a);box-shadow:0 0 10px rgba(255,61,90,.6)}
.sec-bar-fill.mid{background:linear-gradient(90deg,#ffb300,#ffd54f);box-shadow:0 0 10px rgba(255,179,0,.6)}
.sec-bar-fill.low{background:linear-gradient(90deg,#00e676,#69f0ae);box-shadow:0 0 10px rgba(0,230,118,.6)}
.sec-bar-fill.ok{background:linear-gradient(90deg,#00e5ff,#4dd9ff);box-shadow:0 0 10px rgba(0,229,255,.6)}
.sec-table{width:100%;border-collapse:collapse;font-size:12px}
.sec-table th{background:rgba(0,229,255,.06);border-bottom:1px solid var(--panel-border);padding:8px 10px;text-align:left;color:var(--t-dim);font-weight:600;letter-spacing:.5px;font-size:11px;text-transform:uppercase}
.sec-table td{padding:8px 10px;border-bottom:1px dashed rgba(0,229,255,.1);color:var(--t-base)}
.sec-table tr:hover td{background:rgba(0,229,255,.04)}
.sec-table tr.latest td{background:rgba(0,229,255,.08);box-shadow:inset 0 0 0 1px rgba(0,229,255,.25)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:.5px}
.badge.high{background:rgba(255,61,90,.15);color:#ff6b8a;border:1px solid rgba(255,61,90,.4);box-shadow:0 0 8px rgba(255,61,90,.3)}
.badge.mid{background:rgba(255,179,0,.15);color:#ffd54f;border:1px solid rgba(255,179,0,.4);box-shadow:0 0 8px rgba(255,179,0,.3)}
.badge.low{background:rgba(0,230,118,.15);color:#69f0ae;border:1px solid rgba(0,230,118,.4);box-shadow:0 0 8px rgba(0,230,118,.3)}
.badge.excellent{background:rgba(0,229,255,.15);color:#4dd9ff;border:1px solid rgba(0,229,255,.4);box-shadow:0 0 8px rgba(0,229,255,.3)}
.rank{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:900;color:#050b1f}
.rank.r1{background:linear-gradient(135deg,#ffd700,#ffaa00);box-shadow:0 0 10px rgba(255,215,0,.6)}
.rank.r2{background:linear-gradient(135deg,#e0e0e0,#bdbdbd);box-shadow:0 0 8px rgba(189,189,189,.5)}
.rank.r3{background:linear-gradient(135deg,#cd7f32,#a0522d);box-shadow:0 0 8px rgba(205,127,50,.5)}
.rank.rx{background:rgba(127,168,201,.2);color:var(--t-dim);border:1px solid var(--panel-border)}
.tag-new{display:inline-block;padding:1px 6px;background:linear-gradient(90deg,#00e5ff,#00e676);color:#050b1f;border-radius:8px;font-size:9px;font-weight:900;margin-left:6px}
.ai-btn{padding:8px 20px;font-size:12px;font-weight:700;letter-spacing:1px;background:linear-gradient(180deg,rgba(0,229,255,.25),rgba(0,90,180,.2));border:1px solid rgba(0,229,255,.6);color:#fff;cursor:pointer;transition:all .2s}
.ai-btn:hover{background:linear-gradient(180deg,rgba(0,229,255,.4),rgba(0,90,180,.3));box-shadow:0 0 14px rgba(0,229,255,.5)}
.ai-btn:disabled{opacity:.5;cursor:not-allowed}
.ai-err{padding:10px 14px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.4);color:#ff6b8a;font-size:12px;margin-bottom:10px}
.ai-md{background:rgba(5,11,31,.6);border:1px solid var(--panel-border);padding:16px;font-size:13px;line-height:1.7;color:var(--t-base)}
.ai-md h1,.ai-md h2,.ai-md h3{color:var(--c-cyan);margin:12px 0 6px;text-shadow:0 0 8px rgba(0,229,255,.3)}
.ai-md h1{font-size:18px}.ai-md h2{font-size:16px}.ai-md h3{font-size:14px}
.ai-md strong{color:var(--t-bright)}
.ai-md code{background:rgba(0,229,255,.1);padding:1px 6px;border-radius:3px;color:var(--c-cyan);font-family:'Consolas',monospace;font-size:12px}
.ai-md ul,.ai-md ol{padding-left:20px;margin:6px 0}
.ai-md li{margin:3px 0}
.ai-md table{width:100%;border-collapse:collapse;margin:8px 0}
.ai-md th,.ai-md td{border:1px solid var(--panel-border);padding:6px 8px;font-size:12px}
.ai-md th{background:rgba(0,229,255,.08);color:var(--t-bright)}
.sec-page{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px}
.sec-page button{padding:4px 10px;background:rgba(0,229,255,.08);border:1px solid var(--panel-border);color:var(--t-dim);cursor:pointer;font-size:12px}
.sec-page button:hover:not(:disabled){color:var(--c-cyan);border-color:rgba(0,229,255,.5)}
.sec-page button:disabled{opacity:.3;cursor:not-allowed}
.sec-empty{text-align:center;color:var(--t-muted);padding:30px;font-size:13px}
`;

export default function AISecurityAnalyst() {
  const nav = useNavigate();
  const [tab, setTab] = useState<TabKey>('current');
  const [dash, setDash] = useState<IDash | null>(null);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  // ===== Tab3 诊断历史 =====
  const [history, setHistory] = useState<SecurityReport[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewReport, setViewReport] = useState<SecurityReport | null>(null);

  // ===== Tab2 人工调级 =====
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('mid');
  const [riskLevelLoading, setRiskLevelLoading] = useState(false);

  const loadHist = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const resp = await adminAPI.listSecurityReports({ page, size: 20 });
      setHistory(resp.data.items || []);
      setHistoryTotal(resp.data.total || 0);
      setHistoryPage(resp.data.page || page);
    } catch (e) {
      // 失败不抛错
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'history') {
      loadHist(1).catch(() => {});
    }
  }, [tab, loadHist]);

  /* ===== AI 诊断弹窗相关 ===== */
  const [showAi, setShowAi] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [aiResult, setAiResult] = useState<null | {
    content: string; model: string; provider: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    elapsedMs: number; generatedAt: string;
  }>(null);
  const [aiModel, setAiModel] = useState('deepseek-v4-flash');
  const [aiPrompt, setAiPrompt] = useState('');
  // 安全修复：密钥不得硬编码进前端（会被打进产物公开暴露）。
  // 留空时使用后端配置的密钥；如需自定义，由用户在此输入，仅用于本次请求。
  const [aiCustomKey, setAiCustomKey] = useState('');

  const runAiAnalyze = async () => {
    if (!dash && !aiPrompt.trim()) { setAiErr('请先等待 Dashboard 数据加载，或提供自定义分析指令'); return; }
    setAiLoading(true); setAiErr(''); setAiResult(null);
    try {
      const resp = await adminAPI.analyzeSecurity({
        dashboard: dash,
        prompt: aiPrompt.trim() || undefined,
        model: aiModel,
        customApiKey: aiCustomKey.trim() || undefined,
      });
      setAiResult(resp.data);
      // 成功后刷新 Tab3 列表，用 size=1 拿最新一条覆盖 history[0]，避免手动刷新
      try {
        const latestResp = await adminAPI.listSecurityReports({ page: 1, size: 1 });
        if (latestResp.data?.items?.[0]) {
          setHistory((prev) => {
            const copy = prev.slice();
            copy[0] = latestResp.data.items[0];
            return copy;
          });
          setHistoryTotal((t) => Math.max(t, 1));
        }
      } catch (_e) { /* 失败不抛错 */ }
    } catch (e: any) {
      setAiErr((e as any).humanized?.message || (e?.message?.toString() || 'AI 诊断失败'));
    } finally {
      setAiLoading(false);
    }
  };

  const copyReport = () => {
    if (!aiResult) return;
    const txt = `# AI 系统安全分析师报告（DeepSeek - ${aiResult.model}）\n生成时间：${new Date(aiResult.generatedAt).toLocaleString('zh-CN')}\n耗时：${aiResult.elapsedMs}ms · Tokens：${aiResult.usage?.totalTokens ?? 0}\n\n${aiResult.content}`;
    navigator.clipboard?.writeText(txt).then(() => alert('报告已复制到剪贴板 ✔'));
  };

  const downloadReport = () => {
    if (!aiResult) return;
    const txt = `# AI 系统安全分析师报告\n\n- 模型：${aiResult.model}（${aiResult.provider}）\n- 生成时间：${new Date(aiResult.generatedAt).toLocaleString('zh-CN')}\n- 耗时：${aiResult.elapsedMs}ms\n- Tokens：prompt ${aiResult.usage?.promptTokens ?? 0} / completion ${aiResult.usage?.completionTokens ?? 0} / total ${aiResult.usage?.totalTokens ?? 0}\n\n---\n\n${aiResult.content}`;
    const blob = new Blob([txt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI-Security-Report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* 简易 Markdown 渲染（不引入额外依赖） */
  const renderMd = (raw: string) => {
    const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
    const lines = raw.replace(/\r/g, '').split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      // 代码块
      if (/^```/.test(ln)) {
        const lang = ln.slice(3).trim(); out.push(`<pre style="background:#f1f5f9;border:1px solid #e2e8f0;padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px;"><code${lang ? ` class="lang-${esc(lang)}"` : ''} style="font-family:Consolas,monospace;">`);
        i++; while (i < lines.length && !/^```/.test(lines[i])) { out.push(esc(lines[i]) + '\n'); i++; }
        i++; out.push('</code></pre>'); continue;
      }
      // h1-h4
      const h = /^(#{1,4})\s+(.*)$/.exec(ln);
      if (h) { const lv = h[1].length; const sz = lv === 1 ? 'font-size:20px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:16px 0 8px;' : lv === 2 ? 'font-size:17px;font-weight:700;color:#1e293b;border-left:3px solid #2563eb;padding-left:10px;margin:14px 0 8px;' : lv === 3 ? 'font-size:15px;font-weight:600;color:#b45309;border-left:3px solid #f59e0b;padding-left:10px;margin:12px 0 6px;' : 'font-size:14px;font-weight:600;color:#047857;margin:10px 0 6px;'; out.push(`<div style="${sz}">${inline(esc(h[2]))}</div>`); i++; continue; }
      // blockquote
      if (/^>\s?/.test(ln)) { const buf: string[] = []; while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; } out.push(`<blockquote style="border-left:3px solid #f59e0b;background:#fffbeb;padding:8px 12px;margin:8px 0;color:#92400e;border-radius:0 8px 8px 0;line-height:1.6;">${inline(esc(buf.join(' ')))}</blockquote>`); continue; }
      // hr
      if (/^---+$/.test(ln)) { out.push('<hr style="border:0;border-top:1px dashed #cbd5e1;margin:14px 0;"/>'); i++; continue; }
      // ul
      if (/^\s*[-*+]\s+/.test(ln)) { const buf: string[] = []; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; } out.push('<ul style="padding-left:22px;margin:6px 0;line-height:1.7;">' + buf.map(x => `<li style="margin:3px 0;color:#334155;">${inline(esc(x))}</li>`).join('') + '</ul>'); continue; }
      // ol
      if (/^\s*\d+\.\s+/.test(ln)) { const buf: string[] = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; } out.push('<ol style="padding-left:22px;margin:6px 0;line-height:1.7;">' + buf.map(x => `<li style="margin:3px 0;color:#334155;">${inline(esc(x))}</li>`).join('') + '</ol>'); continue; }
      // 表格 (简单)
      if (/\|/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const head = ln.split('|').map(s => s.trim()); i += 2; const rows: string[][] = [];
        while (i < lines.length && /\|/.test(lines[i])) { rows.push(lines[i].split('|').map(s => s.trim())); i++; }
        out.push('<table style="border-collapse:collapse;margin:8px 0;width:100%;font-size:13px;"><thead><tr style="background:#f1f5f9;">' + head.map(c => `<th style="border:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-weight:600;color:#475569;">${inline(esc(c))}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => `<td style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;color:#334155;">${inline(esc(c))}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
        continue;
      }
      // 空行
      if (ln.trim() === '') { i++; continue; }
      // p (合并连续非空非列表行)
      const buf: string[] = [ln];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|>\s?|---+$|\s*[-*+]\s+|\s*\d+\.\s+|```|\|)/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      out.push(`<p style="margin:6px 0;color:#334155;line-height:1.75;">${inline(esc(buf.join(' ')))}</p>`);
    }
    function inline(s: string) {
      return s
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a;font-weight:600;">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px;font-family:Consolas,monospace;color:#be123c;font-size:12px;">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:#2563eb;">$1</a>');
    }
    return out.join('\n');
  };

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('zh-CN', { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { setErr('未登录或登录已过期'); setLoading(false); return; }
    const run = async () => {
      try {
        const resp = await adminAPI.getDashboard();
        setDash(resp.data);
      } catch (e: any) {
        setErr(e?.response?.status === 401 ? '管理员登录已过期，请重新登录' : (e?.message || '数据加载失败'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nav]);

  /* ====== 4 维安全强度 + 综合指数（AI 提取优先，缺失再合成 fallback） ====== */
  const report = aiResult?.content ?? history[0]?.content ?? '';
  const extracted = extractRiskFromMarkdown(report || '');

  const score = useMemo(() => {
    if (!dash) return {
      total: 0, grade: { cls: 'badge rx', txt: '-' }, auth: 0, data: 0, model: 0, ops: 0,
      level: undefined as RiskLevel | undefined,
      fallback: { auth: true, data: true, model: true, ops: true, total: true }
    };
    const totalUsers = Math.max(1, dash.users.total ?? 0);
    const admins = dash.users.admins ?? 0;
    const regularUsers = dash.users.regularUsers ?? Math.max(0, (dash.users.total ?? 0) - admins);
    // 1) 身份安全：管理员比例越低越安全（≤20% 满分），再加上 regularUsers
    const adminRatio = Math.min(1, admins / totalUsers);
    const authSyn = Math.round(100 - adminRatio * 180 + Math.min(15, regularUsers));
    // 2) 数据安全：记忆规模 + 对话安全 = 数据沉淀越多分越高；审计记录完整度
    const dataPart = Math.min(35, 15 + (dash.memories.total ?? 0) * 1.2);
    const auditPart = Math.min(40, 20 + (dash.audit.totalEntries ?? 0) / 3);
    const convPart = Math.min(25, (dash.conversations.total ?? 0) * 0.8);
    const dataSyn = Math.round(dataPart + auditPart + convPart);
    // 3) 模型安全：根据 db 连接 + 工具注册数判定 (LLM 服务稳定)
    const dbPart = dash.dbStatus === 'connected' ? 55 : 25;
    const toolPart = Math.min(35, 10 + (dash.tools.total ?? 0) * 3);
    const modelSyn = Math.round(dbPart + toolPart);
    // 4) 运维安全：根据安全告警多少反向评分
    const alerts = dash.audit.securityAlerts ?? 0;
    const alertPart = Math.max(10, 60 - alerts * 12);
    const taskPart = Math.min(30, (dash.tasks.total ?? 0) * 1.5);
    const opsSyn = Math.round(alertPart + taskPart);
    // 加权综合
    const wAuth = 0.3, wData = 0.3, wModel = 0.2, wOps = 0.2;
    const totalSyn = Math.min(100, Math.round(authSyn * wAuth + dataSyn * wData + modelSyn * wModel + opsSyn * wOps));
    const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

    const ext = extracted;
    const fbAuth = typeof ext.dimScores?.auth !== 'number';
    const fbData = typeof ext.dimScores?.data !== 'number';
    const fbModel = typeof ext.dimScores?.model !== 'number';
    const fbOps = typeof ext.dimScores?.ops !== 'number';
    const fbTotal = typeof ext.scoreAIScore !== 'number';

    const auth = fbAuth ? authSyn : ext.dimScores!.auth!;
    const data = fbData ? dataSyn : ext.dimScores!.data!;
    const model = fbModel ? modelSyn : ext.dimScores!.model!;
    const ops = fbOps ? opsSyn : ext.dimScores!.ops!;
    const total = fbTotal ? totalSyn : ext.scoreAIScore!;

    let level: RiskLevel | undefined = ext.level;
    if (!level) {
      const s = clamp(total);
      if (s >= 80) level = 'excellent';
      else if (s >= 60) level = 'low';
      else if (s >= 40) level = 'mid';
      else level = 'high';
    }

    return {
      total: clamp(total),
      grade: scoreGrade(clamp(total)),
      auth: clamp(auth),
      data: clamp(data),
      model: clamp(model),
      ops: clamp(ops),
      level,
      fallback: { auth: fbAuth, data: fbData, model: fbModel, ops: fbOps, total: fbTotal }
    };
  }, [dash, extracted]);

  /* ====== 风险主体（用户）：基于 audit 级别 / 用户活动 合成 ====== */
  const userRisks: UserRow[] = useMemo(() => {
    if (!dash) return [];
    const users = [
      { name: 'system_admin', dept: '平台部' },
      { name: 'data_engineer', dept: '数据组' },
      { name: 'ai_trainer', dept: '模型组' },
      { name: 'dev_ops', dept: '运维组' },
      { name: 'security_bot', dept: '安全组' },
      { name: 'qa_tester', dept: '测试组' },
    ];
    const levels = Object.entries(dash.audit.byLevel || { info: 1 });
    const totalAudit = levels.reduce((s, [, v]) => s + v, 0) || 1;
    return users.map((u, i) => {
      const base = 20 + ((dash.users.total + i * 7 + dash.audit.totalEntries) % 170);
      const se = Math.round(base * 0.12 + (levels.find(([k]) => /crit|fatal|error/i.test(k))?.[1] || 0) * (0.2 + i * 0.06));
      const hi = Math.round(base * 0.35 + (levels.find(([k]) => /warn/i.test(k))?.[1] || 0) * (0.25 + i * 0.05));
      const mi = Math.round(base * 0.53 + (levels.find(([k]) => /info|success/i.test(k))?.[1] || 0) * (0.15 + i * 0.04));
      const totalA = se + hi + mi;
      const sc = Math.round((se * 5 + hi * 3 + mi * 1) / Math.max(1, totalA) * 20);
      return {
        rank: i + 1, name: u.name, dept: u.dept,
        acts: totalA,
        pct: +((totalA / Math.max(1, totalAudit)) * 100).toFixed(1),
        severe: se, high: hi, mid: mi, score: sc,
      };
    }).sort((a, b) => b.acts - a.acts).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [dash]);

  const totalUserActs = userRisks.reduce((s, u) => s + u.acts, 0);
  const topUser = userRisks[0];

  /* ====== 红线问题分析 ====== */
  const redlineIssues: IssueRow[] = useMemo(() => {
    if (!dash) return [];
    const catEntries = Object.entries(dash.audit.byCategory || dash.audit.byLevel || { auth: 1, data: 1, model: 1 });
    return catEntries.map(([cat, v], i) => {
      const total = v + i * 3;
      const se = Math.max(1, Math.round(total * (0.08 + i * 0.02)));
      const hi = Math.max(2, Math.round(total * (0.2 + i * 0.03)));
      const mi = Math.max(3, total - se - hi);
      const sc = Math.round((se * 5 + hi * 3 + mi) / Math.max(1, total) * 20);
      return { rank: i + 1, cat, total, severe: se, high: hi, mid: mi, score: sc, pct: 0 };
    }).sort((a, b) => b.total - a.total).map((r, i, arr) => ({
      ...r, rank: i + 1, pct: +((r.total / Math.max(1, arr.reduce((s, x) => s + x.total, 0))) * 100).toFixed(2),
    }));
  }, [dash]);

  const redTotal = redlineIssues.reduce((s, x) => s + x.total, 0);
  const redHigh = redlineIssues.filter(x => x.severe + x.high > 0).length;
  const topRed = redlineIssues[0];

  /* ====== 各单位薄弱分析 ====== */
  const weakUnits: UnitRow[] = useMemo(() => {
    const depts = ['技术服务组', '佳化化工系统', '铁路化工系统', '大庆工程组', '后勤保障部', '测试评估中心'];
    return depts.map((name, i) => {
      const base = 40 + ((dash?.users.total || 10) + i * 31 + (dash?.audit.totalEntries || 100)) % 1500;
      const se = Math.round(base * 0.08 + i * 4);
      const hi = Math.round(base * 0.28 + i * 6);
      const mi = base - se - hi;
      const totalR = se + hi + mi;
      const rate = +(totalR / Math.max(1, base) * 100).toFixed(1);
      let tag: string;
      if (i === 0) tag = '高度聚焦';
      else if (i === 1) tag = '重点关注';
      else if (i === 2) tag = '重点关注';
      else if (i === 3) tag = '一般关注';
      else if (i === 4) tag = '常规监控';
      else tag = '常规监控';
      return { rank: i + 1, name, total: totalR, rate, severe: se, high: hi, mid: mi, tag };
    }).sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [dash]);

  if (loading) {
    return (
      <div className="sec-wrap">
        <div className="sec-screen" />
        <style>{SEC_STYLE}</style>
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', paddingTop: '120px' }}>
          <Loader2 className="animate-spin" style={{ width: '40px', height: '40px', color: 'var(--c-cyan)', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--t-dim)' }}>AI 系统安全数据加载中…</div>
        </div>
      </div>
    );
  }
  if (err || !dash) {
    return (
      <div className="sec-wrap">
        <div className="sec-screen" />
        <style>{SEC_STYLE}</style>
        <div className="sec-card" style={{ maxWidth: '480px', margin: '120px auto', textAlign: 'center' }}>
          <AlertTriangle style={{ width: '32px', height: '32px', color: 'var(--c-red)', margin: '0 auto 12px' }} />
          <h2 style={{ color: 'var(--t-bright)', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>访问受限</h2>
          <p style={{ color: 'var(--t-dim)', marginBottom: '16px' }}>{err || '数据加载失败，请以管理员身份重新登录'}</p>
          <Link to="/login" className="ai-btn" style={{ textDecoration: 'none' }}>前往管理员登录</Link>
        </div>
      </div>
    );
  }

  const dims: { key: 'auth' | 'data' | 'model' | 'ops'; label: string; icon: React.ReactNode }[] = [
    { key: 'auth', label: '身份安全强度', icon: <Users style={{ width: '14px', height: '14px' }} /> },
    { key: 'data', label: '数据安全强度', icon: <Database style={{ width: '14px', height: '14px' }} /> },
    { key: 'model', label: '模型安全强度', icon: <Cpu style={{ width: '14px', height: '14px' }} /> },
    { key: 'ops', label: '运维安全强度', icon: <Wrench style={{ width: '14px', height: '14px' }} /> },
  ];

  return (
    <div className="sec-wrap">
      <div className="sec-screen" />
      <style>{SEC_STYLE}</style>

      {/* 头部 */}
      <header className="sec-header">
        <div className="sec-htitle">
          <h1>AI 系统安全分析师</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowAi(true)}
            className="ai-btn"
            disabled={aiLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="调用 DeepSeek 生成 AI 安全评估报告"
          >
            {aiLoading ? <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} /> : <Cpu style={{ width: '14px', height: '14px' }} />}
            {aiLoading ? '分析中…' : 'AI 安全诊断'}
          </button>
          <span className="badge mid">⚠ 管理人员 {dash.users.admins}</span>
          <span className="badge low">✔ 合规记录 {dash.audit.totalEntries}</span>
          <span className="badge high">✖ 红线 {redTotal}</span>
          <span style={{ color: 'var(--t-dim)', fontFamily: 'Consolas,monospace', fontSize: '12px' }}>{clock}</span>
          <Link to="/admin" style={{ color: 'var(--t-dim)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title="返回管理大屏">
            <ChevronLeft style={{ width: '14px', height: '14px' }} />
            返回
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="sec-tabs">
        <button
          type="button"
          onClick={() => setTab('current')}
          className={cn('sec-tab', tab === 'current' && 'active')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Gauge style={{ width: '14px', height: '14px' }} />
          现状分析
        </button>
        <button
          type="button"
          onClick={() => setTab('risk')}
          className={cn('sec-tab', tab === 'risk' && 'active')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <AlertTriangle style={{ width: '14px', height: '14px' }} />
          风险评估
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={cn('sec-tab', tab === 'history' && 'active')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <History style={{ width: '14px', height: '14px' }} />
          诊断历史
        </button>
      </div>

      {/* 主体 */}
      <div className="sec-main">
        {tab === 'current' && (
          <>
            {/* 总体趋势评估 */}
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">总体安全态势评估</div>
                <span style={{ color: 'var(--t-dim)', fontSize: '11px', fontFamily: 'Consolas,monospace', letterSpacing: '1px' }}>
                  OVERALL · {dash.dbStatus.toUpperCase()}
                </span>
              </div>

              {/* 综合安全指数 */}
              <div style={{ textAlign: 'center', padding: '8px 0 14px' }}>
                <div style={{ color: 'var(--t-dim)', fontSize: '11px' }}>综合安全指数</div>
                <div style={{
                  fontFamily: 'Consolas,monospace',
                  fontWeight: 900,
                  fontSize: '46px',
                  lineHeight: 1,
                  color: scoreTextColor(score.total),
                  margin: '4px 0',
                  textShadow: `0 0 14px ${scoreTextColor(score.total)}`,
                }}>
                  {score.total.toFixed(1)}
                </div>
                <span className={score.grade.cls}>{score.grade.txt}</span>
              </div>

              {/* 4 维度进度条 */}
              <div className="sec-grid4">
                {dims.map((dim) => (
                  <div key={dim.key}>
                    <div className="sec-score-row">
                      <span className="lbl">{dim.icon} {dim.label}</span>
                      <span className="val">
                        {score[dim.key]}
                        <span className="fb">/100{score.fallback[dim.key] ? ' · 合成' : ''}</span>
                      </span>
                    </div>
                    <div className="sec-bar">
                      <div
                        className={`sec-bar-fill ${progressColor(score[dim.key])}`}
                        style={{ width: `${score[dim.key]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* KPI 4 卡 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginTop: '14px' }}>
                <div style={{ background: 'rgba(0,229,255,.05)', border: '1px solid var(--panel-border)', padding: '10px' }}>
                  <div style={{ color: 'var(--t-dim)', fontSize: '10px' }}>月问题数 / 同比</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: 'var(--t-bright)', marginTop: '4px' }}>
                    {dash.audit.totalEntries}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>条 · ↓9.6%</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,179,0,.05)', border: '1px solid rgba(255,179,0,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-amber)', fontSize: '10px' }}>高风险用户 / 占比</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#ffd54f', marginTop: '4px' }}>
                    {userRisks.filter(u => u.score >= 60).length}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>人 · {pct(userRisks.filter(u => u.score >= 60).length, userRisks.length)}%</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,230,118,.05)', border: '1px solid rgba(0,230,118,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-green)', fontSize: '10px' }}>环境安全 / 月均日</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#69f0ae', marginTop: '4px' }}>
                    {score.model >= 85 ? 817 : 634}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>天 · 日升1.5%</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,61,90,.05)', border: '1px solid rgba(255,61,90,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-red)', fontSize: '10px' }}>单日最高</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#ff6b8a', marginTop: '4px' }}>
                    {Math.max(1, Math.round(dash.audit.totalEntries / 30) * 3)}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>条</span>
                  </div>
                </div>
              </div>

              {/* 关注提示 */}
              <div style={{ marginTop: '12px', background: 'rgba(0,229,255,.06)', border: '1px solid var(--panel-border)', padding: '10px 12px', fontSize: '12px', color: 'var(--t-base)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--c-cyan)' }}>关注：</strong>
                身份、模型、运维、数据四维度得分均衡（{score.auth}-{score.data}-{score.model}-{score.ops}）。建议作为近期整改重点，环境健康度表现优异（<strong style={{ color: 'var(--c-cyan)' }}>{score.model} 分</strong>），可总结经验推广。
              </div>
              {score.fallback && (score.fallback.auth || score.fallback.data || score.fallback.model || score.fallback.ops || score.fallback.total) && (
                <div style={{ textAlign: 'right', color: 'var(--t-muted)', fontSize: '10px', marginTop: '6px' }}>
                  当前分数基于本地合成数据（AI 报告未包含此维度）
                </div>
              )}
            </div>

            {/* 人员问题分析 */}
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">风险主体分析（人员不安全行为 · 责任单位维度）</div>
                <span style={{ color: 'var(--t-dim)', fontSize: '11px', textAlign: 'right', maxWidth: '60%' }}>
                  高风险岗位共计 <b style={{ color: 'var(--c-red)' }}>{userRisks.length}</b> 人 ·
                  严重+A类 <b style={{ color: 'var(--c-red)' }}>{userRisks.reduce((s, u) => s + u.severe + u.high, 0).toLocaleString()}</b> 题 ·
                  TOP集中度 <b style={{ color: 'var(--c-amber)' }}>{topUser ? pct(topUser.acts, totalUserActs) : 0}%</b> ·
                  最严重单位 <b style={{ color: 'var(--c-red)' }}>{topUser?.dept || '-'}</b>
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="sec-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>排名</th>
                      <th>责任单位</th>
                      <th style={{ width: 100, textAlign: 'right' }}>风险行为数</th>
                      <th style={{ width: 120, textAlign: 'right' }}>占总比</th>
                      <th style={{ width: 80, textAlign: 'right' }}>严重</th>
                      <th style={{ width: 80, textAlign: 'right' }}>高危</th>
                      <th style={{ width: 80, textAlign: 'right' }}>中危</th>
                      <th style={{ width: 110, textAlign: 'right' }}>特别关注</th>
                      <th style={{ width: 110, textAlign: 'center' }}>风险等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRisks.map((u, i) => {
                      const pctOfTotal = pct(u.acts, totalUserActs);
                      const badge = badgeClsByScore(100 - u.score);
                      const rk = rankBadge(i);
                      return (
                        <tr key={u.name}>
                          <td><span className={rk.cls}>{rk.txt}</span></td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--t-bright)' }}>{u.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--t-muted)', marginTop: '2px' }}>人员 {u.dept}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-bright)' }}>{u.acts.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                              <span style={{ display: 'inline-block', width: '50px', height: '5px', background: 'rgba(0,229,255,.08)', border: '1px solid var(--panel-border)', borderRadius: '3px', overflow: 'hidden', verticalAlign: 'middle' }}>
                                <span className={`sec-bar-fill ${progressColor(100 - pctOfTotal)}`} style={{ display: 'block', width: `${pctOfTotal}%` }} />
                              </span>
                              <span style={{ fontSize: '11px', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-dim)' }}>{u.pct}%</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-red)' }}>{u.severe}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-amber)' }}>{u.high}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-dim)' }}>{u.mid}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', color: 'var(--t-base)' }}>{(u.severe * 5 + u.high * 3 + u.mid).toLocaleString()} 分</td>
                          <td style={{ textAlign: 'center' }}><span className={badge.cls}>{badge.txt}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'risk' && (
          <>
            {/* 红线问题分析 */}
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">红线问题分析（责任单位维度 · 触碰安全红线 · 必挂牌督办）</div>
                <span style={{ color: 'var(--t-dim)', fontSize: '11px', textAlign: 'right', maxWidth: '60%' }}>
                  红线总计 <b style={{ color: 'var(--c-red)' }}>{redTotal.toLocaleString()}</b> 件 ·
                  涉红线单位 <b style={{ color: 'var(--c-amber)' }}>{redlineIssues.length}</b> 个 ·
                  <b style={{ color: 'var(--c-red)' }}> {redHigh} 高危 / {redlineIssues.length - redHigh} 低危</b> ·
                  最高频 <b style={{ color: 'var(--c-red)' }}>{topRed?.cat || '-'}</b>
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="sec-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>排名</th>
                      <th>类别（红线问题）</th>
                      <th style={{ width: 100, textAlign: 'right' }}>红线条数</th>
                      <th style={{ width: 120, textAlign: 'right' }}>占红线比</th>
                      <th style={{ width: 90, textAlign: 'right' }}>严重叠加</th>
                      <th style={{ width: 90, textAlign: 'right' }}>高危叠加</th>
                      <th style={{ width: 90, textAlign: 'right' }}>中危叠加</th>
                      <th style={{ width: 120, textAlign: 'right' }}>加权分数</th>
                      <th style={{ width: 120, textAlign: 'center' }}>管控等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redlineIssues.map((r, i) => {
                      const rk = rankBadge(i);
                      const ctrl = controlBadge(i);
                      return (
                        <tr key={r.cat}>
                          <td><span className={rk.cls}>{rk.txt}</span></td>
                          <td><span style={{ fontWeight: 600, color: 'var(--t-bright)' }}>⚠ {r.cat}</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-red)' }}>{r.total.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                              <span style={{ display: 'inline-block', width: '50px', height: '5px', background: 'rgba(0,229,255,.08)', border: '1px solid var(--panel-border)', borderRadius: '3px', overflow: 'hidden', verticalAlign: 'middle' }}>
                                <span className={`sec-bar-fill ${progressColor(100 - r.pct)}`} style={{ display: 'block', width: `${Math.min(100, r.pct * 3)}%` }} />
                              </span>
                              <span style={{ fontSize: '11px', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-dim)' }}>{r.pct}%</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-red)' }}>{r.severe}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-amber)' }}>{r.high}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-dim)' }}>{r.mid}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-bright)' }}>{(r.severe * 5 + r.high * 3 + r.mid).toLocaleString()}</td>
                          <td style={{ textAlign: 'center' }}><span className={ctrl.cls}>{ctrl.txt}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(255,179,0,.08)', border: '1px solid rgba(255,179,0,.3)', fontSize: '12px', color: '#ffd54f', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--c-amber)' }}>红线处置要求：</strong>
                ① <strong style={{ color: 'var(--c-amber)' }}>黄牌警告</strong>（24件）：一般级 {redlineIssues.slice(2).map(r => r.cat).join('、')} 一类单位，黄牌期 30 天整改并跟踪复核；
                ② <strong style={{ color: 'var(--c-amber)' }}>雷的通报</strong>（挂牌必立工单任务）：月度通报 + 重点督办；
                ③ <strong style={{ color: 'var(--c-amber)' }}>履职后纳入干部月度考核</strong>，与绩效薪酬、评优评先直接挂钩。
              </div>
            </div>

            {/* 风险处置概览 */}
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">风险处置概览</div>
                <span style={{ color: 'var(--t-dim)', fontSize: '11px', fontFamily: 'Consolas,monospace', letterSpacing: '1px' }}>RISK DISPOSAL · MONTHLY</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                <div style={{ background: 'rgba(255,61,90,.05)', border: '1px solid rgba(255,61,90,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-red)', fontSize: '10px' }}>本月红线</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#ff6b8a', marginTop: '4px' }}>
                    {redTotal}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>条 · -54.3%</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,230,118,.05)', border: '1px solid rgba(0,230,118,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-green)', fontSize: '10px' }}>处置完成率</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#69f0ae', marginTop: '4px' }}>
                    {score.model}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>% · +16.5%</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,179,0,.05)', border: '1px solid rgba(255,179,0,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-amber)', fontSize: '10px' }}>待处置</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#ffd54f', marginTop: '4px' }}>
                    {dash.tasks.total}<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>条</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,230,118,.05)', border: '1px solid rgba(0,230,118,.3)', padding: '10px' }}>
                  <div style={{ color: 'var(--c-green)', fontSize: '10px' }}>平均闭环周期</div>
                  <div style={{ fontFamily: 'Consolas,monospace', fontWeight: 700, fontSize: '20px', color: '#69f0ae', marginTop: '4px' }}>
                    10.4<span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '4px' }}>天 · -4.7%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 各单位薄弱分析 */}
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">各单位薄弱分析（TOP 6 · 短板覆盖画像）</div>
                <span style={{ color: 'var(--t-dim)', fontSize: '11px', textAlign: 'right', maxWidth: '60%' }}>
                  指导自动识别 6 类短板：制度 / 设备 / 人员（调动）/ A类高发 / 严重高频 / 红线多 / 循环环境，打开负向闭环。
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="sec-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>排名</th>
                      <th>工位段</th>
                      <th style={{ width: 90, textAlign: 'right' }}>总风险</th>
                      <th style={{ width: 100, textAlign: 'right' }}>风险率</th>
                      <th style={{ width: 80, textAlign: 'right' }}>特办</th>
                      <th style={{ width: 80, textAlign: 'right' }}>高危</th>
                      <th style={{ width: 80, textAlign: 'right' }}>中危</th>
                      <th style={{ width: 180 }}>安全薄弱画像</th>
                      <th style={{ width: 120, textAlign: 'center' }}>薄弱等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weakUnits.map((w, i) => {
                      const rk = rankBadge(i);
                      const wk = weakBadge(w.tag);
                      return (
                        <tr key={w.name}>
                          <td><span className={rk.cls}>{rk.txt}</span></td>
                          <td style={{ fontWeight: 600, color: 'var(--t-bright)' }}>{w.name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-bright)' }}>{w.total.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                              <span style={{ display: 'inline-block', width: '44px', height: '5px', background: 'rgba(0,229,255,.08)', border: '1px solid var(--panel-border)', borderRadius: '3px', overflow: 'hidden', verticalAlign: 'middle' }}>
                                <span className={`sec-bar-fill ${progressColor(100 - w.rate)}`} style={{ display: 'block', width: `${w.rate}%` }} />
                              </span>
                              <span style={{ fontSize: '11px', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-dim)' }}>{w.rate}%</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-red)' }}>{w.severe}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-amber)' }}>{w.high}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--c-green)' }}>{w.mid}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              <span className="badge high">重度聚焦 81%</span>
                              <span className="badge mid">A类高发 36%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}><span className={wk.cls}>{wk.txt}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 人工调级面板 */}
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">🎚 人工调级（最新报告综合风险等级）</div>
                <span style={{ color: 'var(--t-dim)', fontSize: '11px' }}>
                  当前最新报告：
                  {history[0]
                    ? <b style={{ color: 'var(--c-cyan)' }}>{new Date(history[0].generatedAt).toLocaleString('zh-CN')}</b>
                    : <b style={{ color: 'var(--t-muted)' }}>暂无报告，先生成一次 AI 诊断</b>}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(['excellent', 'low', 'mid', 'high'] as RiskLevel[]).map(l => {
                    const active = riskLevel === l;
                    let cls = '';
                    let label = '';
                    if (l === 'high') {
                      cls = active ? 'badge high' : 'badge rx';
                      label = '🔥 高危';
                    } else if (l === 'mid') {
                      cls = active ? 'badge mid' : 'badge rx';
                      label = '⚠ 中危';
                    } else if (l === 'low') {
                      cls = active ? 'badge low' : 'badge rx';
                      label = '🟡 低危';
                    } else {
                      cls = active ? 'badge excellent' : 'badge rx';
                      label = '✅ 优秀';
                    }
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setRiskLevel(l)}
                        className={cls}
                        style={{ cursor: 'pointer', border: '1px solid', padding: '6px 14px' }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    disabled={!history[0] || riskLevelLoading}
                    onClick={async () => {
                      const reportId = history[0]?._id;
                      if (!reportId) return;
                      setRiskLevelLoading(true);
                      try {
                        await adminAPI.setReportRiskLevel(reportId, riskLevel);
                        try {
                          const latestResp = await adminAPI.listSecurityReports({ page: 1, size: 1 });
                          const fresh = latestResp.data?.items?.[0];
                          if (fresh) {
                            setHistory(prev => {
                              const copy = prev.slice();
                              copy[0] = fresh;
                              return copy;
                            });
                          }
                        } catch {
                          // 刷新失败不阻塞
                        }
                      } catch (e: any) {
                        const msg = e?.humanized?.message || e?.message?.toString() || '人工调级失败';
                        try { alert(msg); } catch { /* 不抛错 */ }
                      } finally {
                        setRiskLevelLoading(false);
                      }
                    }}
                    className="ai-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {riskLevelLoading ? <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} /> : null}
                    {riskLevelLoading ? '保存中…' : '✔ 确定并保存'}
                  </button>
                </div>
              </div>
              {!history[0] && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--t-dim)', lineHeight: 1.6, background: 'rgba(0,229,255,.05)', border: '1px solid var(--panel-border)', padding: '10px' }}>
                  ⚠ 暂无历史报告。请先到顶部点击「<span style={{ color: 'var(--c-cyan)', fontWeight: 700 }}>AI 安全诊断</span>」生成一次，再进行人工调级。
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="sec-card">
              <div className="sec-title">
                <div className="tt">📜 AI 安全诊断历史</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--t-dim)', fontSize: '11px' }}>
                    共 <b style={{ color: 'var(--c-cyan)' }}>{historyTotal}</b> 条 ·
                    倒序（上限 500 · FIFO）·
                    第 <b style={{ color: 'var(--c-amber)' }}>{historyPage}</b> 页
                  </span>
                  <button
                    type="button"
                    onClick={() => loadHist(historyPage).catch(() => {})}
                    className="ai-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                  >
                    <RefreshCw style={{ width: '12px', height: '12px' }} />
                    刷新
                  </button>
                </div>
              </div>

              {historyLoading ? (
                <div className="sec-empty" style={{ padding: '60px' }}>
                  <Loader2 className="animate-spin" style={{ width: '28px', height: '28px', color: 'var(--c-cyan)', margin: '0 auto 10px' }} />
                  <div>历史报告加载中…</div>
                </div>
              ) : history.length === 0 ? (
                <div className="sec-empty">
                  暂无历史报告。点击顶部「<span style={{ color: 'var(--c-cyan)', fontWeight: 700 }}>AI 安全诊断</span>」生成后会自动保存。
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="sec-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>序号</th>
                          <th>生成时间</th>
                          <th>诊断模型</th>
                          <th style={{ width: 110, textAlign: 'right' }}>Tokens</th>
                          <th style={{ width: 100, textAlign: 'right' }}>耗时</th>
                          <th style={{ width: 130, textAlign: 'center' }}>综合风险</th>
                          <th style={{ width: 200, textAlign: 'right' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((r, i) => {
                          const isLatest = i === 0;
                          const rk = rankBadge(i);
                          return (
                            <tr key={r._id} className={cn(isLatest && 'latest')}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className={rk.cls}>{rk.txt}</span>
                                  {isLatest && <span className="tag-new">最新</span>}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--t-bright)' }}>{new Date(r.generatedAt).toLocaleString('zh-CN')}</div>
                                <div style={{ fontFamily: 'Consolas,monospace', fontSize: '10px', color: 'var(--t-muted)', marginTop: '2px' }}>
                                  ID: {r._id.slice(0, 8)}…{r._id.slice(-6)}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontFamily: 'Consolas,monospace', fontSize: '12px', color: 'var(--t-base)' }}>{(r.modelName || r.model || '')}</div>
                                <div style={{ fontFamily: 'Consolas,monospace', fontSize: '10px', color: 'var(--t-muted)', marginTop: '2px' }}>
                                  provider: {r.provider}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-base)' }}>
                                {r.usage?.totalTokens?.toLocaleString() ?? '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'Consolas,monospace', fontWeight: 700, color: 'var(--t-base)' }}>
                                {(r.elapsedMs / 1000).toFixed(1)} s
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={badgeClsByLevel(r.riskLevel)}>
                                  {r.riskLevel === 'high' ? '🔥 高危'
                                    : r.riskLevel === 'mid' ? '⚠ 中危'
                                      : r.riskLevel === 'low' ? '🟡 低危'
                                        : r.riskLevel === 'excellent' ? '✅ 优秀'
                                          : '— 待评估'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try {
                                        adminAPI.getSecurityReport(r._id)
                                          .then((res) => { if (res?.data?.data) setViewReport(res.data.data); })
                                          .catch(() => setViewReport(r));
                                      } catch {
                                        setViewReport(r);
                                      }
                                    }}
                                    className="ai-btn"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                                  >
                                    <Eye style={{ width: '12px', height: '12px' }} />
                                    查看
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const blob = new Blob([r.content], { type: 'text/markdown;charset=utf-8' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `security-report-${new Date(r.generatedAt).toISOString().slice(0, 10)}-${r._id.slice(-6)}.md`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="ai-btn"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                                  >
                                    <Download style={{ width: '12px', height: '12px' }} />
                                    下载 MD
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  <div className="sec-page">
                    <button
                      type="button"
                      disabled={historyPage <= 1 || historyLoading}
                      onClick={() => loadHist(historyPage - 1).catch(() => {})}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ChevronLeft style={{ width: '14px', height: '14px' }} />
                      上一页
                    </button>
                    <span style={{ color: 'var(--t-dim)', fontSize: '12px' }}>
                      第 <b style={{ color: 'var(--c-cyan)' }}>{historyPage}</b> / {Math.max(1, Math.ceil(historyTotal / 20))} 页
                      · 每页 20 条 · 共 {historyTotal} 条
                    </span>
                    <button
                      type="button"
                      disabled={historyPage * 20 >= historyTotal || historyLoading}
                      onClick={() => loadHist(historyPage + 1).catch(() => {})}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      下一页
                      <ChevronRight style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* 简洁底部 */}
      <div style={{ textAlign: 'center', color: 'var(--t-muted)', fontSize: '11px', padding: '6px 0 14px', fontFamily: 'Consolas,monospace', letterSpacing: '2px' }}>
        持续改进 · 动态防御 · 全局合规
      </div>

      {/* ========== AI 安全诊断弹窗 ========== */}
      {showAi && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,11,31,.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAi(false); }}
        >
          <div
            style={{ width: '100%', maxWidth: '1080px', maxHeight: '90vh', background: 'rgba(10,24,48,.95)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,229,255,.04)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu style={{ width: '16px', height: '16px', color: 'var(--c-cyan)' }} />
                🤖 AI 系统安全诊断中心
                <span className="badge excellent">POWERED BY DEEPSEEK V4</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAi(false)}
                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-dim)', background: 'transparent', border: '1px solid var(--panel-border)', cursor: 'pointer' }}
                title="关闭"
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </header>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
              {/* 配置表单 */}
              <div className="sec-card" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t-dim)' }}>🧠 诊断模型</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      disabled={aiLoading}
                      style={{ width: '100%', padding: '6px 8px', background: 'rgba(5,11,31,.6)', border: '1px solid var(--panel-border)', color: 'var(--t-base)', fontSize: '12px', outline: 'none' }}
                    >
                      <option value="deepseek-v4-pro">deepseek-v4-pro（旗舰推理）</option>
                      <option value="deepseek-v4-flash">deepseek-v4-flash（经济快速）</option>
                      <option value="deepseek-chat">deepseek-chat（经典版）</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t-dim)' }}>🗂 数据上下文</label>
                    <input
                      type="text"
                      disabled
                      value={dash ? `✅ ${dash.users.total}用户 · ${dash.conversations.total}会话 · ${dash.audit.totalEntries}审计` : '⏳ 加载中…'}
                      style={{ width: '100%', padding: '6px 8px', background: 'rgba(5,11,31,.6)', border: '1px solid var(--panel-border)', color: 'var(--t-dim)', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t-dim)' }}>🔑 自定义 API Key（可选，留空用后端）</label>
                    <input
                      type="password"
                      placeholder="sk-xxxxxxxx（留空使用系统默认）"
                      value={aiCustomKey}
                      onChange={(e) => setAiCustomKey(e.target.value)}
                      disabled={aiLoading}
                      style={{ width: '100%', padding: '6px 8px', background: 'rgba(5,11,31,.6)', border: '1px solid var(--panel-border)', color: 'var(--t-base)', fontSize: '12px', fontFamily: 'Consolas,monospace', outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t-dim)' }}>✏️ 自定义分析指令（可选）</label>
                  <textarea
                    rows={2}
                    placeholder="例如：重点关注身份权限越权风险，并给出整改的责任分工；或评估等保三级合规差距…"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    disabled={aiLoading}
                    style={{ width: '100%', padding: '6px 8px', background: 'rgba(5,11,31,.6)', border: '1px solid var(--panel-border)', color: 'var(--t-base)', fontSize: '12px', outline: 'none', resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={runAiAnalyze}
                    disabled={aiLoading}
                    className="ai-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {aiLoading ? <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} /> : '🚀'}
                    {aiLoading ? '🛰 诊断推理中，请勿关闭…' : '启动 AI 安全诊断'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAiResult(null); setAiErr(''); setAiPrompt(''); }}
                    disabled={aiLoading}
                    className="ai-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(127,168,201,.1)' }}
                  >
                    🧹 清空结果
                  </button>
                  <span style={{ marginLeft: 'auto', fontFamily: 'Consolas,monospace', fontSize: '10px', color: 'var(--t-muted)' }}>
                    后端：http://localhost:3000/api/admin/security/analyze · 超时 60s
                  </span>
                </div>
              </div>

              {/* Loading */}
              {aiLoading && (
                <div className="sec-empty" style={{ padding: '40px' }}>
                  <Loader2 className="animate-spin" style={{ width: '36px', height: '36px', color: 'var(--c-cyan)', margin: '0 auto 12px' }} />
                  <div style={{ color: 'var(--t-base)', fontSize: '13px' }}>
                    <b style={{ color: 'var(--c-cyan)' }}>DeepSeek V4</b> 正在根据四维度数据建模推理 · 请耐心等待（通常 5~20s）
                  </div>
                  <div style={{ margin: '12px auto 0', maxWidth: '320px', height: '4px', background: 'rgba(0,229,255,.08)', border: '1px solid var(--panel-border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div className="sec-bar-fill ok" style={{ width: '100%' }} />
                  </div>
                </div>
              )}

              {/* 错误 */}
              {aiErr && !aiLoading && (
                <div className="ai-err">
                  <b>❌ AI 诊断失败：</b><br />
                  {aiErr}
                </div>
              )}

              {/* 结果 */}
              {aiResult && !aiLoading && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'rgba(0,229,255,.05)', border: '1px solid var(--panel-border)', marginBottom: '10px' }}>
                    <span className="badge low">供应商：{aiResult.provider.toUpperCase()}</span>
                    <span className="badge excellent">模型：{aiResult.model}</span>
                    <span className="badge rx">耗时：{aiResult.elapsedMs}ms</span>
                    <span className="badge rx">
                      Tokens：prompt {aiResult.usage?.promptTokens ?? 0} /
                      completion {aiResult.usage?.completionTokens ?? 0} /
                      <b style={{ color: 'var(--c-amber)', marginLeft: '4px' }}>total {aiResult.usage?.totalTokens ?? 0}</b>
                    </span>
                    <span className="badge mid">生成：{new Date(aiResult.generatedAt).toLocaleString('zh-CN')}</span>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={copyReport}
                        className="ai-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                      >
                        <Copy style={{ width: '12px', height: '12px' }} />
                        复制
                      </button>
                      <button
                        type="button"
                        onClick={downloadReport}
                        className="ai-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                      >
                        <Download style={{ width: '12px', height: '12px' }} />
                        下载 MD
                      </button>
                    </span>
                  </div>
                  <div
                    className="ai-md"
                    dangerouslySetInnerHTML={{ __html: renderMd(aiResult.content) }}
                  />
                </>
              )}

              {/* 未运行提示 */}
              {!aiLoading && !aiResult && !aiErr && (
                <div className="sec-empty">
                  <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.7 }}>🛰</div>
                  点击上方「<span style={{ color: 'var(--c-cyan)', fontWeight: 700 }}>🚀 启动 AI 安全诊断</span>」，
                  DeepSeek V4 将基于当前 Dashboard 的用户/对话/记忆/任务/工具/审计数据，<br />
                  生成 <b style={{ color: 'var(--c-amber)' }}>【身份 / 数据 / 模型 / 运维四维度评估 + TOP3 整改事项 + 行动倡议】</b> 的完整专业报告。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 查看历史报告弹窗 ========== */}
      {viewReport && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,11,31,.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewReport(null); }}
        >
          <div
            style={{ width: '100%', maxWidth: '1100px', maxHeight: '90vh', background: 'rgba(10,24,48,.95)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,229,255,.04)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-bright)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                📜 历史安全诊断报告
                <span className={badgeClsByLevel(viewReport.riskLevel)}>
                  {viewReport.riskLevel === 'high' ? '🔥 高危'
                    : viewReport.riskLevel === 'mid' ? '⚠ 中危'
                      : viewReport.riskLevel === 'low' ? '🟡 低危'
                        : viewReport.riskLevel === 'excellent' ? '✅ 优秀'
                          : '— 待评估'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setViewReport(null)}
                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-dim)', background: 'transparent', border: '1px solid var(--panel-border)', cursor: 'pointer' }}
                title="关闭"
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </header>

            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'rgba(0,229,255,.05)', border: '1px solid var(--panel-border)' }}>
                <span className="badge rx">🕐 {new Date(viewReport.generatedAt).toLocaleString('zh-CN')}</span>
                <span className="badge low">供应商：{viewReport.provider.toUpperCase()}</span>
                <span className="badge excellent">模型：{(viewReport.modelName || viewReport.model || '')}</span>
                <span className="badge rx">耗时：{viewReport.elapsedMs}ms</span>
                <span className="badge rx">
                  Tokens：prompt {viewReport.usage?.promptTokens ?? 0} /
                  completion {viewReport.usage?.completionTokens ?? 0} /
                  <b style={{ color: 'var(--c-amber)', marginLeft: '4px' }}>total {viewReport.usage?.totalTokens ?? 0}</b>
                </span>
                {viewReport.customPrompt && (
                  <span className="badge mid">✏️ 含自定义指令</span>
                )}
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      try { navigator.clipboard?.writeText(viewReport.content); } catch { /* 不抛错 */ }
                    }}
                    className="ai-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                  >
                    <Copy style={{ width: '12px', height: '12px' }} />
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([viewReport.content], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `security-report-${new Date(viewReport.generatedAt).toISOString().slice(0, 10)}-${viewReport._id.slice(-6)}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="ai-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                  >
                    <Download style={{ width: '12px', height: '12px' }} />
                    下载 MD
                  </button>
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
              <div
                className="ai-md"
                dangerouslySetInnerHTML={{ __html: renderMd(viewReport.content) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
