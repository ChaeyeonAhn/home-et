/**
 * 화면에 보여줄 값·문구를 만드는 순수 함수들.
 * 디자인을 바꿀 때 화면 JSX만 다시 쓰고, 숫자와 문구는 여기서 그대로 가져다 쓰면 됩니다.
 */
import {
  ADJ_MAX, ADJ_MIN, MIN_WAGE_2026, brokerageFee, compute, hm, hours, man, sameAdjust, sanitizeAdjust, signed, won,
  CONTRACT_MONTHS, type Adjust, type LivingCosts, type WeightKey,
} from "./calc";
import { findSchool, type Region, type School } from "./data";
import {
  TERMS, buildSteps, dLabel, googleCalendarUrl, md, parseDate, stepDateText, type Step,
} from "./dday";
import { regionFare, selectedRegion, type AppState } from "./app-state";

export const WEIGHT_LABELS: { key: WeightKey; label: string; hint: string }[] = [
  { key: "money", label: "돈", hint: "자취 비용을 얼마나 무겁게 느끼는지" },
  { key: "time", label: "시간", hint: "되찾은 시간을 얼마나 값지게 쓸지" },
  { key: "body", label: "체력", hint: "통학 피로를 얼마나 신경 쓰는지" },
];

const LEVELS: Record<number, string> = {
  [-3]: "거의 신경 안 씀", [-2]: "덜 중요", [-1]: "조금 덜 중요", 0: "보통", 1: "조금 중요", 2: "중요", 3: "가장 중요",
};
export const levelText = (a: number) => LEVELS[a] ?? "보통";
export const adjustText = (a: Adjust) => WEIGHT_LABELS.map(({ key, label }) => `${label} ${signed(a[key])}`).join(" · ");
const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}점`;

export interface Line { label: string; value: string; total?: boolean }

// ── ② 리포트 ─────────────────────────────
export function reportModel(state: AppState, name: string | null) {
  const r = compute(state.commute, state.costs, state.adj);
  const recommended = r.index >= 50;
  const nextLabel = recommended ? "자취 준비하기" : "그래도 자취하기";
  const myHour = Math.round(r.myHourValue);
  const price = Math.round(r.buyBackPrice);
  const scale = Math.max(myHour, price, 1);
  const aiAdj = state.analysis ? sanitizeAdjust(state.analysis) : null;
  const rawIndex = 50 + r.contrib.time + r.contrib.body + r.contrib.money;

  return {
    title: name ? `${name} 님의 자취지수` : "내 자취지수",
    index: r.index.toFixed(1),
    indexPct: r.index,
    recommended,
    verdict: recommended ? "자취 추천" : "다시 생각해 보기",
    hasSavedTime: r.savedHours > 0,
    headline: {
      price: man(price),
      subject: name ? `지금 ${name} 님은` : "지금 내 가치관으로는",
      myHour: man(myHour),
    },
    bars: [
      { label: "내가 매기는 1시간의 가치", value: won(myHour), pct: (myHour / scale) * 100, tone: "primary" as const },
      { label: "자취로 1시간을 되사는 가격", value: won(price), pct: (price / scale) * 100, tone: "accent" as const },
    ],
    // 1시간의 가치 = 최저임금 × (m시간 + f·m체력) / m돈  (= W / ΔH, compute()의 myHourValue와 같은 식)
    hourBasis: `${won(MIN_WAGE_2026)}(2026 최저임금) × (시간 ×${r.multipliers.time.toFixed(2)} + 체력 ×${r.multipliers.body.toFixed(2)} × 피로 ${r.fatigue.toFixed(2)}) ÷ 돈 ×${r.multipliers.money.toFixed(2)} = ${won(myHour)}`,
    summary: `한 달에 약 ${hours(r.savedHours)}을 되찾는 대신 약 ${man(r.extraCost, 0)}을 더 써요. 내 1시간의 가치가 자취 가격보다 크면 자취가 이득이에요.`,
    gains: [
      { label: "통학 시간 (여유 시간 포함)", value: hours(r.savedHours) },
      { label: "시간 가치", value: man(r.timeValue) },
      { label: `피로 회복 시간 (계수 ${r.fatigue.toFixed(2)})`, value: hours(r.fatigueHours) },
      { label: "체력 가치", value: man(r.bodyValue) },
      { label: "합계", value: man(r.gainTotal), total: true },
    ] satisfies Line[],
    costs: [
      { label: "월세 · 관리비", value: man(r.rentAndMgmt) },
      { label: "추가 생활비", value: man(r.living) },
      { label: "초기 비용 (중개보수 포함)", value: man(r.initialMonthly) },
      { label: "보증금 기회비용 · 절약 교통비", value: man(r.depositCost - r.savedFare) },
      { label: "합계", value: man(r.extraCost), total: true },
    ] satisfies Line[],
    eveningGain: `+${hm(r.savedDailyMin)}`,
    lateDays: `주 ${state.commute.daysPerWeek}일`,
    nextLabel,
    /** 자취지수 = 50 + 항목별 점수 (선형식이라 그대로 더하면 돼요) */
    indexLines: [
      { label: "손익분기 기준", value: "50.0점" },
      { label: `시간 가치 ×${r.multipliers.time.toFixed(2)}`, value: pts(r.contrib.time) },
      { label: `체력 가치 ×${r.multipliers.body.toFixed(2)}`, value: pts(r.contrib.body) },
      { label: `추가 비용 ×${r.multipliers.money.toFixed(2)}`, value: pts(r.contrib.money) },
      { label: rawIndex < 0 || rawIndex > 100 ? "자취지수 (0~100으로 자름)" : "자취지수", value: `${r.index.toFixed(1)}점`, total: true },
    ] satisfies Line[],
    brokerageNote: `지금 보증금·월세의 중개보수 법정 상한은 ${man(r.brokerage)}이에요(부가세 별도). 이사·가구가전과 함께 24개월로 나눠 초기 비용에 넣어요.`,
    indexNote: `점수는 월 순이득에 비례해요. 1점 ≈ ${man(r.scale / 50)}`,
    adjust: WEIGHT_LABELS.map(({ key, label, hint }) => ({
      key,
      label,
      hint,
      value: state.adj[key],
      min: ADJ_MIN,
      max: ADJ_MAX,
      display: signed(state.adj[key]),
      level: levelText(state.adj[key]),
      perStep: `한 칸에 ${pts(r.pointsPerStep[key])}`,
    })),
    aiAdj,
    isAiValue: !!aiAdj && sameAdjust(aiAdj, state.adj),
    reason: state.analysis
      ? {
          text: `${state.analysis.source === "gemini" ? "AI 분석 근거: " : ""}${state.analysis.reason}`,
          fallbackNote: state.analysis.source !== "gemini" ? "Gemini API에 연결하지 못해 대체 분석을 썼어요." : null,
        }
      : null,
    stayMessage: `${name ? `${name} 님, ` : ""}리포트는 이 기기에 저장돼요. 등교일이나 시간표가 바뀌면 다시 계산해 보세요. 마음이 바뀌면 언제든 “${nextLabel}”로 넘어갈 수 있어요.`,
  };
}

// ── ③ 월세 추천 ─────────────────────────────
function rentMessage(cap: number, region: Region) {
  const median = man(region.rentMedian, 0);
  if (!Number.isFinite(cap)) return "상한을 계산할 수 없어요. 리포트의 가치관 조정값을 다시 확인해 주세요.";
  if (cap <= 0)
    return `지금 가치관 기준으로는 ${region.name}에서 어떤 월세를 내도 통학보다 손해예요. 리포트에서 가치관을 다시 살펴보거나 통학을 이어가는 것도 방법이에요.`;
  if (cap >= region.rentMedian * 1.5)
    return `${region.name} 원룸 월세 중앙값(${median})보다 상한이 훨씬 높아요. 시세 안에서 넓게 고를 수 있어요.`;
  if (cap >= region.rentMedian)
    return `${region.name} 원룸 월세 중앙값(${median})이 상한 안에 들어와요. 이 지역에서 고르면 통학보다 손해가 아니에요.`;
  return `${region.name} 원룸 월세 중앙값(${median})이 상한보다 높아요. 중앙값보다 싼 방을 찾거나 다른 지역도 같이 비교해 보세요.`;
}

function mapUrl(school: School, region: Region) {
  const pad = 0.012;
  const minLat = Math.min(region.lat, school.lat) - pad, maxLat = Math.max(region.lat, school.lat) + pad;
  const minLng = Math.min(region.lng, school.lng) - pad, maxLng = Math.max(region.lng, school.lng) + pad;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${school.lat},${school.lng}`;
}

