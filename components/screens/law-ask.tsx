"use client";

import { useState } from "react";
import type { AskResult, AskSource } from "@/lib/law-search";
import { Button, Callout, Card, CardTitle, FinePrint, QuickChips, SectionLabel, TextArea, TextLink } from "@/components/ui";

/** 예시 질문: 칩에는 짧은 이름, 누르면 전체 질문을 보냄 (근거 조문이 확실히 나오는 질문으로 고름) */
const EXAMPLES = [
  { label: "월세 10% 인상", question: "집주인이 재계약 때 월세를 10% 올린대요" },
  { label: "보일러 수리는 누가?", question: "보일러가 고장 나면 수리는 누가 해요?" },
  { label: "보증금을 못 돌려받으면?", question: "계약 끝났는데 보증금을 못 돌려받으면 어떡해요?" },
  { label: "집주인이 바뀌면?", question: "집주인이 바뀌면 저는 나가야 하나요?" },
];

const SOURCE_NOTE: Record<AskResult["source"], string> = {
  "file-search": "Gemini API File Search가 법령 저장소에서 찾은 조문이에요.",
  llm: "키워드 검색으로 찾은 조문을 Gemini가 설명했어요.",
  search: "키워드 검색으로 찾은 조문이에요.",
};

/** 계약서·특약 질문 → 관련 법 조문 + 쉬운 설명 (/api/ask, docs/law-rag.md) */
export function LawAsk() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const ask = async (q = question) => {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion(text);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as AskResult);
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardTitle meta="관련 법 조문으로 설명해요">계약서·특약 물어보기</CardTitle>
      <div className="mt-4 space-y-3">
        <TextArea
          aria-label="계약서·특약 질문"
          rows={3}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          placeholder="계약서 문장이나 궁금한 점을 적어 주세요. 예: 나갈 때 벽지 원상복구를 해야 하나요?"
        />
        <QuickChips label="예시 질문" items={EXAMPLES.map((e) => ({ value: e.question, label: e.label }))} onSelect={(q) => ask(q)} />
        <div className="flex justify-end">
          <Button onClick={() => ask()} disabled={!question.trim() || loading}>
            {loading ? "조문 찾는 중…" : "물어보기"}
          </Button>
        </div>
      </div>

      {error && (
        <Callout tone="warning" className="mt-4">
          답변을 가져오지 못했어요. 잠시 뒤에 다시 시도해 주세요.
        </Callout>
      )}

      {result && (
        <div className="mt-5 space-y-4" aria-live="polite">
          {result.answer ? (
            <Callout>{result.answer}</Callout>
          ) : (
            <Callout tone="neutral">
              {result.sources.length
                ? "AI 설명을 만들지 못해 관련 조문만 보여 드려요."
                : "관련 조문을 찾지 못했어요. 다른 말로 물어보거나 공인중개사, 대한법률구조공단(132)에 확인해 보세요."}
            </Callout>
          )}
          {result.sources.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>{result.answer ? "근거 조문" : "관련 조문"}</SectionLabel>
              <p className="text-xs text-fg-muted">{SOURCE_NOTE[result.source]}</p>
              {result.sources.map((s) => (
                <SourceItem key={s.id} source={s} dim={!!result.answer && !s.cited} />
              ))}
            </div>
          )}
        </div>
      )}

      <FinePrint className="mt-4">
        법제처 국가법령정보의 현행 조문을 바탕으로 한 일반 정보이며 법률 자문이 아니에요. 실제 계약에서는 계약서 원문과 공인중개사 설명을 함께 확인하세요.
      </FinePrint>
    </Card>
  );
}

/** 조문 한 개: 제목 + 접었다 펴는 원문 + 법제처 링크. dim = AI가 근거로 쓰지 않은 참고 조문 */
function SourceItem({ source, dim }: { source: AskSource; dim: boolean }) {
  return (
    <details className={`group rounded-panel border border-border bg-surface-subtle px-4 py-3 ${dim ? "opacity-70" : ""}`}>
      <summary className="cursor-pointer list-none text-sm font-bold text-primary">
        {source.label}
        {dim && <span className="ml-1.5 text-xs font-normal text-fg-muted">참고</span>}
      </summary>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-sub">{source.text}</p>
      <TextLink href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs">
        법제처에서 원문 보기 ↗
      </TextLink>
    </details>
  );
}
