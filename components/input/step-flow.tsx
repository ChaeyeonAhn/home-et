"use client";

import { useEffect, useRef, useState } from "react";
import { ActionBar, Button, LinkButton, useIsDesktop } from "@/components/ui";
import { cx } from "@/components/ui/styles";
import { HeroEditor, QUESTIONS } from "./questions";
import { AnswerRow, IntroFeatures, ProgressBar, SideIntro, allValid, type InputFlowProps } from "./shared";
import { Tutorial, tutorialUnseen } from "./tutorial";

const N = QUESTIONS.length;
const AUTO_NEXT_MS = 220; // 선택 피드백을 잠깐 보여 준 뒤 넘어감

/** 한 화면에 한 질문. 모바일은 먼저 시작 화면(서비스 소개)을 보여 줌 */
export function StepFlow({ state, update, onSubmit, loading, onOpenReport }: InputFlowProps) {
  // 이미 다 답하고 검사한 적이 있으면(새로고침·리포트에서 돌아옴) 저장된 답을 보여 주는 확인 화면부터
  const returning = state.analysis !== null && allValid(state);
  const [started, setStarted] = useState(false); // 모바일 시작 화면을 지났는지 (데스크톱은 무시)
  const [idx, setIdx] = useState(returning ? N : 0); // N = 확인 화면
  const [dir, setDir] = useState<1 | -1>(1);
  const [reached, setReached] = useState(returning ? N : 0);
  const [fromReview, setFromReview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktop = useIsDesktop();
  const [tutorial, setTutorial] = useState(false);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // 처음 온 사람에게만 사용법 안내를 자동으로 (이어서 하는 사람은 건너뜀)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 전용 값(localStorage)으로 초기화
    if (!returning && tutorialUnseen()) setTutorial(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 첫 화면에서 한 번만
  }, []);
  const howTo = (
    <LinkButton onClick={() => setTutorial(true)} className="mt-4">
      사용법 보기
    </LinkButton>
  );

  const isReview = idx === N;
  const q = QUESTIONS[idx];
  const valid = isReview ? allValid(state) : q.valid(state);

  const goTo = (i: number, d: 1 | -1) => {
    if (timer.current) clearTimeout(timer.current);
    setDir(d);
    setIdx(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    if (isReview) return onSubmit();
    if (!valid) return;
    if (fromReview) {
      setFromReview(false);
      goTo(N, 1);
    } else goTo(idx + 1, 1);
  };
  const prev = () => {
    if (fromReview) {
      setFromReview(false);
      return goTo(N, 1);
    }
    if (idx > 0) goTo(idx - 1, -1);
  };
  const autoNext = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, AUTO_NEXT_MS);
  };
  const edit = (i: number) => {
    setFromReview(isReview);
    goTo(i, -1);
  };

  const progress = (Math.min(idx, N) / N) * 100;
  const canPrev = idx > 0 || fromReview;

  return (
    <div className="flex flex-1 flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
      {/* 데스크톱: 왼쪽에 소개 + 지금까지 답한 것 */}
      <aside className="hidden md:block">
        <div className="sticky top-24">
          <SideIntro>{howTo}</SideIntro>
          <ol className="mt-8 space-y-0.5" aria-label="질문 목록">
            {QUESTIONS.map((qq, i) => (
              <li key={qq.id}>
                <AnswerRow
                  size="sm"
                  label={qq.label}
                  value={i <= reached ? qq.display(state) : "—"}
                  current={i === idx}
                  disabled={i > reached}
                  onClick={() => edit(i)}
                />
              </li>
            ))}
          </ol>
        </div>
      </aside>

      {/* 모바일 시작 화면. 표시 여부를 CSS로만 나눠서 데스크톱에서 첫 렌더 때 깜빡이지 않게 */}
      {!started && (
        <div className="flex flex-1 flex-col px-5 pt-8 md:hidden">
          <SideIntro>
            {howTo}
            <div className="mt-6">
              <IntroFeatures />
            </div>
          </SideIntro>
          <p className="mt-6 text-center text-sm text-fg-muted">질문 {N}개에 답하면 바로 결과가 나와요</p>
          <ActionBar desktopClassName="md:hidden">
            {onOpenReport && (
              <Button variant="secondary" size="lg" onClick={onOpenReport} className="max-md:w-28 max-md:flex-none!">
                지난 결과
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => {
                setStarted(true);
                window.scrollTo({ top: 0 });
              }}
            >
              자취 적합 검사 시작
            </Button>
          </ActionBar>
        </div>
      )}

      {/* 모바일: 배경 위에 바로 (고정 바만 유리), 데스크톱: 큰 유리 시트. 모바일엔 backdrop-filter를 주지 않음 → fixed 하단 바의 기준이 바뀌지 않게 */}
      <section
        className={cx(
          "flex flex-1 flex-col overflow-x-clip md:min-h-[600px] md:rounded-sheet md:border md:border-glass-border md:bg-glass md:shadow-glass md:backdrop-glass",
          !started && "max-md:hidden",
        )}
      >
        {/* 상단: 진행률 막대만. 확인 화면에서 항목을 고치러 온 땐 숨김 (막대가 뒤로 가 보여서 헷갈림) */}
        <div className="sticky top-[var(--header-h,0px)] z-10 flex h-12 items-center px-5 bg-glass-bar backdrop-glass md:bg-transparent md:backdrop-filter-none md:static md:h-auto md:rounded-t-sheet md:px-10 md:pt-8">
          <ProgressBar value={progress} className={cx("flex-1", fromReview && "invisible")} />
        </div>

        <div
          key={idx}
          className={cx(
            "flex-1 px-5 md:px-10 md:pt-8 md:pb-10",
            dir > 0 ? "motion-safe:animate-step-next" : "motion-safe:animate-step-prev",
          )}
        >
          {isReview ? (
            <>
              <div className="z-[5] -mx-5 px-5 pt-4 pb-6 bg-glass-bar backdrop-glass md:bg-transparent md:backdrop-filter-none max-md:sticky max-md:top-[calc(var(--header-h,0px)+3rem)] md:mx-0 md:px-0 md:pt-0 md:pb-0">
                <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">이대로 검사할까요?</h1>
                <p className="mt-2 text-[15px] text-fg-sub">고칠 항목을 누르면 바로 바꿀 수 있어요.</p>
              </div>
              <ul className="-mx-5 divide-y divide-border border-y border-border bg-surface/40 md:mx-0 md:mt-6 md:overflow-hidden md:rounded-panel md:border">
                {QUESTIONS.map((qq, i) => (
                  <li key={qq.id}>
                    <AnswerRow label={qq.label} value={qq.display(state)} onClick={() => edit(i)} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {/* 모바일: 질문 제목은 진행률 막대 아래에 고정, 답(목록·입력)만 스크롤 */}
              <div className="z-[5] -mx-5 px-5 pt-4 pb-6 bg-glass-bar backdrop-glass md:bg-transparent md:backdrop-filter-none max-md:sticky max-md:top-[calc(var(--header-h,0px)+3rem)] md:mx-0 md:px-0 md:pt-0 md:pb-0">
                <p className="text-sm font-semibold text-primary">{q.group}</p>
                <h1 className="mt-1.5 whitespace-pre-line text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">{q.title}</h1>
                {q.sub && <p className="mt-2 text-[15px] leading-relaxed text-fg-sub">{q.sub}</p>}
              </div>
              <div className="pt-2 md:pt-8">
                <HeroEditor
                  q={q}
                  state={state}
                  update={update}
                  autoFocus={desktop} // 모바일은 자동 포커스 X: 화면마다 키보드가 올라오며 하단 바가 들썩임
                  shortcuts={desktop}
                  onDone={q.kind === "choice" ? autoNext : next}
                />
              </div>
            </>
          )}
        </div>

        <ActionBar keyboardAware desktopClassName="md:items-center md:justify-between md:rounded-b-sheet md:border-primary/8 md:bg-transparent md:px-10 md:py-5">
          {/* 모바일: 왼쪽에 좁게 (첫 질문에선 숨겨서 '다음'이 꽉 차게) */}
          <Button
            variant={desktop ? "ghost" : "secondary"}
            size="lg"
            onClick={prev}
            disabled={!canPrev}
            className={cx("max-md:w-24 max-md:flex-none!", !canPrev && "max-md:hidden")}
          >
            이전
          </Button>
          <Button size="lg" onClick={next} disabled={!valid || loading} className="max-md:flex-1 md:min-w-40">
            {isReview ? (loading ? "가치관 분석 중…" : "자취 적합 검사 시작") : fromReview ? "확인" : "다음"}
          </Button>
        </ActionBar>
      </section>
      <Tutorial open={tutorial} onClose={() => setTutorial(false)} />
    </div>
  );
}