export function rentModel(state: AppState, name: string | null) {
  const school = findSchool(state.schoolId);
  const region = selectedRegion(state);
  const isCustom = region.id === "custom";
  const costs: LivingCosts = { ...state.costs, rent: region.rentMedian, mgmt: region.mgmtMedian };
  const livingMin = region.oneWayMin * 2;
  const r = compute(state.commute, costs, state.adj, livingMin, regionFare(region));
  const finite = Number.isFinite(r.rentCap);
  const capWon = Math.max(0, r.rentCap);
  const cap = man(capWon);
  // 상한 월세에서의 중개보수로 내역을 다시 맞춤 (중개보수가 월세에 따라 달라짐)
  const initialAtCap = (costs.initialTotal + brokerageFee(costs.deposit, capWon)) / CONTRACT_MONTHS;
  // 보증금을 1,000만 원 더 넣으면 상한이 얼마나 내려가는지
  const DEPOSIT_STEP = 10_000_000;
  const more = compute(state.commute, { ...costs, deposit: costs.deposit + DEPOSIT_STEP }, state.adj, livingMin, regionFare(region));
  const ratePct = Math.round(costs.annualRate * 1000) / 10;
  const example = isCustom ? undefined : "(예시 데이터)";

  return {
    school,
    region,
    isCustom,
    regions: school.regions,
    title: name ? `${name} 님의 적정 월세 상한` : "나의 적정 월세 상한",
    capText: finite ? cap : "제한 없음",
    hasCap: finite,
    message: rentMessage(r.rentCap, region),
    breakdown: [
      { label: "내 시간·체력 가치 기준 지불 의향", value: man(r.willingness) },
      { label: "− 관리비", value: man(costs.mgmt) },
      { label: "− 추가 생활비", value: man(costs.living) },
      { label: "− 초기 비용 (중개보수 포함, 2년 분할)", value: man(initialAtCap) },
      { label: "− 보증금 기회비용", value: man(r.depositCost) },
      { label: "+ 절약 교통비", value: man(r.savedFare) },
      { label: "월세 상한", value: cap, total: true },
    ] satisfies Line[],
    stats: [
      { label: "학교까지", value: `${region.mode === "도보" ? "도보" : isCustom ? "대중교통" : region.mode} ${region.oneWayMin}분` },
      { label: "원룸 월세 중앙값", value: man(region.rentMedian, 0), note: example },
      { label: "관리비 중앙값", value: man(region.mgmtMedian, 0), note: example },
    ],
    depositNote:
      finite && r.rentCap > 0
        ? `보증금 ${man(costs.deposit, 0)} 기준이에요. 보증금을 1,000만 원 더 넣으면 상한이 약 ${man(r.rentCap - more.rentCap)} 내려가요. 보증금·월세 조합이 다른 방은 ‘월세 + 보증금 × ${ratePct}% ÷ 12’(환산 월세)가 작은 쪽이 싸요.`
        : null,
    weightsNote: `리포트에서 조정한 가치관 기준: ${adjustText(state.adj)} (0 = 보통)`,
    map: { src: mapUrl(school, region), title: `${school.name} 주변 지도` },
  };
}

