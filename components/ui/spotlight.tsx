"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, LinkButton } from "./controls";

/**
 * 화면 안내(코치마크): 한 영역만 비추고 나머지는 어둡게 흐림.
 * 비출 요소에 data-tour="<target>"을 달면 됨. 지금 화면에 안 보이는 대상(모바일 전용·데스크톱 전용)은 건너뜀.
 * 비춘 영역은 그대로 누를 수 있음 (예: 슬라이더를 직접 움직여 보기)
 */
export interface SpotlightStep {
  target: string;
  title: ReactNode;
  body: ReactNode;
}

const PAD = 8; // 대상 둘레 여백
const RADIUS = 18;
const GAP = 12; // 대상과 설명 카드 사이
const EDGE = 16; // 화면 가장자리 여백

const findTarget = (t: string) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${t}"]`);
  return el && el.getClientRects().length > 0 ? el : null;
};

interface Box { x: number; y: number; w: number; h: number; vw: number; vh: number }

/** 화면 전체에서 둥근 사각형 구멍만 뺀 모양 */
function holePath({ x, y, w, h, vw, vh }: Box) {
  const r = Math.min(RADIUS, w / 2, h / 2);
  return (
    `path(evenodd, "M0 0H${vw}V${vh}H0Z ` +
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z")`
  );
}

export function Spotlight({ open, steps, onClose }: { open: boolean; steps: SpotlightStep[]; onClose: () => void }) {
  const [list, setList] = useState<SpotlightStep[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const step = list?.[i];
  const last = list ? i === list.length - 1 : false;

  const close = useCallback(() => {
    setList(null);
    setBox(null);
    setI(0);
    onClose();
  }, [onClose]);
  const next = useCallback(() => (last ? close() : setI((n) => n + 1)), [last, close]);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // 열릴 때: 지금 보이는 대상만 추림
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const visible = steps.filter((s) => findTarget(s.target));
      if (!visible.length) return close();
      setI(0);
      setList(visible);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, steps, close]);

  // 단계가 바뀌면 대상으로 스크롤하고, 스크롤·레이아웃이 바뀌는 동안 위치를 계속 따라감
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.55;
    el.scrollIntoView({ block: tall ? "start" : "center", behavior: reduce ? "auto" : "smooth" });
    let raf = 0;
    let prevKey = "";
    const tick = () => {
      const r = el.getBoundingClientRect();
      const b = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, vw: window.innerWidth, vh: window.innerHeight };
      const key = Object.values(b).map(Math.round).join();
      if (key !== prevKey) {
        prevKey = key;
        setBox(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    cardRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // 설명 카드 높이 (위·아래 어디에 둘지 정할 때 씀)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [list]);

  useEffect(() => {
    if (!list) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, close, next, prev]);

  if (!open || !list || !step) return null;

  // 카드 위치: 대상 아래 → 안 되면 위 → 둘 다 좁으면(대상이 화면을 거의 채움) 화면 아래쪽에 겹쳐서
  let cardStyle: CSSProperties = { left: EDGE, right: EDGE, bottom: EDGE };
  if (box) {
    const width = Math.min(360, box.vw - EDGE * 2);
    const left = Math.min(Math.max(EDGE, box.x + box.w / 2 - width / 2), box.vw - EDGE - width);
    const below = box.y + box.h + GAP;
    const above = box.y - GAP - cardH;
    if (below + cardH <= box.vh - EDGE) cardStyle = { left, width, top: below };
    else if (above >= EDGE) cardStyle = { left, width, top: above };
    else cardStyle = { left, width, bottom: EDGE };
  }

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* 어둡게 + 흐리게. 구멍 부분은 clip-path로 비어 있어 아래 요소를 그대로 누를 수 있음 */}
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-[3px] motion-safe:animate-fade motion-safe:transition-[clip-path] motion-safe:duration-300"
        style={box ? { clipPath: holePath(box) } : undefined}
        aria-hidden
      />
      {box && (
        <div
          className="pointer-events-none fixed rounded-[18px] ring-2 ring-white/90 shadow-[0_0_0_6px_rgb(232_137_77/0.35)] motion-safe:transition-all motion-safe:duration-300"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          aria-hidden
        />
      )}
      <div
        ref={cardRef}
        className="fixed rounded-card border border-glass-border bg-glass-strong p-5 shadow-glass backdrop-glass motion-safe:transition-[top,left,bottom] motion-safe:duration-300"
        style={cardStyle}
      >
        <p className="text-xs font-semibold tabular-nums text-accent">
          {i + 1} / {list.length}
        </p>
        <h2 id={titleId} className="mt-1 text-lg font-bold leading-snug">
          {step.title}
        </h2>
        <p key={i} className="mt-1.5 text-[15px] leading-relaxed text-fg-sub motion-safe:animate-fade">
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <LinkButton onClick={close} className="font-medium text-fg-muted">
              건너뛰기
            </LinkButton>
          )}
          <span className="flex-1" />
          {i > 0 && (
            <Button variant="secondary" size="sm" onClick={prev} className="px-4 py-2.5 text-sm">
              이전
            </Button>
          )}
          <Button data-primary size="sm" onClick={next} className="px-4 py-2.5 text-sm">
            {last ? "알겠어요" : "다음"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 안내를 본 적 없으면 자동으로 한 번 열고, 닫으면 기억함. start()로 다시 보기 */
export function useTour(id: string, auto: boolean) {
  const key = `home-et:tour:${id}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!auto) return;
    let seen = true;
    try {
      seen = localStorage.getItem(key) !== null;
    } catch {
      /* 저장소를 못 쓰면 자동으로 띄우지 않음 */
    }
    if (seen) return;
    const t = setTimeout(() => setOpen(true), 500); // 화면이 자리 잡은 뒤
    return () => clearTimeout(t);
  }, [key, auto]);
  const close = useCallback(() => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* 무시 */
    }
    setOpen(false);
  }, [key]);
  const start = useCallback(() => setOpen(true), []);
  return { open, start, close };
}
