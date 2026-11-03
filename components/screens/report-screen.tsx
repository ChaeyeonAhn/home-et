"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { AppState } from "@/lib/app-state";
import type { LivingCosts } from "@/lib/calc";
import { reportModel } from "@/lib/view-models";
import { cx } from "@/components/ui/styles";
import {
  ActionBar, Badge, BigNumber, Button, Callout, Card, CardTitle, Dialog, Em, Field, FinePrint, LabeledMeter,
  LinkButton, Meter, NumberInput, Panel, ScaleLabels, SectionLabel, Slider, StatList,
} from "@/components/ui";

export function ReportScreen({
  state, update, name, onStay, onGo,
}: {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  name: string | null;
  onStay: () => void;
  onGo: () => void;
}) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [stayOpen, setStayOpen] = useState(false);
  const closeStay = useCallback(() => setStayOpen(false), []);
  const m = reportModel(state, name);
  const tone = m.recommended ? "primary" : "accent";
  const scoreRef = useRef<HTMLDivElement>(null);
  const pinned = useScrolledPast(scoreRef);

  return (
    <div className="space-y-5">
      {/* 점수 카드가 헤더 뒤로 지나가면 헤더 바로 아래에 점수만 작게 붙임 → 아래에서 가치관을 바꿀 때 점수 변화가 보임 */}
      <div
        aria-hidden={!pinned}
        className={cx(
          "pointer-events-none fixed inset-x-0 top-[calc(var(--header-h,0px)+0.5rem)] z-10 flex justify-center px-4 transition duration-200",
          pinned ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
        )}
      >
        <div className="flex items-center gap-2 rounded-full border border-glass-border bg-glass-bar py-1.5 pl-4 pr-1.5 text-sm shadow-glass backdrop-glass">
          <span className="text-fg-sub">자취지수</span>
          <b className={cx("text-base tabular-nums", tone === "primary" ? "text-primary" : "text-accent")}>{m.index}</b>
          <Badge tone={tone}>{m.verdict}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <div ref={scoreRef}>
          <Card className="h-full">
            <CardTitle aside={<Badge tone={tone}>{m.verdict}</Badge>}>{m.title}</CardTitle>
            <div className="mt-4">
              <BigNumber value={m.index} unit="/ 100" />
            </div>
            <div className="mt-5 space-y-3">
              <Meter value={m.indexPct} tone={tone} size="sm" marker />
              <ScaleLabels items={["통학 유리", "50 = 손익분기", "자취 유리"]} />
            </div>
            <div className="mt-5">
              <StatList rows={m.indexLines} />
              <FinePrint className="mt-2">{m.indexNote}</FinePrint>
            </div>
          </Card>
        </div>

        <Card>
          {m.hasSavedTime ? (
            <div className="space-y-5">
              <p className="text-lg font-bold leading-snug sm:text-xl">
                자취는 통학 1시간을 약 <Em tone="accent">{m.headline.price}</Em>에 되사는 셈이에요. {m.headline.subject} 1시간을 약{" "}
                <Em>{m.headline.myHour}</Em>어치로 여기고 있어요.
              </p>
              {/* 되사는 시간이 실제 생활에서 뭔지: 문장 바로 아래 */}
              <Panel className="grid grid-cols-2 gap-4 text-sm text-fg-sub">
                <p>
                  등교일 저녁
                  <b className="mt-0.5 block text-lg text-fg">{m.eveningGain}</b>
                </p>
                <p>
                  막차 걱정 없는 날
                  <b className="mt-0.5 block text-lg text-fg">{m.lateDays}</b>
                </p>
              </Panel>
              {m.bars.map((b) => (
                <LabeledMeter key={b.label} {...b} />
              ))}
              <p className="text-sm text-fg-sub">
                내 1시간의 가치: {m.hourBasis}
                <br />
                {m.summary}
              </p>
            </div>
          ) : (
            <p className="text-lg font-bold">자취 후 통학 시간이 지금보다 줄지 않아서, 되찾는 시간이 없어요.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle meta="학기 중 한 달">한 달 기준 비교</CardTitle>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <SectionLabel tone="primary">자취하면 되찾는 것</SectionLabel>
              <StatList rows={m.gains} />
            </div>
            <div className="space-y-2">
              <SectionLabel tone="accent">자취하면 더 드는 돈</SectionLabel>
              <StatList rows={m.costs} />
            </div>
          </div>

          <div className="mt-5">
            <LinkButton onClick={() => setShowAssumptions((v) => !v)} aria-expanded={showAssumptions}>
              {showAssumptions ? "가정값 접기" : "가정값 직접 고치기"}
            </LinkButton>
          </div>
          {showAssumptions && <Assumptions note={m.brokerageNote} costs={state.costs} onChange={(patch) => update({ costs: { ...state.costs, ...patch } })} />}
        </Card>

        <Card>
          <CardTitle
            aside={
              m.aiAdj && (
                <Button variant="secondary" size="sm" disabled={m.isAiValue} onClick={() => update({ adj: m.aiAdj! })}>
                  AI 분석값으로
                </Button>
              )
            }
          >
            내 가치관
          </CardTitle>
          <FinePrint className="mt-1">0 = 보통 대학생 기준. 하나를 바꿔도 나머지는 그대로예요.</FinePrint>
          <div className="mt-5 space-y-6">
            {m.adjust.map((a) => (
              <div key={a.key}>
                <Slider
                  label={<b className="text-fg">{a.label}</b>}
                  sub={a.hint}
                  display={
                    <>
                      <span className="mr-1.5 font-normal text-fg-sub">{a.level}</span>
                      {a.display}
                    </>
                  }
                  valueText={`${a.display}, ${a.level}`}
                  min={a.min}
                  max={a.max}
                  step={1}
                  origin={0}
                  value={a.value}
                  onChange={(v) => update({ adj: { ...state.adj, [a.key]: v } })}
                />
                <div className="mt-1.5 flex justify-between text-xs text-fg-muted">
                  <span>덜 중요</span>
                  <span>{a.perStep}</span>
                  <span>더 중요</span>
                </div>
              </div>
            ))}
          </div>
          {m.reason && (
            <Callout tone="neutral" className="mt-5">
              {m.reason.text}
              {m.reason.fallbackNote && <span className="mt-1 block text-fg-muted">{m.reason.fallbackNote}</span>}
            </Callout>
          )}
        </Card>
      </div>

      <Dialog
        open={stayOpen}
        onClose={closeStay}
        title="통학을 유지하기로 했어요"
        actions={
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                closeStay();
                onGo();
              }}
            >
              {m.nextLabel}
            </Button>
            <Button size="lg" onClick={closeStay}>
              확인
            </Button>
          </>
        }
      >
        {m.stayMessage}
      </Dialog>

      <ActionBar>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            onStay();
            setStayOpen(true);
          }}
        >
          통학 유지하기
        </Button>
        <Button size="lg" onClick={onGo}>
          {m.nextLabel}
        </Button>
      </ActionBar>
    </div>
  );
}

