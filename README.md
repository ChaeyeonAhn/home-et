# HOME:ET

서울에서 처음 자취를 고민하는 대학생에게 통학 대비 자취의 실제 가치를 수치로 보여 주고, 적정 월세와 계약 D-day까지 안내하는 서비스입니다.

> **GDGoC DevFest 2026 · Tell the Vision 해커톤 Team 3 「로컬에선 됐는데」의 결과물입니다.**
>
> - 행사: [GDG DevFest 2026 — Tell the Vision](https://gdgoc-devfest-2026.vercel.app/#overview)
> - 주최: GDG on Campus KOREA · YONSEI · SKKU · KAIST 연합
> - Demo Market: 2026년 11월 6일(금), Google for Startups Campus
> - 주제: 첫 자취를 위한 정보 제공 플랫폼 (경제 / 교통 / 주거)
> - 서비스: https://home-et-temp.vercel.app

## 팀 「로컬에선 됐는데」

| 이름 | 학교 | 학과 | GitHub |
| --- | --- | --- | --- |
| 안채연 | KAIST | 전산학부 | [ChaeyeonAhn](https://github.com/ChaeyeonAhn) |
| 오준호 | 고려대학교 | 컴퓨터학과 | [ojunhorange](https://github.com/ojunhorange) |
| 이가영 | 고려대학교 | 컴퓨터학과 | |
| 안호성 | 성균관대학교 | 지능형소프트웨어학과 | |
| 오진우 | 고려대학교 | 스마트보안학부 | |
| 유선우 | 연세대학교 | 경제학과 | |

## 흐름

1. **정보 입력**: 한 화면에 한 질문씩 학교, 본가, 통학 정보, 등교일, 시급, 대학생활 목표(칩 + 추가 설명)를 받습니다. 모바일은 서비스 소개 시작 화면부터 보여 줍니다.
2. **자취 적합 리포트**: Gemini가 few-shot 예시를 보고 생활 목표에서 돈·시간·체력 조정값(0 = 보통, −3 ~ +3)을 뽑고, 선형 자취지수(0~100, 50 = 손익분기)를 계산합니다. 0이 가운데인 슬라이더로 항목마다 따로 바꾸면 바로 재계산되고, 점수가 항목별로 몇 점씩 더하고 빼는지 보여 줍니다.
3. **맞춤 월세 추천**: 자취지수가 50이 되는 월세를 역산해 지역 시세와 비교합니다. 중개보수(법정 상한)를 초기 비용에 넣고, 보증금을 바꾸면 상한이 얼마나 움직이는지도 보여 줍니다.
4. **계약 D-day**: 계약일·잔금일을 기준으로 단계별 할 일과 용어 카드를 보여 주고, .ics / Google 캘린더로 내보냅니다.

## 개발

```bash
cp .env.example .env.local   # 키는 선택 사항
npm install
npm run dev
```

| 환경 변수 | 용도 | 없으면 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 가치관 조정값 추출 (`/api/weights`, few-shot) | 키워드 기반 대체 분석 |
| `GEMINI_MODEL` | 모델 교체 (기본 `gemini-3.8-flash`) | 기본값 |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google 로그인 (Auth.js) | 로그인 버튼 숨김 |

Google OAuth 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`, `https://<배포 도메인>/api/auth/callback/google`

## 구조

```
app/globals.css          디자인 토큰 (색·라운드·글꼴)
components/
  ui/                    UI 부품 (Button, Card, Field, Stepper, Badge, Meter, ActionBar, Dialog …)
    styles.ts            부품별 variant 클래스 모음
  input/                 ① 정보 입력: 질문 정의(questions), 한 화면 한 질문 흐름(step-flow)
  screens/               ②~④ 리포트·월세·D-day 화면 (부품 + 레이아웃만 사용)
  shell/header.tsx       로고, 단계 내비, 로그인 버튼, 푸터
  home-et-app.tsx        상태·화면 전환
lib/
  view-models.ts         화면에 보여줄 숫자·문구
  calc.ts                선형 자취지수·월세 상한·중개보수 산출식과 가정값 (명세: docs/metrics.md)
  data.ts                데모 학교·동별 시세 (예시 데이터)
  dday.ts                계약 D-day 규칙, 용어 카드, 캘린더 내보내기
  weights.ts             few-shot 예시, 키워드 대체 분석
  app-state.ts           앱 상태 타입, 기본값, localStorage 저장
app/api/weights          Gemini few-shot 가치관 분석
```

## 디자인 바꾸기

바꾸려는 범위에 따라 고칠 곳이 달라요. 아래로 갈수록 범위가 넓어요.

1. **색·라운드·글꼴**: `app/globals.css`의 `@theme` 토큰만 고치면 돼요. 컴포넌트에는 hex 값이 없고 `bg-primary`, `text-fg-muted`, `rounded-card` 같은 토큰 이름만 써요.
2. **부품 모양** (버튼 크기, 카드 테두리, 배지 스타일 등): `components/ui/styles.ts`의 variant 맵을 고쳐요.
3. **부품 구조** (예: 슬라이더를 다른 라이브러리로 교체): `components/ui/*`에서 같은 props를 유지한 채 구현만 바꾸면 화면은 그대로예요.
4. **화면 레이아웃 전면 개편**: `components/screens/*`(입력은 `components/input/*`)의 JSX만 다시 쓰면 돼요. 숫자와 문구는 `lib/view-models.ts`가 계산하니까 계산 로직은 손댈 필요가 없어요.
