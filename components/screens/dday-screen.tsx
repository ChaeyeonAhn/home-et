"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { AppState } from "@/lib/app-state";
import { buildIcs, calendarEvents, type Step } from "@/lib/dday";
import { ddayModel, type DdayItem } from "@/lib/view-models";
import { useAuth } from "@/components/providers";
import {
  ActionBar, Button, ButtonAnchor, Callout, Card, CardTitle, Dialog, Eyebrow, Field, FinePrint, LinkButton, NumberInput,
  PageHeader, SectionLabel, TermCard, TextInput, TextLink, TimelineItem, type BadgeTone,
} from "@/components/ui";

const badgeTone = (it: DdayItem): BadgeTone => (it.isToday ? "solidAccent" : it.done ? "muted" : "neutral");

function downloadIcs(content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "home-et-계약-일정.ics";
  a.click();
  URL.revokeObjectURL(url);
}

/** 캘린더 권한 로그인에서 돌아오면 붙는 표시. 보이면 등록을 이어서 진행 */
const RESUME_PARAM = "gcal";

type SyncState =
  | { kind: "idle" | "saving" | "ask" }
  | { kind: "done"; count: number; firstDate: string }
  | { kind: "error"; message: string };

/** 로그인한 사람의 Google 캘린더에 단계별 일정을 넣는다. 권한이 없으면 권한 요청부터 */
function useGoogleCalendar(steps: Step[], enabled: boolean) {
  const auth = useAuth();
  const [sync, setSync] = useState<SyncState>({ kind: "idle" });
  const resumed = useRef(false);

  const connect = () => {
    const url = new URL(window.location.href);
    url.searchParams.set(RESUME_PARAM, "1");
    auth.connectCalendar(url.pathname + url.search);
  };

  const save = async () => {
    if (!auth.calendar) return setSync({ kind: "ask" });
    setSync({ kind: "saving" });
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: calendarEvents(steps) }),
      });
      if (res.status === 401) return setSync({ kind: "ask" }); // 권한이 풀렸거나 만료 → 다시 받기
      if (!res.ok) throw new Error(String(res.status));
      const { count } = (await res.json()) as { count: number };
      setSync({ kind: "done", count, firstDate: calendarEvents(steps)[0].start });
    } catch {
      setSync({ kind: "error", message: "Google 캘린더에 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요." });
    }
  };

  // 권한 화면에서 돌아오면 버튼을 다시 누르지 않아도 바로 등록
  const resume = useEffectEvent(() => {
    if (resumed.current) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RESUME_PARAM)) return;
    resumed.current = true;
    url.searchParams.delete(RESUME_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (!enabled) return;
    // Google 권한 화면에서 캘린더 항목을 끄고 돌아온 경우
    if (!auth.calendar) setSync({ kind: "error", message: "캘린더 권한이 허용되지 않아 등록하지 못했어요. 다시 누르면 권한을 요청해요." });
    else void save();
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(OAuth 리디렉션)에서 돌아온 걸 이어받음
    if (auth.status !== "loading") resume();
  }, [auth.status]);

  return { available: auth.enabled, sync, setSync, save, connect };
}

/** 2026-03-05 → Google 캘린더 그날 화면 */
const calendarDayUrl = (ymd: string) => `https://calendar.google.com/calendar/r/day/${ymd.replaceAll("-", "/")}`;

