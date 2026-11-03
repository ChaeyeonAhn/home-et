// 자취지수 산출식 (기획서 초안 + 프로토타입 화면 기준)
// 모든 금액은 원, 모든 값은 "방학 포함 월평균"입니다.

export type Weights = { money: number; time: number; body: number }; // 합 = 1

export interface Commute {
  oneWayMin: number; // 본가→학교 편도 소요시간(분)
  transfers: number; // 환승 횟수
  headwayMin: number; // 배차 간격(분) - 대기 여유 시간으로 왕복에 1회 반영
  roundTripFare: number; // 왕복 교통비(원)
  daysPerWeek: number; // 주당 등교일
  hourlyWage: number; // 내 1시간의 기준 시급(원)
}

export interface LivingCosts {
  rent: number; // 월세
  mgmt: number; // 관리비
  living: number; // 추가 생활비 (식비·공과금 등)
  initialTotal: number; // 초기 비용 총액 (중개수수료·이사·가구가전) → 24개월 분할
  deposit: number; // 보증금
  annualRate: number; // 보증금 기회비용 연이율
}

// ── 팀 확정 전 가정값 ─────────────────────────────
export const MIN_WAGE_2026 = 10_320;
export const SEMESTER_WEEKS_PER_YEAR = 32; // 2학기 × 16주
export const WEEKS_PER_MONTH = SEMESTER_WEEKS_PER_YEAR / 12; // 방학 포함 월평균
export const DEFAULT_LIVING_ROUND_TRIP_MIN = 20; // ①: 학교 주변 자취 가정 왕복 20분
export const DEFAULT_WEIGHTS: Weights = { money: 1 / 3, time: 1 / 3, body: 1 / 3 };

/** 가중치 완충 지수 γ: 균등(1/3)을 1로 두는 배율 3w에 γ 제곱을 씌움 (1 = v1, 0 = 가치관 무시) */
export const GAMMA = 0.5;
/** 가중치 하나가 가질 수 있는 범위. 슬라이더·AI·키워드 분석 모두 이 범위 안 */
export const WEIGHT_MIN = 0.15;
export const WEIGHT_MAX = 0.6;
const amp = (x: number) => Math.pow(3 * x, GAMMA);

export const DEFAULT_COSTS: Omit<LivingCosts, "rent" | "mgmt"> = {
  living: 150_000,
  initialTotal: 1_650_000,
  deposit: 10_000_000,
  annualRate: 0.035,
};

/** 피로 계수 f: 환승이 많을수록 같은 1시간이 더 지친다 (상한 0.5). */
export function fatigueCoef(transfers: number) {
  return Math.min(0.5, 0.15 + 0.1 * Math.max(0, transfers));
}

export interface Result {
  commuteDailyMin: number;
  savedDailyMin: number;
  schoolDaysPerMonth: number;
  savedHours: number;
  timeValue: number;
  fatigue: number;
  fatigueHours: number;
  bodyValue: number;
  gainTotal: number;
  rentAndMgmt: number;
  living: number;
  initialMonthly: number;
  depositCost: number;
  savedFare: number;
  extraCost: number;
  /** 가중치를 반영한 "내가 낼 의향이 있는 월 금액" = E / a(w돈) */
  willingness: number;
  index: number; // 0~100, 50 = 손익분기
  myHourValue: number; // 내가 매기는 1시간의 가치
  buyBackPrice: number; // 자취로 1시간을 되사는 가격
  rentCap: number; // 지수가 50이 되는 월세
}

export function compute(
  c: Commute,
  cost: LivingCosts,
  w: Weights,
  livingRoundTripMin = DEFAULT_LIVING_ROUND_TRIP_MIN,
  livingRoundTripFare = 0, // 자취 지역에서도 버스·지하철을 타면 그 왕복 요금
): Result {
  const commuteDailyMin = 2 * c.oneWayMin + c.headwayMin;
  const savedDailyMin = Math.max(0, commuteDailyMin - livingRoundTripMin);
  const schoolDaysPerMonth = c.daysPerWeek * WEEKS_PER_MONTH;
  const savedHours = (savedDailyMin / 60) * schoolDaysPerMonth;

  const timeValue = savedHours * c.hourlyWage;
  const fatigue = fatigueCoef(c.transfers);
  const fatigueHours = savedHours * fatigue;
  const bodyValue = fatigueHours * c.hourlyWage;

  const initialMonthly = cost.initialTotal / 24;
  const depositCost = (cost.deposit * cost.annualRate) / 12;
  const savedFare = Math.max(0, c.roundTripFare - livingRoundTripFare) * schoolDaysPerMonth;
  const extraCost =
    cost.rent + cost.mgmt + cost.living + initialMonthly + depositCost - savedFare;

  // a(x) = (3x)^γ: 균등이면 1, 가중치 범위 [0.15, 0.60]에서 약 0.67 ~ 1.34
  const E = timeValue * amp(w.time) + bodyValue * amp(w.body);
  const K = extraCost * amp(w.money);

  let index: number;
  if (extraCost <= 0) index = 100;
  else if (E + K <= 0) index = 0;
  else index = (100 * E) / (E + K);

  // 화면에선 w돈 ≥ 0.15라 항상 유한. 0은 compute()를 직접 부를 때만 생김
  const willingness = w.money > 0 ? E / amp(w.money) : Number.POSITIVE_INFINITY;
  const rentCap = willingness - cost.mgmt - cost.living - initialMonthly - depositCost + savedFare;

  return {
    commuteDailyMin,
    savedDailyMin,
    schoolDaysPerMonth,
    savedHours,
    timeValue,
    fatigue,
    fatigueHours,
    bodyValue,
    gainTotal: timeValue + bodyValue,
    rentAndMgmt: cost.rent + cost.mgmt,
    living: cost.living,
    initialMonthly,
    depositCost,
    savedFare,
    extraCost,
    willingness,
    index,
    myHourValue: savedHours > 0 ? willingness / savedHours : 0,
    buyBackPrice: savedHours > 0 ? extraCost / savedHours : 0,
    rentCap,
  };
}

