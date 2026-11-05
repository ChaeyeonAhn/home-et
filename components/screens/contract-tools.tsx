"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui";
import { cx, focusRing, glass } from "@/components/ui/styles";
import { LawAsk } from "./law-ask";
import { RegistryCheck } from "./registry-check";

type ToolId = "registry" | "law";

const TOOLS: { id: ToolId; title: string; sub: string; icon: ReactNode }[] = [
  { id: "registry", title: "등기부등본 확인하기", sub: "등본 PDF로 소유자·근저당 위험 신호 찾기", icon: <DocIcon /> },
  { id: "law", title: "계약서·특약 물어보기", sub: "궁금한 문장을 법 조문으로 쉽게 설명", icon: <ScaleIcon /> },
];

/**
 * 계약 D-day 아래의 계약 도구 두 개. 평소엔 작은 버튼만, 누르면 그 도구가 아래에 펼쳐짐 (한 번에 하나).
 * 접어도 컴포넌트는 남겨 두고 숨기기만 해서, 올린 등본 결과나 받은 답변이 그대로 유지됨
 */
export function ContractTools({ deposit }: { deposit: number }) {
  const [open, setOpen] = useState<ToolId | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const on = open === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-expanded={on}
              aria-controls={`tool-${t.id}`}
              onClick={() => setOpen((o) => (o === t.id ? null : t.id))}
              className={cx(
                "flex w-full items-center gap-3 rounded-card p-4 text-left transition",
                glass,
                focusRing,
                on ? "border-primary/30! bg-surface/90" : "hover:bg-surface/70",
              )}
            >
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition", on ? "bg-primary text-on-primary" : "bg-primary-soft text-primary")}>
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{t.title}</span>
                <span className="block truncate text-xs text-fg-sub">{t.sub}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className={cx("shrink-0 text-fg-muted transition-transform duration-200", on && "rotate-180 text-primary")}>
                <path d="m4.5 7 4.5 4.5L13.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>

      <div id="tool-registry" hidden={open !== "registry"}>
        <Card className="motion-safe:animate-rise">
          <RegistryCheck deposit={deposit} bare />
        </Card>
      </div>
      <div id="tool-law" hidden={open !== "law"}>
        <Card className="motion-safe:animate-rise">
          <LawAsk bare />
        </Card>
      </div>
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5.5 2.75h6l3.75 3.75v10a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75V3.5a.75.75 0 0 1 .75-.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.25 2.75V6.5h3.75M7.5 10.5h5M7.5 13.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 3v13.5M6 16.5h8M4 6h12M10 3.5 4 6M10 3.5 16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 6-2.25 5a2.5 2.5 0 0 0 4.5 0L4 6ZM16 6l-2.25 5a2.5 2.5 0 0 0 4.5 0L16 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
