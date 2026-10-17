import type { RiskLevel } from '../services/adminApi';

export interface ExtractedRisk {
  level?: RiskLevel;
  scoreAIScore?: number;
  dimScores?: { auth?: number; data?: number; model?: number; ops?: number };
}

const CN_LEVEL_MAP: Record<string, RiskLevel> = {
  '高危': 'high',
  '中危': 'mid',
  '低危': 'low',
  '良好': 'low',
  '优秀': 'excellent',
  '安全': 'excellent',
};

export function extractRiskFromMarkdown(md: string): ExtractedRisk {
  const out: ExtractedRisk = {};
  if (!md) return out;

  try {
    const mScore =
      md.match(/综合风险评分\s*[:：]?\s*(\d+(?:\.\d+)?)/) ||
      md.match(/综合安全得分\s*[:：]?\s*(\d+(?:\.\d+)?)/) ||
      md.match(/总分\s*[:：]?\s*(\d+(?:\.\d+)?)/);
    if (mScore) {
      const v = parseFloat(mScore[1]);
      if (Number.isFinite(v)) out.scoreAIScore = v;
    }

    const lvlRegexes = [
      /综合风险(?:等级|评估|结论)?\s*[:：]\s*(高危|中危|低危|优秀|良好|安全)/,
      /总体安全(?:状况|等级|评估)?\s*[:：]\s*(高危|中危|低危|优秀|良好|安全)/,
      /风险等级\s*[:：]\s*(高危|中危|低危|优秀|良好|安全)/,
      /安全(?:状况|评级|评估|结论)\s*[:：]\s*(高危|中危|低危|优秀|良好|安全)/,
    ];
    for (const re of lvlRegexes) {
      const m = md.match(re);
      if (m && CN_LEVEL_MAP[m[1]]) {
        out.level = CN_LEVEL_MAP[m[1]];
        break;
      }
    }
    if (!out.level) {
      const badge = md.match(/(🔥|高危|⚠|中危|🟡|低危|✅|优秀|良好|安全)/);
      if (badge) {
        const b = badge[0];
        if (b.includes('🔥') || b.includes('高危')) out.level = 'high';
        else if (b.includes('⚠') || b.includes('中危')) out.level = 'mid';
        else if (b.includes('🟡') || b.includes('低危') || b.includes('良好')) out.level = 'low';
        else if (b.includes('✅') || b.includes('优秀') || b.includes('安全')) out.level = 'excellent';
      }
    }

    const dimMap: [RegExp, 'auth' | 'data' | 'model' | 'ops'][] = [
      [/身份(?:安全)?\s*(?:强度|评分|得分)\s*[:：]?\s*(\d+(?:\.\d+)?)/, 'auth'],
      [/数据(?:安全)?\s*(?:强度|评分|得分)\s*[:：]?\s*(\d+(?:\.\d+)?)/, 'data'],
      [/模型(?:安全)?\s*(?:强度|评分|得分)\s*[:：]?\s*(\d+(?:\.\d+)?)/, 'model'],
      [/运维(?:安全)?\s*(?:强度|评分|得分)\s*[:：]?\s*(\d+(?:\.\d+)?)/, 'ops'],
    ];
    out.dimScores = {};
    for (const [re, key] of dimMap) {
      const m = md.match(re);
      if (m) {
        const v = parseFloat(m[1]);
        if (Number.isFinite(v)) {
          (out.dimScores as any)[key] = v;
        }
      }
    }
  } catch {
    // 不抛错
  }
  return out;
}
