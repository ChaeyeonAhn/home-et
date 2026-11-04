import { z } from "zod";
import { authEnabled, readSessionToken } from "@/auth";
import { CALENDAR_SCOPE, STEP_KEYS } from "@/lib/dday";

// 계약 D-day 일정을 로그인한 사람의 기본 Google 캘린더에 넣는다.
// 단계마다 고정 일정 ID를 써서, 날짜를 바꾸고 다시 누르면 새로 쌓이지 않고 기존 일정이 고쳐짐.

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Google 일정 ID는 base32hex(0-9, a-v)만 허용 → 단계 key를 허용 문자로 바꿔 둠
const EVENT_ID: Record<(typeof STEP_KEYS)[number], string> = {
  pre: "homeetpre",
  contract: "homeetcontract",
  "before-balance": "homeetprebalance",
  balance: "homeetbalance",
  report: "homeetreport",
};

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({
  events: z
    .array(
      z.object({
        key: z.enum(STEP_KEYS),
        summary: z.string().max(200),
        description: z.string().max(2000),
        start: Day,
        end: Day,
      }),
    )
    .min(1)
    .max(STEP_KEYS.length),
});

const reauth = () => Response.json({ error: "reauth" }, { status: 401 });

/** 세션 쿠키 속 Google 토큰. 만료됐으면 refresh token으로 이번 요청에 쓸 새 토큰을 받음 */
async function accessToken(req: Request): Promise<string | null> {
  const token = await readSessionToken(req);
  if (!token?.scope?.split(" ").includes(CALENDAR_SCOPE)) return null;
  if (token.accessToken && token.expiresAt && token.expiresAt * 1000 > Date.now() + 60_000) return token.accessToken;
  if (!token.refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function POST(req: Request) {
  if (!authEnabled) return Response.json({ error: "disabled" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const token = await accessToken(req);
  if (!token) return reauth();

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const origin = new URL(req.url).origin;

  const upsert = async (e: z.infer<typeof Body>["events"][number]) => {
    const id = EVENT_ID[e.key];
    const resource = {
      id,
      status: "confirmed", // 사용자가 지운 일정(취소 상태)이면 되살림
      summary: e.summary,
      description: e.description,
      start: { date: e.start },
      end: { date: e.end },
      transparency: "transparent", // 종일 일정이 '바쁨'으로 잡히지 않게
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 * 60 }] }, // 전날 오전 9시
      source: { title: "HOME:ET", url: origin },
    };
    const body = JSON.stringify(resource);
    let res = await fetch(`${API}/${id}`, { method: "PUT", headers, body });
    if (res.status === 404) res = await fetch(API, { method: "POST", headers, body });
    return res;
  };

  const sent = new Set(parsed.data.events.map((e) => e.key));
  const results = await Promise.all(parsed.data.events.map(upsert));
  // 이번에 빠진 단계(예: 금액을 낮춰 임대차 신고 대상이 아니게 됨)는 지움. 없던 일정이면 404/410이라 무시
  await Promise.all(
    STEP_KEYS.filter((k) => !sent.has(k)).map((k) => fetch(`${API}/${EVENT_ID[k]}`, { method: "DELETE", headers })),
  );

  if (results.some((r) => r.status === 401 || r.status === 403)) return reauth();
  const failed = results.filter((r) => !r.ok).length;
  if (failed) return Response.json({ error: "google", failed }, { status: 502 });
  return Response.json({ count: results.length });
}
