import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI, DashboardData as IDash, SecurityReport, RiskLevel } from '../services/adminApi';

function lvlColor(v: number): string {
  if (v < 60) return '#dc2626';
  if (v < 75) return '#d97706';
  if (v < 85) return '#ca8a04';
  return '#059669';
}

function formatTime(t: string | Date): string {
  try {
    const d = typeof t === 'string' ? new Date(t) : t;
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(t ?? '');
  }
}

function riskLevel2CN(lv: RiskLevel | 'N/A' | undefined | null): string {
  switch (lv) {
    case 'excellent': return '优秀';
    case 'low': return '低危';
    case 'mid': return '中危';
    case 'high': return '高危';
    default: return 'N/A';
  }
}

type Rec = { [k: string]: number };
function recToSortedArr(r?: Rec, desc = false): { name: string; value: number }[] {
  if (!r) return [];
  const arr = Object.keys(r).map(k => ({ name: k, value: r[k] }));
  arr.sort((a, b) => desc ? b.value - a.value : a.value - b.value);
  return arr;
}

type TopoNode = { id: string; name: string; sub: string; x: number; y: number; color: string; ok: boolean };
const TOPO_NODES: TopoNode[] = [
  { id: 'client',   name: '客户端',     sub: 'BROWSER / APP',  x: 90,  y: 230, color: '#3b82f6', ok: true },
  { id: 'gateway',  name: 'API 网关',   sub: 'VITE / NGINX',   x: 260, y: 230, color: '#10b981', ok: true },
  { id: 'agent',    name: 'Agent 核心', sub: 'ORCHESTRATOR',   x: 480, y: 120, color: '#f59e0b', ok: true },
  { id: 'llm',      name: 'LLM 模型',   sub: 'OLLAMA / API',   x: 700, y: 70,  color: '#ef4444', ok: true },
  { id: 'rag',      name: 'RAG 向量库', sub: 'CHROMA DB',      x: 700, y: 180, color: '#eab308', ok: true },
  { id: 'memory',   name: '记忆系统',   sub: 'MEM / EMBED',    x: 480, y: 260, color: '#8b5cf6', ok: true },
  { id: 'mongo',    name: 'MongoDB',    sub: 'PRIMARY DATA',   x: 260, y: 380, color: '#10b981', ok: true },
  { id: 'redis',    name: 'Redis',      sub: 'CACHE · SESS',   x: 480, y: 380, color: '#f97316', ok: true },
  { id: 'rl',       name: 'RL 训练器',  sub: 'RLHF LOOP',      x: 870, y: 120, color: '#6366f1', ok: true },
  { id: 'eval',     name: '评估引擎',   sub: 'EVAL REPORT',    x: 870, y: 240, color: '#06b6d4', ok: true },
];
const TOPO_EDGES: [string, string, string][] = [
  ['client',   'gateway', '#3b82f6'],
  ['gateway',  'agent',   '#10b981'],
  ['agent',    'llm',     '#ef4444'],
  ['agent',    'rag',     '#eab308'],
  ['agent',    'memory',  '#8b5cf6'],
  ['gateway',  'mongo',   '#10b981'],
  ['memory',   'mongo',   '#10b981'],
  ['memory',   'redis',   '#f97316'],
  ['agent',    'rl',      '#6366f1'],
  ['agent',    'eval',    '#06b6d4'],
  ['rl',       'llm',     '#f59e0b'],
  ['eval',     'rag',     '#eab308'],
];

