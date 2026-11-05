"use client";

import type { ReactNode } from "react";
import { DocIcon, ScaleIcon } from "@/components/assistant/assistant";
import { cx, focusRing, glass } from "@/components/ui/styles";
import { openAssistant, type AssistantMode } from "@/lib/assistant-events";

const TOOLS: { mode: AssistantMode; title: string; sub: string; icon: ReactNode }[] = [
  { mode: "registry", title: "등기부등본 확인하기", sub: "등본 PDF로 소유자·근저당 위험 신호 찾기", icon: <DocIcon /> },
  { mode: "law", title: "계약서·특약 물어보기", sub: "궁금한 문장을 법 조문으로 쉽게 설명", icon: <ScaleIcon /> },
];

/**
 * 계약 D-day 아래의 계약 도구 버튼 두 개. 누르면 화면에 펼치지 않고 오른쪽 아래 도우미 창을 그 기능으로 염
 * (components/assistant/assistant.tsx). 페이지가 길어지지 않게
 */
export function ContractTools() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TOOLS.map((t) => (
        <button
          key={t.mode}
          type="button"
          aria-haspopup="dialog"
          onClick={() => openAssistant({ mode: t.mode })}
          className={cx("flex w-full items-center gap-3 rounded-card p-4 text-left transition hover:bg-surface/70", glass, focusRing)}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{t.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{t.title}</span>
            <span className="block truncate text-xs text-fg-sub">{t.sub}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-fg-muted">
            <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
