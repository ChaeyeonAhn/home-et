// 데모용 학교·지역 데이터.
// 월세·관리비 중앙값은 국토부 전월세 실거래가 가공 전 "예시 데이터"입니다.

export type Mode = "도보" | "버스" | "지하철";

export interface Region {
  id: string;
  name: string; // 동 이름
  mode: Mode;
  oneWayMin: number; // 학교까지 편도
  rentMedian: number; // 원룸 월세 중앙값(원)
  mgmtMedian: number; // 관리비 중앙값(원)
  lat: number;
  lng: number;
}

export interface School {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  regions: Region[];
}

const r = (
  id: string, name: string, mode: Mode, oneWayMin: number,
  rentMan: number, mgmtMan: number, lat: number, lng: number,
): Region => ({ id, name, mode, oneWayMin, rentMedian: rentMan * 10_000, mgmtMedian: mgmtMan * 10_000, lat, lng });

/** 두 좌표 사이 직선거리 비교용 값(km²에 비례). 짧은 거리라 위도 보정만 한 평면 근사로 충분 */
const dist2 = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
};

/** 동 목록은 학교에서 가까운 순. 첫 번째 동이 기본 선택이 됨 */
const byDistance = (s: School): School => ({ ...s, regions: [...s.regions].sort((a, b) => dist2(a, s) - dist2(b, s)) });

export const SCHOOLS: School[] = ([
  {
    id: "korea", name: "고려대학교", district: "서울 성북구", lat: 37.5894, lng: 127.0322,
    regions: [
      r("anam", "안암동", "도보", 10, 55, 7, 37.5862, 127.0291),
      r("bomun", "보문동", "도보", 18, 50, 6, 37.5853, 127.0198),
      r("dongseon", "동선동", "버스", 15, 48, 6, 37.5925, 127.0177),
    ],
  },
  {
    id: "yonsei", name: "연세대학교", district: "서울 서대문구", lat: 37.5658, lng: 126.9386,
    regions: [
      r("changcheon", "창천동", "도보", 10, 58, 8, 37.5594, 126.9340),
      r("daesin", "대신동", "도보", 8, 52, 7, 37.5652, 126.9450),
      r("yeonhui", "연희동", "버스", 15, 50, 6, 37.5687, 126.9301),
    ],
  },
  {
    id: "snu", name: "서울대학교", district: "서울 관악구", lat: 37.4599, lng: 126.9519,
    regions: [
      r("daehak", "대학동", "버스", 10, 40, 5, 37.4702, 126.9374),
      r("nakseongdae", "낙성대동", "버스", 12, 45, 6, 37.4766, 126.9586),
      r("cheongnyong", "청룡동", "버스", 15, 48, 6, 37.4812, 126.9527),
    ],
  },
  {
    id: "hanyang", name: "한양대학교", district: "서울 성동구", lat: 37.5572, lng: 127.0453,
    regions: [
      r("sageun", "사근동", "도보", 7, 50, 6, 37.5622, 127.0447),
      r("haengdang", "행당동", "도보", 12, 52, 7, 37.5594, 127.0345),
      r("majang", "마장동", "도보", 15, 47, 6, 37.5661, 127.0428),
    ],
  },
  {
    id: "konkuk", name: "건국대학교", district: "서울 광진구", lat: 37.5408, lng: 127.0793,
    regions: [
      r("hwayang", "화양동", "도보", 7, 53, 7, 37.5464, 127.0711),
      r("jayang", "자양동", "도보", 12, 50, 6, 37.5340, 127.0821),
      r("guui", "구의동", "지하철", 15, 48, 6, 37.5404, 127.0880),
    ],
  },
  {
    id: "kyunghee", name: "경희대학교", district: "서울 동대문구", lat: 37.5964, lng: 127.0525,
    regions: [
      r("hoegi", "회기동", "도보", 7, 48, 6, 37.5906, 127.0548),
      r("imun", "이문동", "도보", 15, 45, 5, 37.5973, 127.0610),
      r("hwigyeong", "휘경동", "도보", 15, 45, 5, 37.5893, 127.0618),
    ],
  },
] satisfies School[]).map(byDistance);

export const findSchool = (id: string) => SCHOOLS.find((s) => s.id === id) ?? SCHOOLS[0];
