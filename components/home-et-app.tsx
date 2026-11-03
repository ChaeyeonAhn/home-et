"use client";

import { useCallback, useEffect, useState } from "react";
import { cx } from "@/components/ui/styles";
import { INITIAL, STORAGE_KEY, goalText, loadState, saveState, type AppState, type StepNo } from "@/lib/app-state";
import { toPercents } from "@/lib/calc";
import { addDays, startOfDay, toInput } from "@/lib/dday";
import type { WeightAnalysis } from "@/lib/weights";
import { defaultAnalysis } from "@/lib/weights-keyword";
import { StepFlow } from "./input/step-flow";
import { useAuth } from "./providers";
import { DdayScreen } from "./screens/dday-screen";
import { RentScreen } from "./screens/rent-screen";
import { ReportScreen } from "./screens/report-screen";
import { Footer, Header } from "./shell/header";

/** 상태·흐름만 담당. 화면 모양은 input/·screens/, 부품은 ui/ 에 있어요. */
export function HomeEtApp() {
  const [state, setState] = useState<AppState>(INITIAL);
  const [today, setToday] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const name = auth.status === "authenticated" ? auth.name : null;

  // 마운트 후 저장된 상태 복원 + 날짜 기본값 (서버 렌더와 어긋나지 않게 클라이언트에서만)
  useEffect(() => {
    const now = startOfDay(new Date());
    // 입력 방식 비교 때 A(/step)가 따로 쓰던 저장값도 이어받음
    const saved = loadState(STORAGE_KEY) ?? loadState(`${STORAGE_KEY}:step`) ?? INITIAL;
    const contract = saved.contract || toInput(addDays(now, 5));
    const balance = saved.balance || toInput(addDays(now, 41));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 전용 값(localStorage, 오늘 날짜)으로 초기화
    setToday(now);
    setState({ ...saved, contract, balance });
  }, []);

  useEffect(() => {
    if (today) saveState(state);
  }, [state, today]);

  const update = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const go = (step: StepNo) => {
    update({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goalText(state) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const analysis = (await res.json()) as WeightAnalysis;
      update({ analysis, pct: toPercents(analysis), decision: null });
    } catch {
      const analysis = defaultAnalysis("분석 서버에 연결하지 못해 세 기준을 똑같이 두었어요.");
      update({ analysis, pct: toPercents(analysis), decision: null });
    } finally {
      setLoading(false);
      go(2);
    }
  };

  const ready = state.analysis !== null;
  // 모바일 입력 화면: 로고 헤더만 두고 푸터 없이 꽉 찬 흰 화면 (한 화면 한 질문)
  const onInput = state.step === 1;

  return (
    <>
      <Header step={state.step} canVisit={(no) => no === 1 || ready} onNavigate={go} minimalMobile={onInput} />
      <main
        className={cx(
          "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-12",
          // 남은 높이를 질문 화면에 넘겨서 화면 높이를 넘지 않게
          onInput && "max-md:flex max-md:flex-col max-md:p-0 max-md:bg-surface",
        )}
      >
        {onInput && <StepFlow state={state} update={update} onSubmit={analyze} loading={loading} onOpenReport={ready ? () => go(2) : undefined} />}
        {state.step === 2 && ready && (
          <ReportScreen
            state={state}
            update={update}
            name={name}
            onStay={() => update({ decision: "stay" })}
            onGo={() => {
              update({ decision: null });
              go(3);
            }}
          />
        )}
        {state.step === 3 && ready && <RentScreen state={state} update={update} name={name} onBack={() => go(2)} onNext={() => go(4)} />}
        {state.step === 4 && ready && today && <DdayScreen state={state} update={update} today={today} onBack={() => go(3)} />}
      </main>
      <Footer className={onInput ? "max-md:hidden" : undefined} />
    </>
  );
}