function Assumptions({ costs, note, onChange }: { costs: LivingCosts; note: string; onChange: (patch: Partial<LivingCosts>) => void }) {
  const fields: { label: string; key: keyof LivingCosts; step: number }[] = [
    { label: "월세 (학교 주변 기본값)", key: "rent", step: 10_000 },
    { label: "관리비", key: "mgmt", step: 10_000 },
    { label: "추가 생활비", key: "living", step: 10_000 },
    { label: "이사·가구가전 (중개보수 제외)", key: "initialTotal", step: 50_000 },
    { label: "보증금", key: "deposit", step: 1_000_000 },
  ];
  return (
    <Panel className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
      {fields.map((f) => (
        <Field key={f.key} compact label={f.label} htmlFor={`as-${f.key}`}>
          <NumberInput id={`as-${f.key}`} tone="inset" size="sm" suffix="원" step={f.step} value={costs[f.key]} onChange={(v) => onChange({ [f.key]: v })} />
        </Field>
      ))}
      <Field compact label="보증금 기회비용 연이율" htmlFor="as-rate">
        <NumberInput
          id="as-rate"
          tone="inset"
          size="sm"
          suffix="%"
          step={0.1}
          value={Math.round(costs.annualRate * 1000) / 10}
          onChange={(v) => onChange({ annualRate: v / 100 })}
        />
      </Field>
      <FinePrint className="col-span-2 md:col-span-3">
        자취 후 왕복 20분, 한 달 = 주당 등교일 × 4.3일(학기 중 기준), 피로 계수 = 0.15 + 0.1 × 환승 횟수(최대 0.5)로 계산해요. 모두 팀 확정 전 초안이에요.
        <span className="mt-1 block">{note}</span>
      </FinePrint>
    </Panel>
  );
}

/** 요소가 sticky 헤더 뒤로 완전히 지나갔는지 */
function useScrolledPast(ref: RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
      setPast(el.getBoundingClientRect().bottom < headerH);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [ref]);
  return past;
}
