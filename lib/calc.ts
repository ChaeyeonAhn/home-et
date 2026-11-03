// 자취지수 산출식 (기획서 초안 + 프로토타입 화면 기준)
// 모든 금액은 원, 모든 값은 "학기 중 한 달" 기준입니다 (월 등교일 = 주당 등교일 × 4.3, 기획서 기준).

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
export const WEEKS_PER_MONTH = 4.3; // 한 달 주 수 (기획서). 방학은 반영하지 않음
export const DEFAULT_LIVING_ROUND_TRIP_MIN = 20; // ①: 학교 주변 자취 가정 왕복 20분
export const DEFAULT_WEIGHTS: Weights = { money: 1 / 3, time: 1 / 3, body: 1 / 3 };

export const DEFAULT_COSTS: Omit<LivingCosts, "rent" | "mgmt"> = {
  living: 150_000,
  initialTotal: 800_000,
  deposit: 10_000_000,
  annualRate: 0.035,
};

/**
 * 수도권 통합 거리비례 요금(편도, 카드). Google 경로에 요금이 비어 올 때 씀.
 * 10km까지 1,550원, 10~50km 5km마다 +100, 50km 초과 8km마다 +100
 */
// ponytail: 광역버스·GTX 별도 요금 미반영. 해당 경로가 많아지면 탈것 종류별 요금 추가
export function metroFare(km: number) {
  let fare = 1_550;
  if (km > 10) fare += Math.ceil((Math.min(km, 50) - 10) / 5) * 100;
  if (km > 50) fare += Math.ceil((km - 50) / 8) * 100;
  return fare;
}

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
  /** 가중치를 반영한 "내가 낼 의향이 있는 월 금액" = E / (3·w돈) */
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

  const E = 3 * (w.time * timeValue + w.body * bodyValue);
  const K = 3 * w.money * extraCost;

  let index: number;
  if (extraCost <= 0) index = 100;
  else if (E + K <= 0) index = 0;
  else index = (100 * E) / (E + K);

  const willingness = w.money > 0 ? E / (3 * w.money) : Number.POSITIVE_INFINITY;
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
export const MIN_PCT = 5;

export function toPercents(w: Weights): Percents {
  const money = Math.round(w.money * 100);
  const time = Math.round(w.time * 100);
  return { money, time, body: 100 - money - time };
}

export function fromPercents(p: Percents): Weights {
  return { money: p.money / 100, time: p.time / 100, body: p.body / 100 };
}

/** 하나를 바꾸면 나머지 둘이 기존 비율대로 남은 몫을 나눠 갖는다. */
export function rebalance(p: Percents, key: WeightKey, value: number): Percents {
  const v = Math.max(MIN_PCT, Math.min(100 - 2 * MIN_PCT, Math.round(value)));
  const others = (Object.keys(p) as WeightKey[]).filter((k) => k !== key);
  const [a, b] = others;
  const rest = 100 - v;
  const sum = p[a] + p[b];
  let av = sum > 0 ? Math.round((rest * p[a]) / sum) : Math.round(rest / 2);
  av = Math.max(MIN_PCT, Math.min(rest - MIN_PCT, av));
  return { ...p, [key]: v, [a]: av, [b]: rest - av } as Percents;
}

export function normalizeWeights(w: Weights): Weights {
  const m = Math.max(0, w.money), t = Math.max(0, w.time), b = Math.max(0, w.body);
  const s = m + t + b;
  if (!Number.isFinite(s) || s <= 0) return DEFAULT_WEIGHTS;
  return { money: m / s, time: t / s, body: b / s };
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
