// Gemini를 못 쓸 때(키 없음·실패) 쓰는 키워드 기반 대체 분석 (docs/metrics.md 4-3)
import { DEFAULT_WEIGHTS, clampWeights, normalizeWeights, type WeightKey } from "./calc";
import { AXIS_LABEL, type WeightAnalysis } from "./weights";

const KEYWORDS: Record<WeightKey, string[]> = {
  money: ["돈", "부모", "부담", "아끼", "절약", "용돈", "비용", "저축", "생활비", "빚", "대출", "월세"],
  time: ["공부", "학점", "시험", "동아리", "시간", "알바", "취업", "인턴", "준비", "자격증", "프로젝트", "대외활동", "자기계발"],
  body: ["체력", "피곤", "피로", "힘들", "휴식", "잠", "수면", "건강", "지치", "운동", "멀미", "녹초"],
};

export const defaultAnalysis = (reason: string): WeightAnalysis => ({
  ...DEFAULT_WEIGHTS, source: "default", levels: null, evidence: [], confidence: "low", reason,
});

export function keywordWeights(goal: string): WeightAnalysis {
  const text = goal.trim();
  if (!text) return defaultAnalysis("생활 목표가 비어 있어 세 기준을 똑같이 두었어요.");

  const hits: Record<WeightKey, string[]> = { money: [], time: [], body: [] };
  (Object.keys(KEYWORDS) as WeightKey[]).forEach((k) => {
    for (const word of KEYWORDS[k]) if (text.includes(word)) hits[k].push(word);
  });
  const total = hits.money.length + hits.time.length + hits.body.length;
  if (total === 0) return defaultAnalysis("뚜렷한 우선순위를 찾지 못해 세 기준을 똑같이 두었어요.");

  // weight_k ∝ 1 + 2 × (키워드 수), LLM 결과와 같은 [0.15, 0.60] 범위 처리
  const w = clampWeights(
    normalizeWeights({
      money: 1 + 2 * hits.money.length,
      time: 1 + 2 * hits.time.length,
      body: 1 + 2 * hits.body.length,
    }),
  );
  const reason = (Object.keys(hits) as WeightKey[])
    .filter((k) => hits[k].length)
    .map((k) => `${hits[k].map((h) => `“${h}”`).join(", ")} → ${AXIS_LABEL[k]}`)
    .join(", ");
  return { ...w, source: "keyword", levels: null, evidence: [], confidence: "low", reason: `키워드 분석: ${reason}` };
}