// ── 가중치 슬라이더: 정수 % 로 관리, 합 100 유지 ─────────
export type WeightKey = keyof Weights;
export type Percents = Record<WeightKey, number>;
export const MIN_PCT = Math.round(WEIGHT_MIN * 100); // 15
export const MAX_PCT = Math.round(WEIGHT_MAX * 100); // 60
export const STEP_PCT = 5;

export function toPercents(w: Weights): Percents {
  const money = Math.round(w.money * 100);
  const time = Math.round(w.time * 100);
  return { money, time, body: 100 - money - time };
}

export function fromPercents(p: Percents): Weights {
  return { money: p.money / 100, time: p.time / 100, body: p.body / 100 };
}

const snap = (v: number) => Math.round(v / STEP_PCT) * STEP_PCT;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * 하나를 바꾸면 나머지 둘이 기존 비율대로 남은 몫을 나눠 갖는다.
 * 세 값 모두 5% 단위, [15, 60] 안. 바꾼 값이 15면 남은 85를 둘이 나눠야 해서 한쪽 상한도 함께 건다.
 */
export function rebalance(p: Percents, key: WeightKey, value: number): Percents {
  const v = clamp(snap(value), MIN_PCT, MAX_PCT);
  const [a, b] = (Object.keys(p) as WeightKey[]).filter((k) => k !== key);
  const rest = 100 - v;
  const sum = p[a] + p[b];
  let av = snap(sum > 0 ? (rest * p[a]) / sum : rest / 2);
  av = clamp(av, Math.max(MIN_PCT, rest - MAX_PCT), Math.min(MAX_PCT, rest - MIN_PCT));
  return { ...p, [key]: v, [a]: av, [b]: rest - av } as Percents;
}

/** 범위 밖 % (v1 저장값 등)를 [15, 60] 안으로 */
export const clampPercents = (p: Percents): Percents =>
  toPercents(clampWeights(normalizeWeights(fromPercents(p))));

export function normalizeWeights(w: Weights): Weights {
  const m = Math.max(0, w.money), t = Math.max(0, w.time), b = Math.max(0, w.body);
  const s = m + t + b;
  if (!Number.isFinite(s) || s <= 0) return DEFAULT_WEIGHTS;
  return { money: m / s, time: t / s, body: b / s };
}

/**
 * 합 1인 가중치를 [0.15, 0.60] 안으로. 벗어난 축은 경계값에 고정하고,
 * 남거나 모자란 몫을 아직 고정되지 않은 축에 기존 비율대로 나눈다.
 * 상한 초과를 먼저 처리하고, 없을 때만 하한 미달을 처리한다
 * (한 번에 둘 다 고정하면 남는 몫을 받을 축이 없어 합이 1이 안 될 수 있음).
 */
export function clampWeights(input: Weights): Weights {
  const keys = Object.keys(input) as WeightKey[];
  const w = { ...input };
  const fixed = new Set<WeightKey>();

  for (let i = 0; i < keys.length; i++) {
    const free0 = keys.filter((k) => !fixed.has(k));
    let targets = free0.filter((k) => w[k] > WEIGHT_MAX);
    let bound = WEIGHT_MAX;
    if (targets.length === 0) {
      targets = free0.filter((k) => w[k] < WEIGHT_MIN);
      bound = WEIGHT_MIN;
    }
    if (targets.length === 0) break;
    for (const k of targets) {
      w[k] = bound;
      fixed.add(k);
    }

    const free = keys.filter((k) => !fixed.has(k));
    const fixedSum = keys.filter((k) => fixed.has(k)).reduce((s, k) => s + w[k], 0);
    const freeSum = free.reduce((s, k) => s + w[k], 0);
    for (const k of free) w[k] = freeSum > 0 ? (w[k] / freeSum) * (1 - fixedSum) : (1 - fixedSum) / free.length;
  }
  return w;
}

// ── 표시용 포맷 ─────────────────────────────
export const man = (won: number, digits = 1) =>
  `${(won / 10_000).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}만 원`;
export const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
export const hours = (h: number) => `${h.toFixed(1)}시간`;
export function hm(min: number) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}분`;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}