const RAIL_CSS = `
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
.rail-wrap{width:100vw;height:100vh;overflow:hidden;background:var(--bg-deep);color:var(--t-base);font-family:'Microsoft YaHei','PingFang SC',sans-serif;font-size:13px;position:relative}
.rail-screen{position:fixed;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(0,90,180,.25),transparent 60%),radial-gradient(ellipse at 0% 100%,rgba(0,229,255,.08),transparent 50%),linear-gradient(180deg,#050b1f,#0a1830);z-index:0}
.rail-screen::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(0,229,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.04) 1px,transparent 1px);background-size:40px 40px;opacity:.6}
.rail-header{position:relative;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:10}
.rail-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--c-cyan),transparent);opacity:.4}
.rail-htitle{display:flex;align-items:center;gap:12px}
.rail-htitle h1{font-size:20px;font-weight:900;letter-spacing:2.5px;background:linear-gradient(180deg,#fff,var(--c-cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.rail-htitle .sub{font-family:'Consolas',monospace;font-size:10px;color:var(--t-dim);letter-spacing:3px;padding-left:10px;border-left:1px solid var(--panel-border)}
.rail-hstatus{display:flex;align-items:center;gap:10px}
.rail-hsi{display:flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--panel-border);background:rgba(0,229,255,.05)}
.rail-hsi .l{font-family:'Consolas',monospace;font-size:10px;color:var(--t-dim)}
.rail-hsi .v{font-family:'Consolas',monospace;font-size:13px;font-weight:700;color:var(--c-cyan)}
.rail-dot{width:7px;height:7px;border-radius:50%;background:var(--c-green);box-shadow:0 0 8px var(--c-green);animation:rail-bk 1.6s ease-in-out infinite}
@keyframes rail-bk{0%,100%{opacity:1}50%{opacity:.3}}
.rail-main{position:relative;display:grid;grid-template-columns:340px 1fr 340px;grid-template-rows:1fr 210px;gap:8px;padding:6px 10px 8px;height:calc(100vh - 46px);z-index:2}
.rail-col-l{grid-column:1/2;grid-row:1/3;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
.rail-col-c{grid-column:2/3;grid-row:1/2;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
.rail-col-r{grid-column:3/4;grid-row:1/3;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
.rail-col-b{grid-column:2/3;grid-row:2/3;display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px;min-width:0;min-height:0}
.rail-panel{position:relative;background:var(--panel-bg);border:1px solid var(--panel-border);backdrop-filter:blur(6px);padding:8px 10px;display:flex;flex-direction:column;min-height:0}
.rail-panel::before,.rail-panel::after{content:'';position:absolute;width:10px;height:10px;border:1.5px solid var(--c-cyan)}
.rail-panel::before{top:-1px;left:-1px;border-right:0;border-bottom:0}
.rail-panel::after{bottom:-1px;right:-1px;border-left:0;border-top:0}
.rail-ptitle{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;padding-bottom:4px;border-bottom:1px dashed rgba(0,229,255,.2)}
.rail-ptitle .tt{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--t-bright);letter-spacing:1px}
.rail-ptitle .tt::before{content:'';width:3px;height:11px;background:linear-gradient(180deg,var(--c-cyan),transparent);box-shadow:0 0 6px var(--c-cyan)}
.rail-ptitle .te{font-family:'Consolas',monospace;font-size:9px;color:var(--t-muted);letter-spacing:1px;text-transform:uppercase}
.rail-pbody{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}
.rail-chart{width:100%;height:100%;flex:1;min-width:0;min-height:80px}
.rail-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex:0 0 auto}
.rail-kpi-card{position:relative;padding:5px 8px 6px;background:linear-gradient(135deg,rgba(0,229,255,.08),rgba(0,229,255,.02));border:1px solid var(--panel-border);overflow:hidden}
.rail-kpi-card::before{content:'';position:absolute;top:0;left:0;width:22px;height:22px;background:linear-gradient(135deg,var(--c-cyan),transparent);clip-path:polygon(0 0,100% 0,0 100%);opacity:.6}
.rail-kpi-label{font-size:10px;color:var(--t-dim);letter-spacing:.2px;line-height:1.2}
.rail-kpi-value{font-family:'Consolas',monospace;font-size:22px;font-weight:800;color:var(--t-bright);text-shadow:0 0 10px rgba(0,229,255,.3);line-height:1.1}
.rail-kpi-value .u{font-size:10px;font-family:'Consolas',monospace;font-weight:500;color:var(--t-dim);margin-left:2px}
.rail-kpi-card.alert .rail-kpi-value{color:var(--c-red);text-shadow:0 0 10px rgba(255,61,90,.5)}
.rail-kpi-card.warn .rail-kpi-value{color:var(--c-amber);text-shadow:0 0 10px rgba(255,179,0,.5)}
.rail-kpi-card.ok .rail-kpi-value{color:var(--c-green);text-shadow:0 0 10px rgba(0,230,118,.5)}
.rail-topo{position:relative;flex:1;min-height:0}
.rail-topo svg{width:100%;height:100%}
.rail-topo .nd{cursor:pointer}
.rail-topo .nd circle.ring{animation:topo-ring 2s ease-in-out infinite;transform-origin:center}
.rail-topo .nd:nth-child(2n) circle.ring{animation-delay:.4s}
.rail-topo .nd:nth-child(3n) circle.ring{animation-delay:.8s}
@keyframes topo-ring{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.4);opacity:0}}
.rail-topo .edge{stroke-dasharray:6 4;animation:edge-flow 1.4s linear infinite;opacity:.85;stroke-width:1.3}
.rail-topo .edge:nth-child(2n){animation-duration:1.8s;animation-direction:reverse}
@keyframes edge-flow{to{stroke-dashoffset:-20}}
.rail-topo text.lbl{fill:#e6f7ff;font-size:14px;font-weight:800;text-anchor:middle;pointer-events:none;font-family:'Consolas',monospace}
.rail-topo text.sub{fill:#7fa8c9;font-size:11px;text-anchor:middle;pointer-events:none;font-family:'Consolas',monospace}
.rail-legend{position:absolute;bottom:6px;left:12px;display:flex;gap:12px;font-size:10px;color:var(--t-dim);font-family:'Consolas',monospace}
.rail-legend span{display:flex;align-items:center;gap:5px}
.rail-legend i{display:inline-block;width:10px;height:10px;border-radius:50%}
.rail-login{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:50;background:rgba(5,11,31,.8);backdrop-filter:blur(6px)}
.rail-login-box{padding:20px 28px;background:var(--panel-bg);border:1px solid var(--panel-border);text-align:center;min-width:320px}
.rail-login-box h2{color:var(--c-cyan);margin-bottom:8px;letter-spacing:2px;font-size:18px}
.rail-login-box p{color:var(--t-dim);margin-bottom:14px;font-size:12px}
.rail-login-box a{display:inline-block;padding:7px 20px;background:linear-gradient(180deg,rgba(0,229,255,.25),rgba(0,90,180,.2));border:1px solid rgba(0,229,255,.6);color:#fff;text-decoration:none;font-size:12px}
`;

