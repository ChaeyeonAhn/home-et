// LLM 등급(−2 ~ +2) → 가중치 변환, 분석 결과 타입 (docs/metrics.md 4-1, 4-2)
import { clampWeights, normalizeWeights, type WeightKey, type Weights } from "./calc";

export type Levels = Record<WeightKey, number>; // 각 −2 ~ 2 정수
export type Confidence = "high" | "medium" | "low";

/** 원문에서 따온 근거 한 줄 */
export interface Evidence {
  quote: string;
  axis: WeightKey;
  dir: "+" | "-";
}

/** /api/weights 응답 = 앱 상태에 저장하는 분석 결과. money·time·body는 합 1, 각각 [0.15, 0.60] */
export interface WeightAnalysis extends Weights {
  source: "llm" | "keyword" | "default";
  levels: Levels | null; // LLM이 매긴 등급 (대체 분석이면 null)
  evidence: Evidence[];
  confidence: Confidence;
  reason: string; // 화면에 보여 줄 한 줄 근거
}

export const LEVEL_BASE = 1.5;
export const AXIS_LABEL: Record<WeightKey, string> = { money: "돈", time: "시간", body: "체력" };

/** 등급 → 가중치. 1.5^s로 바꾸고 정규화한 뒤 [0.15, 0.60] 범위로 맞춘다. */
export function levelsToWeights(levels: Levels): Weights {
  return clampWeights(
    normalizeWeights({
      money: Math.pow(LEVEL_BASE, levels.money),
      time: Math.pow(LEVEL_BASE, levels.time),
      body: Math.pow(LEVEL_BASE, levels.body),
    }),
  );
}

/** 근거 인용문이 원문에 실제로 있는지 검사 (공백·문장부호 차이는 무시) */
export function quoteExists(text: string, quote: string): boolean {
  const squash = (s: string) => s.replace(/[\s.,!?~"'“”‘’·…]/g, "");
  const q = squash(quote);
  return q.length >= 2 && squash(text).includes(q);
}

/** 근거 목록 → 한 줄 문구. 예: “학점 관리” → 시간↑, “돈은 괜찮아요” → 돈↓ */
export function evidenceText(evidence: Evidence[]) {
  return evidence.map((e) => `“${e.quote}” → ${AXIS_LABEL[e.axis]}${e.dir === "+" ? "↑" : "↓"}`).join(", ");
}