// ── ④ 계약 D-day ─────────────────────────────
export type DdayItem = Step & { badge: string; dateText: string; done: boolean; isToday: boolean };

export function ddayModel(state: AppState, today: Date, pickedKey: string | null) {
  const contract = parseDate(state.contract);
  const balance = parseDate(state.balance);
  const valid = !!contract && !!balance && balance.getTime() >= contract.getTime();
  const steps = valid ? buildSteps(today, contract, balance, state.leaseDeposit, state.leaseRent) : [];

  const items: DdayItem[] = steps.map((s) => {
    const badge = dLabel(s, today);
    return { ...s, badge, dateText: stepDateText(s), done: badge === "완료", isToday: badge === "오늘" };
  });
  const current = items.find((s) => s.isToday) ?? items.find((s) => !s.done) ?? items[0];
  const selected = items.find((s) => s.key === pickedKey) ?? current;

  return {
    valid,
    steps,
    items,
    selected: selected
      ? {
          ...selected,
          terms: selected.terms.map((t) => ({ term: t, desc: TERMS[t] })),
          calendarUrl: googleCalendarUrl(selected),
        }
      : null,
    todayText: md(today),
    amountText: `${man(state.leaseDeposit, 0)} / ${man(state.leaseRent, 0)}`,
  };
}