export function DdayScreen({
  state, update, today, onBack,
}: {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  today: Date;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false); // 모바일: 열린 단계를 다시 누르면 접힘
  const m = ddayModel(state, today, picked);
  const sel = m.selected;
  const gcal = useGoogleCalendar(m.steps, m.valid);
  const closeSync = () => gcal.setSync({ kind: "idle" });
  const extras = (
    <>
      {gcal.available && (
        <div className="flex justify-end max-md:justify-center md:mt-3">
          <LinkButton disabled={!m.valid} onClick={() => downloadIcs(buildIcs(m.steps))} className="font-medium text-fg-sub">
            Apple·다른 캘린더는 .ics 파일 받기
          </LinkButton>
        </div>
      )}
      {gcal.sync.kind === "error" && (
        <Callout tone="warning" className="mt-2 text-right max-md:text-center">
          {gcal.sync.message}
        </Callout>
      )}
    </>
  );

  return (
    <div>
      <PageHeader title="첫 계약, 언제 무엇을 하면 될까?" sub="날짜만 넣으면 단계별 D-day를 알려 드리고, 그때 꼭 알아야 할 용어를 쉽게 풀어 드려요." />

      <Card>
        {/* 2×2 같은 간격: 계약일 | 잔금·입주일 / 보증금 | 월세 (데스크톱은 한 줄) */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4 lg:items-end">
          <Field label="계약일" htmlFor="contract">
            <TextInput id="contract" type="date" value={state.contract} onChange={(e) => update({ contract: e.target.value })} />
          </Field>
          <Field label="잔금·입주일" htmlFor="balance">
            <TextInput id="balance" type="date" value={state.balance} min={state.contract} onChange={(e) => update({ balance: e.target.value })} />
          </Field>
          <Field label="보증금" htmlFor="deposit">
            <NumberInput id="deposit" suffix="원" step={1_000_000} value={state.leaseDeposit} onChange={(v) => update({ leaseDeposit: v })} />
          </Field>
          <Field label="월세" htmlFor="rent">
            <NumberInput id="rent" suffix="원" step={10_000} value={state.leaseRent} onChange={(v) => update({ leaseRent: v })} />
          </Field>
        </div>
        <FinePrint className="mt-3">
          {m.amountText} · {gcal.available ? "버튼 하나로 단계별 일정을 내 Google 캘린더에 넣어 드려요." : ".ics 파일은 Google·Apple 캘린더 모두에 가져올 수 있어요."}
        </FinePrint>
        {!m.valid && (
          <Callout tone="warning" className="mt-2">
            잔금·입주일은 계약일과 같거나 그 뒤여야 해요.
          </Callout>
        )}
      </Card>

      {m.valid && sel && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
          <Card>
            <CardTitle meta={`오늘 ${m.todayText} 기준`}>D-day 타임라인</CardTitle>
            <ol className="mt-4 space-y-2">
              {m.items.map((it) => (
                <li key={it.key}>
                  <TimelineItem
                    badge={it.badge}
                    badgeTone={badgeTone(it)}
                    title={it.title}
                    sub={it.dateText}
                    done={it.done}
                    selected={it.key === sel.key}
                    expanded={it.key === sel.key && !collapsed}
                    onSelect={() => {
                      if (it.key === sel.key) return setCollapsed((c) => !c);
                      setPicked(it.key);
                      setCollapsed(false);
                    }}
                  />
                  {/* 모바일: 고른 단계 설명이 바로 아래 펼쳐짐 */}
                  {it.key === sel.key && !collapsed && (
                    <div className="px-1 pb-3 pt-4 motion-safe:animate-rise lg:hidden">
                      <StepDetail sel={sel} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="hidden lg:block">
            <Eyebrow>
              {sel.badge} · {sel.dateText}
            </Eyebrow>
            <h2 className="mt-1 text-xl font-bold">{sel.title}</h2>
            <div className="mt-2">
              <StepDetail sel={sel} />
            </div>
          </Card>
        </div>
      )}

      {/* 모바일: 하단 고정 (좁은 '이전' + 캘린더 등록), 데스크톱: 오른쪽 정렬 버튼 줄 */}
      <div className="mt-5">
        {/* 모바일: 고정 바가 차지하는 빈칸 위에, 데스크톱: 버튼 줄 아래 */}
        <div className="md:hidden">{extras}</div>
        <ActionBar>
          <Button variant="secondary" size="lg" onClick={onBack} className="max-md:w-24 max-md:flex-none!">
            <span className="md:hidden">이전</span>
            <span className="hidden md:inline">월세 추천으로 돌아가기</span>
          </Button>
          {gcal.available ? (
            <Button size="lg" disabled={!m.valid || gcal.sync.kind === "saving"} onClick={gcal.save}>
              {gcal.sync.kind === "saving" ? "캘린더에 넣는 중…" : "Google 캘린더에 등록"}
            </Button>
          ) : (
            <Button size="lg" disabled={!m.valid} onClick={() => downloadIcs(buildIcs(m.steps))}>
              캘린더 파일 받기 (.ics)
            </Button>
          )}
        </ActionBar>
        <div className="max-md:hidden">{extras}</div>
      </div>

      <Dialog
        open={gcal.sync.kind === "ask"}
        onClose={closeSync}
        title="Google 캘린더 권한이 필요해요"
        actions={
          <>
            <Button variant="secondary" onClick={closeSync}>
              취소
            </Button>
            <Button onClick={gcal.connect}>권한 허용하기</Button>
          </>
        }
      >
        계약 단계 {m.steps.length}개를 내 캘린더에 바로 넣으려면 Google 계정에서 일정 추가 권한을 허용해 주세요. HOME:ET는 자기가 만든 일정만 넣고 고쳐요.
      </Dialog>

      <Dialog
        open={gcal.sync.kind === "done"}
        onClose={closeSync}
        title={gcal.sync.kind === "done" ? `캘린더에 일정 ${gcal.sync.count}개를 넣었어요` : ""}
        actions={
          <>
            <Button variant="secondary" onClick={closeSync}>
              닫기
            </Button>
            {gcal.sync.kind === "done" && (
              <ButtonAnchor href={calendarDayUrl(gcal.sync.firstDate)} target="_blank" rel="noopener noreferrer" onClick={closeSync}>
                캘린더 열기 ↗
              </ButtonAnchor>
            )}
          </>
        }
      >
        단계마다 전날 오전 9시에 알림이 가요. 날짜를 바꾸고 다시 등록하면 새로 쌓이지 않고 기존 일정이 고쳐져요.
      </Dialog>

      <FinePrint className="mt-6">
        HOME:ET의 계약 안내는 일반 정보이며 법률 자문이 아니에요. 실제 계약 전에는 등기부등본 원문과 공인중개사 설명을 꼭 함께 확인하세요.
      </FinePrint>
    </div>
  );
}

type Selected = NonNullable<ReturnType<typeof ddayModel>["selected"]>;

function StepDetail({ sel }: { sel: Selected }) {
  return (
    <>
      <p className="text-[15px] leading-relaxed">{sel.todo}</p>
      <div className="mt-6 space-y-3">
        <SectionLabel>이 단계에서 알아야 할 용어</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sel.terms.map((t) => (
            <TermCard key={t.term} term={t.term}>
              {t.desc}
            </TermCard>
          ))}
        </div>
      </div>
      <TextLink href={sel.calendarUrl} target="_blank" rel="noopener noreferrer" className="mt-6">
        이 단계만 Google 캘린더에 추가 ↗
      </TextLink>
    </>
  );
}
