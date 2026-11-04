"use client";

/** 리포트 저장 UI: 리포트 화면의 저장 카드 + 시작 화면의 '기존 리포트 보기' + 목록 Dialog */
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardTitle, Dialog, FinePrint } from "@/components/ui";
import { MAX_REPORTS, type SavedReportMeta } from "@/lib/saved-reports";
import { useReports } from "./reports-context";

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// ── 리포트 화면: 저장 카드 ─────────────────────────────

export function SaveReportPanel() {
  const r = useReports();
  if (!r.enabled) return null;
  const count = r.list?.length ?? 0;

  return (
    <Card>
      <CardTitle aside={r.signedIn && r.list && <Badge tone="muted">{count}/{MAX_REPORTS}</Badge>}>리포트 저장</CardTitle>
      {!r.signedIn ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-sub">로그인하면 리포트를 {MAX_REPORTS}개까지 저장하고 나중에 다시 열어 볼 수 있어요.</p>
          <Button onClick={() => r.signIn()} disabled={r.signingIn} aria-busy={r.signingIn}>
            {r.signingIn ? "로그인 화면으로 이동 중…" : "Google로 로그인하고 저장"}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-fg-sub">
            {r.isSaved
              ? "지금 보고 있는 리포트가 저장돼 있어요."
              : r.editing
                ? <>저장한 리포트 <b className="text-fg">{r.editing.title}</b> 내용을 고치고 있어요.</>
                : "가치관이나 가정값을 바꿔 가며 비교해 보고, 마음에 드는 결과를 저장해 두세요."}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.isSaved ? (
              <Button variant="secondary" disabled>
                저장됨 ✓
              </Button>
            ) : r.editing ? (
              <>
                <Button onClick={r.overwrite} disabled={r.busy}>
                  이 리포트에 덮어쓰기
                </Button>
                <Button variant="secondary" onClick={r.saveNew} disabled={r.busy || !r.list}>
                  새로 저장
                </Button>
              </>
            ) : (
              <Button onClick={r.saveNew} disabled={r.busy || !r.list}>
                {r.busy ? "저장 중…" : "리포트 저장"}
              </Button>
            )}
          </div>
          {r.error && (
            <p role="alert" className="text-sm font-semibold text-accent">
              {r.error}
            </p>
          )}
        </div>
      )}
      <FinePrint className="mt-3">본가 주소와 대학생활 목표 글이 함께 저장돼요. 언제든 지울 수 있어요.</FinePrint>
    </Card>
  );
}

// ── 랜딩: '기존 리포트 보기' (저장 기능이 켜져 있을 때만) ─────────────────────────────

export function OpenReportsButton({ className }: { className?: string }) {
  const r = useReports();
  if (!r.enabled) return null;
  return (
    <Button variant="secondary" size="lg" block className={className} onClick={r.openReports} disabled={r.signingIn} aria-busy={r.signingIn}>
      {r.signingIn ? "로그인 화면으로 이동 중…" : "기존 리포트 보기"}
    </Button>
  );
}

// ── 목록 Dialog (열기 · 삭제) ─────────────────────────────

export function MyReportsDialog() {
  const r = useReports();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<SavedReportMeta | null>(null);

  // 닫으면 확인 단계는 초기화
  useEffect(() => {
    if (!r.dialog.open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Dialog를 닫을 때 확인 단계 초기화
      setConfirmDelete(null);
      setPendingOpen(null);
    }
  }, [r.dialog.open]);

  if (!r.signedIn) return null;

  // 저장 안 된 검사 결과가 있으면 덮어쓰기 전에 한 번 확인
  if (pendingOpen) {
    return (
      <Dialog
        open={r.dialog.open}
        onClose={r.closeDialog}
        title="지금 리포트를 덮어쓸까요?"
        actions={
          <>
            <Button variant="secondary" size="lg" onClick={() => setPendingOpen(null)}>
              취소
            </Button>
            <Button size="lg" disabled={r.busy} onClick={() => void r.open(pendingOpen.id)}>
              불러오기
            </Button>
          </>
        }
      >
        지금 보고 있는 결과는 저장되지 않았어요. <b className="text-fg">{pendingOpen.title}</b> 리포트를 불러오면 지금 결과는 사라져요.
      </Dialog>
    );
  }

  return (
    <Dialog
      open={r.dialog.open}
      onClose={r.closeDialog}
      title={`내 리포트 ${r.list?.length ?? 0}/${MAX_REPORTS}`}
      actions={
        <Button variant="secondary" size="lg" onClick={r.closeDialog}>
          닫기
        </Button>
      }
    >
      {r.dialog.notice && <p className="mb-3 font-semibold text-accent">{r.dialog.notice}</p>}
      {!r.list ? (
        <p>불러오는 중…</p>
      ) : r.list.length === 0 ? (
        <p>아직 저장한 리포트가 없어요. 리포트 화면에서 저장해 보세요.</p>
      ) : (
        <ul className="space-y-2">
          {r.list.map((item) => (
            <li key={item.id} className="rounded-panel border border-glass-border bg-surface/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{item.title}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {when(item.updatedAt)}
                    {r.editing?.id === item.id && " · 지금 보는 중"}
                  </p>
                </div>
                <Badge tone={item.summary.recommended ? "primary" : "accent"} className="shrink-0">
                  {item.summary.index.toFixed(1)}점
                </Badge>
              </div>
              {/* 삭제는 왼쪽(보조), 열기는 오른쪽(주 동작) */}
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant={confirmDelete === item.id ? "outline" : "ghost"}
                  disabled={r.busy}
                  onClick={() => {
                    if (confirmDelete === item.id) void r.remove(item.id).then(() => setConfirmDelete(null));
                    else setConfirmDelete(item.id);
                  }}
                >
                  {confirmDelete === item.id ? "정말 지우기" : "삭제"}
                </Button>
                <Button
                  size="sm"
                  disabled={r.busy}
                  onClick={() => (r.hasUnsaved ? setPendingOpen(item) : void r.open(item.id))}
                >
                  열기
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {r.error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-accent">
          {r.error}
        </p>
      )}
    </Dialog>
  );
}
