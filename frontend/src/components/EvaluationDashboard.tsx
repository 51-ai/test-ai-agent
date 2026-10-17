﻿import { useState, useEffect } from 'react';
import { BarChart3, Activity, Brain, Zap, Shield, Target, RefreshCw } from 'lucide-react';

// 类型定义
interface ABTestResult {
  experimentId: string;
  name: string;
  variantA: { name: string; conversions: number; impressions: number; avgResponseTime: number };
  variantB: { name: string; conversions: number; impressions: number; avgResponseTime: number };
  pValue: number;
  effectSize: number;
  confidenceInterval: [number, number];
  recommendation: 'adopt' | 'investigate' | 'reject';
  startTime: string;
  endTime: string;
}

interface DialogueQualityMetric {
  dimension: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

interface SystemHealth {
  cpuUsage: number;
  memoryUsage: number;
  activeConns: number;
  avgLatency: number;
  errorRate: number;
  uptime: number;
}

interface EvaluationData {
  abTests: ABTestResult[];
  dialogueQuality: DialogueQualityMetric[];
  systemHealth: SystemHealth;
  intentAccuracy: number;
  emotionAccuracy: number;
  totalEvaluations: number;
  lastUpdated: string;
}

// Mock 数据生成
function generateMockData(): EvaluationData {
  const now = new Date();
  return {
    abTests: [
      {
        experimentId: 'exp-001',
        name: '情感回复策略优化 v2.1',
        variantA: { name: '基准策略', conversions: 245, impressions: 1000, avgResponseTime: 1.2 },
        variantB: { name: '5级情感增强', conversions: 312, impressions: 1000, avgResponseTime: 1.35 },
        pValue: 0.012,
        effectSize: 0.34,
        confidenceInterval: [0.02, 0.11],
        recommendation: 'adopt',
        startTime: new Date(now.getTime() - 7 * 86400000).toISOString(),
        endTime: now.toISOString(),
      },
      {
        experimentId: 'exp-002',
        name: '意图识别混合模型 vs 纯正则',
        variantA: { name: '纯正则', conversions: 870, impressions: 1000, avgResponseTime: 0.8 },
        variantB: { name: '混合模型(TF-IDF)', conversions: 905, impressions: 1000, avgResponseTime: 1.05 },
        pValue: 0.03,
        effectSize: 0.22,
        confidenceInterval: [0.01, 0.07],
        recommendation: 'adopt',
        startTime: new Date(now.getTime() - 3 * 86400000).toISOString(),
        endTime: now.toISOString(),
      },
      {
        experimentId: 'exp-003',
        name: '上下文窗口扩展 5→10轮',
        variantA: { name: '5轮窗口', conversions: 320, impressions: 800, avgResponseTime: 0.95 },
        variantB: { name: '10轮窗口', conversions: 335, impressions: 800, avgResponseTime: 1.12 },
        pValue: 0.18,
        effectSize: 0.08,
        confidenceInterval: [-0.03, 0.06],
        recommendation: 'investigate',
        startTime: new Date(now.getTime() - 5 * 86400000).toISOString(),
        endTime: now.toISOString(),
      },
    ],
    dialogueQuality: [
      { dimension: '相关性', score: 92, trend: 'up', changePercent: 3.2 },
      { dimension: '有用性', score: 88, trend: 'up', changePercent: 1.5 },
      { dimension: '准确性', score: 95, trend: 'stable', changePercent: 0.3 },
      { dimension: '完整性', score: 85, trend: 'up', changePercent: 4.1 },
      { dimension: '清晰度', score: 90, trend: 'stable', changePercent: -0.5 },
      { dimension: '时效性', score: 87, trend: 'down', changePercent: -2.1 },
      { dimension: '整体质量', score: 89, trend: 'up', changePercent: 1.8 },
    ],
    systemHealth: {
      cpuUsage: 34.5,
      memoryUsage: 62.1,
      activeConns: 128,
      avgLatency: 245,
      errorRate: 0.12,
      uptime: 342120,
    },
    intentAccuracy: 90.5,
    emotionAccuracy: 87.3,
    totalEvaluations: 15820,
    lastUpdated: now.toISOString(),
  };
}

// 仪表盘颜色
const COLORS = {
  up: '#10b981',
  down: '#ef4444',
  stable: '#6b7280',
  adopt: '#10b981',
  investigate: '#f59e0b',
  reject: '#ef4444',
  bar: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb923c'],
};

// 子组件
function StatCard({ icon: Icon, label, value, unit, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; unit?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: color + '15' }}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
            {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function GaugeBar({ label, value, max, color, changePercent }: {
  label: string; value: number; max: number; color: string; changePercent?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color }}>{value}</span>
          {changePercent !== undefined && (
            <span className={`text-xs ${changePercent > 0 ? 'text-green-500' : changePercent < 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {changePercent > 0 ? '↑' : changePercent < 0 ? '↓' : '→'} {Math.abs(changePercent).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function EvaluationDashboard() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'abtest' | 'quality' | 'health'>('overview');

  useEffect(() => {
    // 模拟加载数据
    const timer = setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">加载评估数据...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶栏 */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-800">📊 评估仪表板</h1>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {([
                  ['overview', '概览', Target],
                  ['abtest', 'A/B测试', BarChart3],
                  ['quality', '对话质量', Activity],
                  ['health', '系统健康', Shield],
                ] as const).map(([tab, label, Icon]) => (
                  <button type="button"
                    
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition ${
                      activeTab === tab ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                更新于 {new Date(data.lastUpdated).toLocaleTimeString()}
              </span>
              <button type="button"
                
                onClick={refresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="刷新数据"
              >
                <RefreshCw className="w-5 h-5 text-gray-400" />
              </button>
              <button type="button"
                
                onClick={() => window.location.href = '/dev'}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                ← 开发者面板
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ============ 概览标签 ============ */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* 关键指标卡片 */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard icon={Brain} label="意图准确率" value={data.intentAccuracy} unit="%" color="#6366f1" />
              <StatCard icon={Activity} label="情感准确率" value={data.emotionAccuracy} unit="%" color="#8b5cf6" />
              <StatCard icon={Target} label="总评估数" value={data.totalEvaluations.toLocaleString()} color="#ec4899" />
              <StatCard icon={Zap} label="平均延迟" value={data.systemHealth.avgLatency} unit="ms" color="#f59e0b" />
            </div>

            {/* 对话质量概览 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" />
                对话质量七维评估
              </h2>
              <div className="grid grid-cols-2 gap-x-8">
                {data.dialogueQuality.map(q => (
                  <GaugeBar
                    key={q.dimension}
                    label={q.dimension}
                    value={q.score}
                    max={100}
                    color={COLORS.bar[data.dialogueQuality.indexOf(q) % COLORS.bar.length]}
                    changePercent={q.changePercent}
                  />
                ))}
              </div>
            </div>

            {/* A/B 测试摘要 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-500" />
                活跃 A/B 测试
              </h2>
              <div className="space-y-4">
                {data.abTests.map(test => (
                  <div key={test.experimentId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{test.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {test.variantA.name} ({test.variantA.conversions}) vs {test.variantB.name} ({test.variantB.conversions})
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">p={test.pValue.toFixed(3)}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                        test.recommendation === 'adopt' ? 'bg-green-500' :
                        test.recommendation === 'investigate' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}>
                        {test.recommendation === 'adopt' ? '采纳' : test.recommendation === 'investigate' ? '待观察' : '否决'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ A/B 测试标签 ============ */}
        {activeTab === 'abtest' && (
          <div className="space-y-6">
            {data.abTests.map(test => {
              const convRateA = (test.variantA.conversions / test.variantA.impressions) * 100;
              const convRateB = (test.variantB.conversions / test.variantB.impressions) * 100;
              const lift = ((convRateB - convRateA) / convRateA) * 100;

              return (
                <div key={test.experimentId} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{test.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">实验ID: {test.experimentId}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold text-white ${
                      test.recommendation === 'adopt' ? 'bg-green-500' :
                      test.recommendation === 'investigate' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {test.recommendation === 'adopt' ? '✅ 建议采纳' : test.recommendation === 'investigate' ? '🔍 待深入调查' : '❌ 建议否决'}
                    </span>
                  </div>

                  {/* 转换率对比柱状图 */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">对照组: {test.variantA.name}</p>
                      <div className="bg-gray-100 rounded-lg p-4">
                        <p className="text-3xl font-bold text-gray-800">{convRateA.toFixed(1)}%</p>
                        <p className="text-sm text-gray-500 mt-1">转化率 ({test.variantA.conversions}/{test.variantA.impressions})</p>
                        <p className="text-xs text-gray-400 mt-1">平均响应: {test.variantA.avgResponseTime}s</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-600 mb-2">实验组: {test.variantB.name}</p>
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                        <p className="text-3xl font-bold text-purple-700">{convRateB.toFixed(1)}%</p>
                        <p className="text-sm text-purple-600 mt-1">转化率 ({test.variantB.conversions}/{test.variantB.impressions})</p>
                        <p className="text-xs text-purple-400 mt-1">平均响应: {test.variantB.avgResponseTime}s</p>
                      </div>
                    </div>
                  </div>

                  {/* 统计指标 */}
                  <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">提升幅度 (Lift)</p>
                      <p className={`text-xl font-bold ${lift > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {lift > 0 ? '+' : ''}{lift.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">p值</p>
                      <p className={`text-xl font-bold ${test.pValue < 0.05 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {test.pValue.toFixed(4)}
                      </p>
                      <p className="text-xs text-gray-400">{test.pValue < 0.05 ? '✅ 统计显著' : '⚠️ 不显著'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">效应量 (Cohen's d)</p>
                      <p className="text-xl font-bold text-gray-800">{test.effectSize.toFixed(3)}</p>
                      <p className="text-xs text-gray-400">
                        {test.effectSize > 0.5 ? '大效应' : test.effectSize > 0.2 ? '中效应' : '小效应'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">95% 置信区间</p>
                      <p className="text-xl font-bold text-gray-800">
                        [{test.confidenceInterval[0].toFixed(3)}, {test.confidenceInterval[1].toFixed(3)}]
                      </p>
                    </div>
                  </div>

                  {/* 时间 */}
                  <p className="text-xs text-gray-400 mt-4">
                    实验周期: {new Date(test.startTime).toLocaleDateString()} → {new Date(test.endTime).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ============ 对话质量标签 ============ */}
        {activeTab === 'quality' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">七维质量雷达</h2>
              <div className="space-y-4">
                {data.dialogueQuality.map((q, i) => (
                  <div key={q.dimension} className="flex items-center gap-4">
                    <span className="w-20 text-sm font-medium text-gray-600 text-right">{q.dimension}</span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div
                          className="h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                          style={{
                            width: `${q.score}%`,
                            backgroundColor: COLORS.bar[i % COLORS.bar.length],
                          }}
                        >
                          <span className="text-xs text-white font-bold">{q.score}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`w-16 text-sm font-medium ${
                      q.trend === 'up' ? 'text-green-600' : q.trend === 'down' ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {q.trend === 'up' ? '↑' : q.trend === 'down' ? '↓' : '→'} {Math.abs(q.changePercent)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 趋势图（模拟） */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">质量趋势 (近7天)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 text-gray-500 font-medium">维度</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D1</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D2</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D3</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D4</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D5</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D6</th>
                      <th className="text-right py-3 text-gray-500 font-medium">D7(今日)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dialogueQuality.map(q => {
                      const baseScore = q.score - q.changePercent;
                      const trend = q.trend === 'up' ? 1 : q.trend === 'down' ? -1 : 0;
                      return (
                        <tr key={q.dimension} className="border-b border-gray-50">
                          <td className="py-3 font-medium text-gray-700">{q.dimension}</td>
                          {Array.from({ length: 7 }, (_, i) => {
                            const dayScore = baseScore + trend * (i - 6) * (Math.abs(q.changePercent) / 6);
                            return (
                              <td key={i} className="py-3 text-right">
                                <span className={`font-mono ${i === 6 ? 'font-bold text-primary-600' : 'text-gray-600'}`}>
                                  {Math.round(Math.max(0, Math.min(100, dayScore)))}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============ 系统健康标签 ============ */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">CPU 使用率</h3>
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-bold ${data.systemHealth.cpuUsage > 80 ? 'text-red-600' : data.systemHealth.cpuUsage > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {data.systemHealth.cpuUsage.toFixed(1)}
                  </span>
                  <span className="text-gray-400 mb-1">%</span>
                </div>
                <div className="mt-3 w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      data.systemHealth.cpuUsage > 80 ? 'bg-red-500' : data.systemHealth.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${data.systemHealth.cpuUsage}%` }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">内存使用率</h3>
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-bold ${data.systemHealth.memoryUsage > 85 ? 'text-red-600' : data.systemHealth.memoryUsage > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {data.systemHealth.memoryUsage.toFixed(1)}
                  </span>
                  <span className="text-gray-400 mb-1">%</span>
                </div>
                <div className="mt-3 w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      data.systemHealth.memoryUsage > 85 ? 'bg-red-500' : data.systemHealth.memoryUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${data.systemHealth.memoryUsage}%` }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">错误率</h3>
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-bold ${data.systemHealth.errorRate > 1 ? 'text-red-600' : data.systemHealth.errorRate > 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {data.systemHealth.errorRate.toFixed(2)}
                  </span>
                  <span className="text-gray-400 mb-1">%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">活跃连接数</h3>
                <p className="text-4xl font-bold text-gray-800">{data.systemHealth.activeConns}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">平均延迟</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-gray-800">{data.systemHealth.avgLatency}</span>
                  <span className="text-gray-400 mb-1">ms</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">运行时间</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-gray-800">
                    {Math.floor(data.systemHealth.uptime / 3600)}
                  </span>
                  <span className="text-gray-400 mb-1">小时</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
