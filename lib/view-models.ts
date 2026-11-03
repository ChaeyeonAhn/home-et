/**
 * 화면에 보여줄 값·문구를 만드는 순수 함수들.
 * 디자인을 바꿀 때 화면 JSX만 다시 쓰고, 숫자와 문구는 여기서 그대로 가져다 쓰면 됩니다.
 */
import {
  MIN_WAGE_2026, compute, fromPercents, hm, hours, man, toPercents, won,
  type LivingCosts, type WeightKey,
} from "./calc";
import { findSchool, type Region, type School } from "./data";
import {
  TERMS, buildSteps, dLabel, googleCalendarUrl, md, parseDate, stepDateText, type Step,
} from "./dday";
import { regionFare, selectedRegion, type AppState } from "./app-state";

export const WEIGHT_LABELS: { key: WeightKey; label: string }[] = [
  { key: "money", label: "돈" },
  { key: "time", label: "시간" },
  { key: "body", label: "체력" },
];

export interface Line { label: string; value: string; total?: boolean }

// ── ② 리포트 ─────────────────────────────
export function reportModel(state: AppState, name: string | null) {
  const r = compute(state.commute, state.costs, fromPercents(state.pct));
  const recommended = r.index >= 50;
  const nextLabel = recommended ? "자취 준비하기" : "그래도 자취하기";
  const myHour = Math.round(r.myHourValue);
  const price = Math.round(r.buyBackPrice);
  const scale = Math.max(myHour, price, 1);
  const aiPct = state.analysis ? toPercents(state.analysis) : null;

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
    // 1시간의 가치 = 최저임금 × 가치관 보정 (보정 = (w시간 + 피로계수·w체력) / w돈)
    hourBasis: `${MIN_WAGE_2026.toLocaleString("ko-KR")}원(2026 최저임금) × 가치관 보정 ${(r.myHourValue / MIN_WAGE_2026).toFixed(2)}배 = ${won(myHour)}`,
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
      { label: "초기 비용 (2년 분할)", value: man(r.initialMonthly) },
      { label: "보증금 기회비용 · 절약 교통비", value: man(r.depositCost - r.savedFare) },
      { label: "합계", value: man(r.extraCost), total: true },
    ] satisfies Line[],
    eveningGain: `+${hm(r.savedDailyMin)}`,
    lateDays: `주 ${state.commute.daysPerWeek}일`,
    nextLabel,
    aiPct,
    isAiValue: !!aiPct && WEIGHT_LABELS.every(({ key }) => aiPct[key] === state.pct[key]),
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
  if (!Number.isFinite(cap)) return "돈 가중치가 0이라 상한이 없어요. 가치관 슬라이더를 다시 확인해 주세요.";
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
  const r = compute(state.commute, costs, fromPercents(state.pct), region.oneWayMin * 2, regionFare(region));
  const finite = Number.isFinite(r.rentCap);
  const cap = man(Math.max(0, r.rentCap));
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
      { label: "− 초기 비용 (2년 분할)", value: man(r.initialMonthly) },
      { label: "− 보증금 기회비용", value: man(r.depositCost) },
      { label: "+ 절약 교통비", value: man(r.savedFare) },
      { label: "월세 상한", value: cap, total: true },
    ] satisfies Line[],
    stats: [
      { label: "학교까지", value: `${region.mode === "도보" ? "도보" : isCustom ? "대중교통" : region.mode} ${region.oneWayMin}분` },
      { label: "원룸 월세 중앙값", value: man(region.rentMedian, 0), note: example },
      { label: "관리비 중앙값", value: man(region.mgmtMedian, 0), note: example },
    ],
    weightsNote: `리포트에서 조정한 가치관 기준: 돈 ${state.pct.money}% · 시간 ${state.pct.time}% · 체력 ${state.pct.body}%`,
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