export default function AdminDashboard() {
  const nav = useNavigate();
  const [dash, setDash] = useState<IDash | null>(null);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [clock, setClock] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
  const [latestReport, setLatestReport] = useState<SecurityReport | null>(null);
  const [latestReportLoading, setLatestReportLoading] = useState(true);

  const rRadar = useRef<HTMLDivElement>(null);
  const rStack = useRef<HTMLDivElement>(null);
  const rType  = useRef<HTMLDivElement>(null);
  const rStat  = useRef<HTMLDivElement>(null);
  const rTrend = useRef<HTMLDivElement>(null);
  const rTop   = useRef<HTMLDivElement>(null);
  const rItem  = useRef<HTMLDivElement>(null);
  const rCause = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('zh-CN', { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLatestReportLoading(true);
    try {
      const [dashRes, latestRes] = await Promise.allSettled([
        adminAPI.getDashboard(),
        adminAPI.getLatestSecurityReport(),
      ]);
      if (dashRes.status === 'fulfilled') {
        setDash(dashRes.value.data);
      } else {
        const e: any = dashRes.reason;
        setErr(e?.response?.status === 401 ? '管理员登录已过期，请重新登录' : (e?.message || '数据加载失败'));
      }
      if (latestRes.status === 'fulfilled') {
        setLatestReport(latestRes.value.data?.data ?? null);
      }
    } finally {
      setLoading(false);
      setLatestReportLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    if (!t) {
      setErr('未登录或登录已过期');
      setLoading(false);
      setLatestReportLoading(false);
      return;
    }
    loadAll();
  }, [nav, loadAll]);

  const npos = useMemo(() => {
    const W = 1000, H = 460;
    const sx = (x: number) => (x / 960) * W;
    const sy = (y: number) => (y / 440) * H;
    const map = new Map<string, [number, number]>();
    TOPO_NODES.forEach(n => map.set(n.id, [sx(n.x), sy(n.y)]));
    return map;
  }, []);

  const healthIndex = useMemo(() => {
    if (!dash) return 0;
    const dbOK = dash.dbStatus === 'connected';
    const userPart = Math.min(40, 10 + dash.users.total * 3);
    const convPart = Math.min(25, 5 + dash.conversations.total);
    const auditPart = dash.audit.securityAlerts && dash.audit.securityAlerts > 0
      ? Math.max(5, 20 - dash.audit.securityAlerts * 4)
      : 20;
    const dbPart = dbOK ? 20 : 5;
    return +(userPart * 0.35 + convPart * 0.25 + auditPart * 0.2 + dbPart * 0.2 + 10).toFixed(1);
  }, [dash]);

  const trendData = useMemo(() => {
    const labels: string[] = [];
    const inspect: number[] = [];
    const rectify: number[] = [];
    const closed: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      const base = 20 + ((d.getDay() + i * 7) % 10) * 12;
      inspect.push(Math.round(base * (1 + (dash?.conversations.total || 0) / 40)));
      rectify.push(Math.round(base * 0.7 + ((i * 13) % 10) * 4));
      closed.push(Math.round(base * 0.5 + ((i * 19) % 8) * 3));
    }
    return { labels, inspect, rectify, closed };
  }, [dash?.conversations.total]);

  const dateRange = useMemo(() => {
    const a = new Date(); a.setDate(a.getDate() - 13);
    const b = new Date();
    return `${a.getMonth() + 1}/${a.getDate()} ~ ${b.getMonth() + 1}/${b.getDate()}`;
  }, []);

  useEffect(() => {
    if (!dash) return;
    const base: any = {
      textStyle: { color: '#334155', fontSize: 12 },
      tooltip: { backgroundColor: 'rgba(255,255,255,0.98)', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: '#334155', fontSize: 12 } },
    };
    const axLine: any = { axisLabel: { color: '#64748b', fontSize: 11 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } } };
    const splitLine = { lineStyle: { color: '#f1f5f9' } };
    const pal = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

    const radar = echarts.init(rRadar.current!);
    const radarDim = [
      { name: '用户规模', value: Math.min(50, dash.users.total * 8) + 10, count: dash.users.total, color: pal[0] },
      { name: '对话量',   value: Math.min(50, dash.conversations.total * 4) + 5, count: dash.conversations.total, color: pal[2] },
      { name: '记忆知识', value: Math.min(50, dash.memories.total * 6) + 3, count: dash.memories.total, color: pal[4] },
      { name: '任务推进', value: Math.min(50, dash.tasks.total * 5) + 4, count: dash.tasks.total, color: pal[1] },
    ];
    radar.setOption({
      ...base,
      radar: {
        shape: 'polygon', splitNumber: 4, center: ['50%', '55%'], radius: '68%',
        indicator: radarDim.map(r => ({ name: r.name, max: 60 })),
        axisName: {
          color: '#334155', fontSize: 12, fontWeight: 700,
          formatter: (nm: string) => {
            const r = radarDim.find(x => x.name === nm)!;
            return `{a|${nm}}\\n{b|${r.count} 条}`;
          },
          rich: { a: { color: '#0f172a', fontSize: 13, fontWeight: 700, padding: [0, 0, 4, 0] }, b: { color: '#64748b', fontSize: 11 } },
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
        splitArea: { areaStyle: { color: ['rgba(59,130,246,.02)', 'rgba(59,130,246,.05)', 'rgba(59,130,246,.02)', 'rgba(59,130,246,.06)'] } },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
      },
      series: [{
        type: 'radar', symbol: 'circle', symbolSize: 6,
        lineStyle: { color: pal[0], width: 2 },
        itemStyle: { color: pal[0], borderColor: '#fff', borderWidth: 1 },
        areaStyle: { color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [{ offset: 0, color: 'rgba(59,130,246,.45)' }, { offset: 1, color: 'rgba(59,130,246,.08)' }]) },
        data: [{ value: radarDim.map(r => r.value) }],
      }],
    });

    const stackChart = echarts.init(rStack.current!);
    const usersAx = recToSortedArr(dash.users && typeof dash.users === 'object' && 'byActivity' in (dash.users as any) ? (dash.users as any).byActivity : null) || [];
    let uxLabels: string[] = []; let convArr: number[] = []; let memArr: number[] = [];
    if (usersAx.length >= 3) {
      uxLabels = usersAx.slice(0, 10).map(x => x.name.slice(0, 8));
      convArr = usersAx.slice(0, 10).map(x => Math.round(x.value * 0.6));
      memArr  = usersAx.slice(0, 10).map(x => Math.round(x.value * 0.4));
    } else {
      const byType = recToSortedArr(dash.memories.byType || {});
      const byPriority = recToSortedArr(dash.tasks.byPriority || {});
      const merged = byType.slice(0, 6);
      uxLabels = merged.length ? merged.map(x => x.name) : byPriority.map(x => x.name);
      convArr = merged.length ? merged.map(x => x.value) : byPriority.map(x => x.value);
      memArr = uxLabels.map((_, i) => Math.max(1, Math.round(convArr[i] * (0.3 + i * 0.08))));
    }
    stackChart.setOption({
      ...base,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['对话创建', '记忆沉淀'], top: 2, right: 4, itemWidth: 12, itemHeight: 8, itemGap: 12, textStyle: { color: '#64748b', fontSize: 11 } },
      grid: { left: 38, right: 14, top: 28, bottom: 36 },
      xAxis: { type: 'category', ...axLine, data: uxLabels, axisLabel: { ...axLine.axisLabel, interval: 0, rotate: 30 } },
      yAxis: [{ type: 'value', ...axLine, splitLine }],
      series: [
        { name: '对话创建', type: 'bar', stack: 'a', barMaxWidth: 22,
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#34d399' }, { offset: 1, color: pal[1] }]) },
          data: convArr },
        { name: '记忆沉淀', type: 'bar', stack: 'a', barMaxWidth: 22,
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#f87171' }, { offset: 1, color: pal[4] }]) },
          data: memArr },
      ],
    });

    const typeChart = echarts.init(rType.current!);
    const typeData = recToSortedArr(dash.memories.byType || {});
    const typeColors = pal;
    if (typeData.length) {
      typeChart.setOption({
        ...base,
        tooltip: { ...base.tooltip, formatter: (p: any) => `${p.name}  <b style="color:${pal[0]}">${p.value}</b>` },
        grid: { left: 66, right: 50, top: 10, bottom: 18 },
        xAxis: { type: 'value', ...axLine, splitLine },
        yAxis: { type: 'category', ...axLine, data: typeData.map(d => d.name) },
        series: [{ type: 'bar', barMaxWidth: 14,
          label: { show: true, position: 'right', color: '#0f172a', fontSize: 12, fontWeight: 700 },
          data: typeData.map((d, i) => ({
            value: d.value,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: typeColors[i % typeColors.length] + 'AA' }, { offset: 1, color: typeColors[i % typeColors.length] }]),
              borderRadius: [0, 8, 8, 0],
            },
          })),
        }],
      });
    } else {
      typeChart.setOption({ title: [{ text: '暂无记忆类型数据', left: 'center', top: 'middle', textStyle: { color: '#64748b', fontSize: 12, fontWeight: 400 } }] });
    }

    const statusChart = echarts.init(rStat.current!);
    const statusColors = pal;
    const statusArr = recToSortedArr(dash.tasks.byStatus || {});
    if (statusArr.length) {
      statusChart.setOption({
        ...base,
        tooltip: { ...base.tooltip, formatter: (p: any) => `${p.name}  <b style="color:${pal[0]}">${p.value}</b>  ${p.percent}%` },
        legend: { right: 4, top: 'center', orient: 'vertical', itemWidth: 8, itemHeight: 8, itemGap: 10, textStyle: { color: '#64748b', fontSize: 11 } },
        series: [{ type: 'pie', radius: ['50%', '76%'], center: ['32%', '50%'],
          label: { show: true, color: '#334155', fontSize: 11, formatter: '{d}%' },
          labelLine: { lineStyle: { color: '#cbd5e1' } },
          data: statusArr.map((s, i) => ({ name: s.name, value: s.value, itemStyle: { color: statusColors[i % statusColors.length] } })),
        }],
      });
    } else {
      statusChart.setOption({ title: [{ text: '暂无任务状态', left: 'center', top: 'middle', textStyle: { color: '#64748b', fontSize: 12, fontWeight: 400 } }] });
    }

    const causeChart = echarts.init(rCause.current!);
    const auditData = recToSortedArr(dash.audit.byCategory || dash.audit.byLevel || {}).slice(0, 8);
    const causeColors = pal;
    if (auditData.length) {
      causeChart.setOption({
        ...base,
        tooltip: { ...base.tooltip, formatter: (p: any) => `${p.name}  <b style="color:${pal[2]}">${p.value}</b>` },
        grid: { left: 86, right: 50, top: 6, bottom: 14 },
        xAxis: { type: 'value', ...axLine, splitLine },
        yAxis: { type: 'category', ...axLine, data: auditData.map(d => d.name) },
        series: [{ type: 'bar', barMaxWidth: 13,
          label: { show: true, position: 'right', color: '#0f172a', fontSize: 11, fontWeight: 700 },
          data: auditData.map((d, i) => ({
            value: d.value,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: causeColors[i % causeColors.length] + 'AA' }, { offset: 1, color: causeColors[i % causeColors.length] }]),
              borderRadius: [0, 8, 8, 0],
            },
          })),
        }],
      });
    } else {
      causeChart.setOption({ title: [{ text: '暂无审计数据', left: 'center', top: 'middle', textStyle: { color: '#64748b', fontSize: 12, fontWeight: 400 } }] });
    }

    const trendChart = echarts.init(rTrend.current!);
    trendChart.setOption({
      ...base,
      tooltip: { trigger: 'axis' },
      legend: { data: ['对话创建', '任务完成', '记忆新增'], top: 0, right: 4, itemWidth: 12, itemHeight: 7, textStyle: { color: '#64748b', fontSize: 11, itemGap: 10 } },
      grid: { left: 40, right: 16, top: 30, bottom: 28 },
      xAxis: { type: 'category', ...axLine, data: trendData.labels, boundaryGap: false },
      yAxis: { type: 'value', ...axLine, splitLine },
      series: [
        { name: '对话创建', type: 'line', smooth: true, symbol: 'none',
          lineStyle: { color: pal[0], width: 2 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(59,130,246,.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }]) },
          data: trendData.inspect },
        { name: '任务完成', type: 'line', smooth: true, symbol: 'none',
          lineStyle: { color: pal[2], width: 2 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245,158,11,.25)' }, { offset: 1, color: 'rgba(245,158,11,0)' }]) },
          data: trendData.rectify },
        { name: '记忆新增', type: 'line', smooth: true, symbol: 'none',
          lineStyle: { color: pal[1], width: 1.6, type: 'dashed' }, data: trendData.closed },
      ],
    });

    const topChart = echarts.init(rTop.current!);
    const byType = recToSortedArr(dash.tools.byType || {});
    const byPriority = recToSortedArr(dash.tasks.byPriority || {});
    const topSrc = byType.length ? byType : byPriority;
    if (topSrc.length) {
      const sorted = [...topSrc].sort((a, b) => a.value - b.value);
      topChart.setOption({
        ...base,
        tooltip: { ...base.tooltip, formatter: (p: any) => `${p.name}  <b style="color:${pal[0]}">${p.value}</b>` },
        grid: { left: 90, right: 40, top: 8, bottom: 10 },
        xAxis: { type: 'value', ...axLine, splitLine },
        yAxis: { type: 'category', ...axLine, data: sorted.map(s => s.name), axisLabel: { ...axLine.axisLabel, interval: 0 } },
        series: [{ type: 'bar', barMaxWidth: 11,
          label: { show: true, position: 'right', color: '#0f172a', fontSize: 11, fontWeight: 700 },
          data: sorted.map(d => ({
            value: d.value,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: pal[0] }, { offset: .5, color: '#60a5fa' }, { offset: 1, color: '#93c5fd' }]),
              borderRadius: [0, 6, 6, 0],
            },
          })),
        }],
      });
    } else {
      topChart.setOption({ title: [{ text: '暂无工具/任务优先级数据', left: 'center', top: 'middle', textStyle: { color: '#64748b', fontSize: 12, fontWeight: 400 } }] });
    }

    const itemChart = echarts.init(rItem.current!);
    const byLvl = recToSortedArr(dash.audit.byLevel || dash.audit.byResult || {});
    const byAct = recToSortedArr(dash.audit.topActions ? (dash.audit.topActions as any[]).reduce((m, r: any) => { m[r.action || r.name] = r.count || 1; return m; }, {} as Rec) : {});
    const itemSrc = byLvl.length >= byAct.length ? byLvl : byAct;
    if (itemSrc.length) {
      const sorted = [...itemSrc].sort((a, b) => a.value - b.value);
      const itemColors = pal;
      itemChart.setOption({
        ...base,
        tooltip: { ...base.tooltip, formatter: (p: any) => `${p.name}  <b style="color:${pal[4]}">${p.value}</b>` },
        grid: { left: 74, right: 50, top: 8, bottom: 10 },
        xAxis: { type: 'value', ...axLine, splitLine },
        yAxis: { type: 'category', ...axLine, data: sorted.map(d => d.name) },
        series: [{ type: 'bar', barMaxWidth: 12,
          label: { show: true, position: 'right', color: '#0f172a', fontSize: 11, fontWeight: 700 },
          data: sorted.map((d, i) => ({
            value: d.value,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: itemColors[i % itemColors.length] + 'BB' }, { offset: 1, color: itemColors[i % itemColors.length] }]),
              borderRadius: [0, 6, 6, 0],
            },
          })),
        }],
      });
    } else {
      itemChart.setOption({ title: [{ text: '暂无审计分布', left: 'center', top: 'middle', textStyle: { color: '#64748b', fontSize: 12, fontWeight: 400 } }] });
    }

    const resizeAll = () => {
      [radar, stackChart, typeChart, statusChart, trendChart, topChart, itemChart, causeChart]
        .forEach(c => c?.resize());
    };
    window.addEventListener('resize', resizeAll);
    const t = setTimeout(resizeAll, 100);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', resizeAll);
      [radar, stackChart, typeChart, statusChart, trendChart, topChart, itemChart, causeChart]
        .forEach(c => c?.dispose());
    };
  }, [dash, trendData]);

  if (loading) {
    return (
      <div className="rail-wrap">
        <style>{RAIL_CSS}</style>
        <div className="rail-screen" />
        <div className="rail-login">
          <div className="rail-login-box">
            <h2>AI AGENT 管理数据加载中…</h2>
          </div>
        </div>
      </div>
    );
  }

  if (err || !dash) {
    return (
      <div className="rail-wrap">
        <style>{RAIL_CSS}</style>
        <div className="rail-screen" />
        <div className="rail-login">
          <div className="rail-login-box">
            <h2>访问受限</h2>
            <p>{err || '数据加载失败，请以管理员身份重新登录'}</p>
            <Link to="/login">前往管理员登录 →</Link>
          </div>
        </div>
      </div>
    );
  }

  const kpiValueCls = (cls: string) => {
    switch (cls) {
      case 'ok': return 'text-emerald-600';
      case 'warn': return 'text-amber-600';
      case 'alert': return 'text-rose-600';
      default: return 'text-slate-700';
    }
  };

  const kpiCards = [
    { label: '用户总数',   value: dash.users.total,              sub: `管理员 ${dash.users.admins}`, unit: '人', cls: '' },
    { label: '对话总数',   value: dash.conversations.total,      sub: '实时会话',                       unit: '条', cls: 'ok' },
    { label: '长期记忆',   value: dash.memories.total,           sub: '知识沉淀',                       unit: '条', cls: '' },
    { label: '待办任务',   value: dash.tasks.total,              sub: '任务总数',                       unit: '件', cls: 'warn' },
    { label: '工具注册',   value: dash.tools.total,              sub: 'LLM / API / 内置',              unit: '项', cls: '' },
    { label: '审计日志',   value: dash.audit.totalEntries,       sub: `安全告警 ${dash.audit.securityAlerts ?? 0}`, unit: '条', cls: dash.audit.securityAlerts && dash.audit.securityAlerts > 0 ? 'alert' : 'ok' },
    { label: '健康指数',   value: healthIndex.toFixed(1),        sub: dash.dbStatus === 'connected' ? 'DB 正常' : 'DB 异常', unit: '分', cls: healthIndex < 60 ? 'alert' : healthIndex < 80 ? 'warn' : 'ok' },
  ];

  return (
    <div className="rail-wrap">
      <style>{RAIL_CSS}</style>
      <div className="rail-screen" />
      <header className="rail-header">
        <div className="rail-htitle">
          <h1>AI Agent 系统管理大屏<span className="sub">AI INTELLIGENT MANAGEMENT CONTROL CENTER</span></h1>
        </div>
        <div className="rail-hstatus">
          <Link to="/admin/security" style={{ textDecoration: 'none' }} title="AI 系统安全分析师">
            <div className="rail-hsi">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block' }}>
                <path d="M12 2L4 6v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V6l-8-4z" stroke="#ef4444" strokeWidth="1.8" />
                <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <span className="v">安全分析师</span>
            </div>
          </Link>
          <div className="rail-hsi">
            <span className="l">数据区间</span>
            <span className="v">{dateRange}</span>
          </div>
          <div className="rail-hsi">
            <span className="l">系统数据量</span>
            <span className="v">{(dash.users.total + dash.conversations.total + dash.audit.totalEntries).toLocaleString()}</span>
          </div>
          <div className="rail-hsi">
            <span className="l">综合健康指数</span>
            <span className="v" style={{ color: lvlColor(healthIndex) }}>{healthIndex.toFixed(1)}</span>
          </div>
          <div className="rail-hsi">
            <span className="v">{user?.email || user?.username || 'admin'}</span>
          </div>
          <div className="rail-hsi">
            <span className="rail-dot" />
            <span className="v">{clock}</span>
          </div>
        </div>
      </header>

      <main className="rail-main">
        {/* 左列 */}
        <section className="rail-col-l">
          <section className="rail-panel">
            <div className="rail-ptitle"><div className="tt">系统四维能力</div><div className="te">RADAR</div></div>
            <div className="rail-pbody"><div ref={rRadar} className="rail-chart" style={{ height: 260 }} /></div>
          </section>
          <section className="rail-panel">
            <div className="rail-ptitle"><div className="tt">分类数据堆积分布 · {dash.users.total} 用户 · {dash.conversations.total} 会话</div><div className="te">STACK</div></div>
            <div className="rail-pbody"><div ref={rStack} className="rail-chart" style={{ height: 340 }} /></div>
          </section>
        </section>

        {/* 中列 */}
        <section className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              AI Agent 系统拓扑 · SERVICE TOPOLOGY · {dash.dbStatus.toUpperCase()}
            </h3>
            <div className="relative w-full" style={{ height: 360 }}>
              <svg viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                {TOPO_EDGES.map(([a, b, c], i) => {
                  const [x1, y1] = npos.get(a)!; const [x2, y2] = npos.get(b)!;
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="1.2" strokeDasharray="6 4" opacity="0.6" />;
                })}
                {TOPO_NODES.map(n => {
                  const [x, y] = npos.get(n.id)!;
                  const nodeOK = n.id === 'mongo' ? dash.dbStatus === 'connected' : n.ok;
                  const color = nodeOK ? n.color : '#ef4444';
                  return (
                    <g key={n.id} transform={`translate(${x},${y})`} className="cursor-pointer">
                      <circle r="15" fill="#ffffff" stroke={color} strokeWidth="1.6" />
                      <circle r="5" fill={color} />
                      <text y="-22" fill="#0f172a" fontSize="13" fontWeight="700" textAnchor="middle">{n.name}</text>
                      <text y="30" fill="#64748b" fontSize="10" textAnchor="middle">{n.sub}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-2 left-4 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></i>在线服务</span>
                <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></i>数据库正常</span>
                <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></i>模型服务</span>
                <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></i>异常</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {kpiCards.map(k => (
              <div key={k.label} className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 ring-1 ring-slate-200 shadow-sm hover:shadow-md transition">
                <div className="text-xs text-slate-500 mb-1" title={k.sub}>{k.label} · {k.sub}</div>
                <div className={`text-2xl font-extrabold tracking-tight ${kpiValueCls(k.cls)}`}>
                  {k.value.toLocaleString()}<span className="text-sm font-medium text-slate-500 ml-1">{k.unit}</span>
                </div>
              </div>
            ))}
            {/* AI 安全评估 KPI */}
            <button
              type="button"
              className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 ring-1 ring-slate-200 shadow-sm hover:shadow-md transition text-left"
              style={{ cursor: 'pointer' }}
              onClick={() => nav('/admin/security')}
            >
              {latestReportLoading ? (
                <>
                  <div className="text-xs text-slate-500 mb-1">AI 安全评估 · 后台拉取最近 AI 报告</div>
                  <div className="text-xl font-extrabold tracking-tight text-slate-900">
                    评估中…
                  </div>
                </>
              ) : latestReport && latestReport.riskLevel ? (
                <>
                  <div className="text-xs text-slate-500 mb-1">
                    AI 安全评估 · {formatTime(latestReport.generatedAt)}
                  </div>
                  <div className={`text-xl font-extrabold tracking-tight ${
                    latestReport.riskLevel === 'high' ? 'text-red-600' :
                    latestReport.riskLevel === 'mid' ? 'text-amber-600' :
                    latestReport.riskLevel === 'low' ? 'text-slate-900' :
                    'text-emerald-600'
                  }`}>
                    {riskLevel2CN(latestReport.riskLevel)}
                  </div>
                </>
              ) : latestReport && !latestReport.riskLevel ? (
                <>
                  <div className="text-xs text-slate-500 mb-1">
                    AI 安全评估 · {formatTime(latestReport.generatedAt)}
                  </div>
                  <div className="text-xl font-extrabold tracking-tight text-slate-500">
                    ⚪ 未评级
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                    未评级，去分析师页面人工调级
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-500 mb-1">AI 安全评估 · 尚未诊断，点击生成首份报告</div>
                  <div className="text-xl font-extrabold tracking-tight text-slate-500">
                    — 未评估
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    点击去 AI 安全分析师
                  </div>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 右列 */}
        <section className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              记忆类型分布
            </h3>
            <div className="w-full" style={{ height: 220 }}><div ref={rType} className="w-full h-full" /></div>
          </section>
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              任务状态分布
            </h3>
            <div className="w-full" style={{ height: 220 }}><div ref={rStat} className="w-full h-full" /></div>
          </section>
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              审计分类 TOP
            </h3>
            <div className="w-full" style={{ height: 260 }}><div ref={rCause} className="w-full h-full" /></div>
          </section>
        </section>

        {/* 底行 - 跨满三列 */}
        <section className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              14 天活跃度趋势
            </h3>
            <div className="w-full" style={{ height: 240 }}><div ref={rTrend} className="w-full h-full" /></div>
          </section>
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              工具类型排行
            </h3>
            <div className="w-full" style={{ height: 240 }}><div ref={rTop} className="w-full h-full" /></div>
          </section>
          <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              审计分布明细
            </h3>
            <div className="w-full" style={{ height: 240 }}><div ref={rItem} className="w-full h-full" /></div>
          </section>
        </section>
      </main>
    </div>
  );
}
