import {
  DEFAULT_COSTS, DEFAULT_WEIGHTS, MIN_WAGE_2026, toPercents,
  type Commute, type LivingCosts, type Percents,
} from "./calc";
import { SCHOOLS, findSchool, type Region } from "./data";
import type { WeightAnalysis } from "./weights";

export type StepNo = 1 | 2 | 3 | 4;

/** 대학생활 목표 칩. AI·키워드 분석엔 sentence가 들어감 */
export const GOAL_TAGS = [
  { id: "grades", label: "학점 관리", sentence: "학점 관리를 제대로 하고 싶어요." },
  { id: "clubs", label: "동아리·대외활동", sentence: "동아리·대외활동을 하고 싶어요." },
  { id: "parttime", label: "알바 병행", sentence: "알바를 병행해야 해요." },
  { id: "tired", label: "통학이 너무 피곤해요", sentence: "통학 때문에 너무 피곤해요." },
  { id: "parents", label: "부모님 부담 덜기", sentence: "부모님께 부담을 덜 드리고 싶어요." },
  { id: "save", label: "생활비 아끼기", sentence: "생활비를 최대한 아끼고 싶어요." },
] as const;
export type GoalTagId = (typeof GOAL_TAGS)[number]["id"];

/** 분석 서버로 보내는 목표 글 = 고른 칩 문장 + 추가 설명 */
export const goalText = (s: Pick<AppState, "goalTags" | "goal">) =>
  [...GOAL_TAGS.filter((t) => s.goalTags.includes(t.id)).map((t) => t.sentence), s.goal.trim()].filter(Boolean).join(" ");

export interface AppState {
  step: StepNo;
  schoolId: string;
  home: string;
  /** 고른 통학 경로(RouteOption.key). "manual" = 직접 입력, null = 아직 안 고름 */
  routeKey: string | null;
  /** 고른 경로 요약(질문 목록·확인 화면 표시용) */
  routeSummary: string;
  commute: Commute;
  goalTags: GoalTagId[]; // 대학생활 목표: 고른 칩
  goal: string; // 대학생활 목표: 칩 밖의 추가 설명 (선택)
  analysis: WeightAnalysis | null;
  pct: Percents;
  costs: LivingCosts; // 리포트(①)에서 쓰는 가정값. rent/mgmt = 학교 주변 기본 시세
  regionId: string; // 지역 id 또는 "custom"
  custom: Region;
  contract: string; // YYYY-MM-DD
  balance: string;
  leaseDeposit: number;
  leaseRent: number;
  decision: "stay" | null;
}

const firstSchool = SCHOOLS[0];
const firstRegion = firstSchool.regions[0];

export const INITIAL: AppState = {
  step: 1,
  schoolId: firstSchool.id,
  home: "경기 남양주시 별내동",
  routeKey: null,
  routeSummary: "",
  commute: {
    oneWayMin: 85,
    transfers: 2,
    headwayMin: 0, // 배차 간격 질문 삭제. 계산식은 그대로 두고 0으로 고정
    roundTripFare: 4_500,
    daysPerWeek: 4,
    hourlyWage: MIN_WAGE_2026,
  },
  goalTags: ["grades", "clubs", "parents"],
  goal: "",
  analysis: null,
  pct: toPercents(DEFAULT_WEIGHTS),
  costs: { ...DEFAULT_COSTS, rent: firstRegion.rentMedian, mgmt: firstRegion.mgmtMedian },
  regionId: firstRegion.id,
  custom: {
    id: "custom", name: "직접 입력", mode: "버스", oneWayMin: 20,
    rentMedian: 500_000, mgmtMedian: 60_000, lat: firstSchool.lat, lng: firstSchool.lng,
  },
  contract: "",
  balance: "",
  leaseDeposit: DEFAULT_COSTS.deposit,
  leaseRent: firstRegion.rentMedian,
  decision: null,
};

export function selectedRegion(s: AppState): Region {
  if (s.regionId === "custom") return s.custom;
  const school = findSchool(s.schoolId);
  return school.regions.find((r) => r.id === s.regionId) ?? school.regions[0];
}

/** 자취 지역에서 학교까지 버스·지하철이면 왕복 요금이 생김 (서울 기본요금 기준 가정) */
export const regionFare = (r: Region) => (r.mode === "도보" ? 0 : 3_000);

/** 학교를 바꾸면 그 학교 첫 동네 시세로 기본값을 맞춘다 */
export function schoolPatch(s: AppState, id: string): Partial<AppState> {
  const school = findSchool(id);
  const r0 = school.regions[0];
  return {
    schoolId: school.id,
    regionId: r0.id,
    costs: { ...s.costs, rent: r0.rentMedian, mgmt: r0.mgmtMedian },
    custom: { ...s.custom, lat: school.lat, lng: school.lng },
    leaseRent: r0.rentMedian,
  };
}

const OLD_DEFAULT_INITIAL_TOTAL = 1_650_000;
const OLD_DEFAULT_GOAL ="학점 관리를 제대로 하고 싶고, 통학 때문에 동아리를 못 해서 아쉬워요. 그래도 부모님께 부담은 덜 드리고 싶어요.";

export const STORAGE_KEY = "home-et:v1";
export function loadState(key = STORAGE_KEY): AppState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // 칩 도입 전 저장값: 예전 기본 문장이면 버리고 기본 칩으로, 직접 쓴 글이면 추가 설명으로 유지
    if (!parsed.goalTags) {
      if (parsed.goal === OLD_DEFAULT_GOAL) delete parsed.goal;
      else parsed.goalTags = [];
    }
    // 초기 비용 기본값 165만 → 80만. 예전 기본값 그대로면 새 기본값으로, 직접 고친 값은 유지
    if (parsed.costs?.initialTotal === OLD_DEFAULT_INITIAL_TOTAL) parsed.costs.initialTotal = DEFAULT_COSTS.initialTotal;
    return {
      ...INITIAL,
      ...parsed,
      // 배차 간격 질문이 없어졌으므로 예전에 저장된 값도 0으로
      commute: { ...INITIAL.commute, ...parsed.commute, headwayMin: 0 },
      costs: { ...INITIAL.costs, ...parsed.costs },
    };
  } catch {
    return null;
  }
}
export function saveState(s: AppState, key = STORAGE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* 저장소를 못 쓰는 환경이면 그냥 넘어감 */
  }
}
