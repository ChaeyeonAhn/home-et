import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui";

/**
 * 계약 도구(등본 확인·특약 물어보기)의 겉모양. bare면 카드와 제목 없이 내용만
 * (contract-tools.tsx에서 버튼을 눌러 펼칠 때는 버튼이 제목 역할을 해서 bare로 씀)
 */
export function ToolShell({ bare, title, meta, children }: { bare?: boolean; title: string; meta?: string; children: ReactNode }) {
  if (bare) return <div>{children}</div>;
  return (
    <Card>
      <CardTitle meta={meta}>{title}</CardTitle>
      {children}
    </Card>
  );
}
