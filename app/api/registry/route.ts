// 등기부등본 PDF → 구조화(lib/registry.ts) → 위험 신호(lib/registry-rules.ts). docs/registry.md
//
// ① 글자가 있는 PDF(인터넷등기소 열람·발급본): unpdf로 글자 위치를 뽑아 표 칸으로 나눔. 키 없이 동작
// ② 스캔본·사진처럼 글자가 없으면: Gemini 문서 이해로 등기 기록을 JSON으로 뽑음 (GEMINI_API_KEY 필요)
// 개인정보가 들어 있어 파일과 내용은 저장하지도, 로그로 남기지도 않음
import { GoogleGenAI } from "@google/genai";
import { getDocumentProxy } from "unpdf";
import { z } from "zod";
import data from "@/data/law-chunks.json";
import type { LawChunk } from "@/lib/law-search";
import { parseRegistry, toFacts, type Entry, type RegistryFacts, type TextItem } from "@/lib/registry";
import { checkRegistry, type RegistryResult } from "@/lib/registry-rules";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

const lawById = new Map((data.chunks as LawChunk[]).map((c) => [c.id, c]));

async function textItems(bytes: Uint8Array): Promise<TextItem[]> {
  const pdf = await getDocumentProxy(bytes);
  const items: TextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items: raw } = await (await pdf.getPage(p)).getTextContent();
    for (const it of raw) if ("str" in it && it.str.trim()) items.push({ page: p, x: it.transform[4], y: it.transform[5], str: it.str });
  }
  return items;
}

// ── Gemini 문서 이해 (글자가 없는 PDF용) ─────────────────────────────

const GEMINI_PROMPT = `이 문서는 한국 부동산 등기사항전부증명서(등기부등본)야.
갑구(소유권에 관한 사항)와 을구(소유권 이외의 권리에 관한 사항)의 모든 기록을 순서대로 옮겨 줘.
- 각 기록: section("갑" 또는 "을"), rank(순위번호, 예 "10", "10-1"), purpose(등기목적), receipt(접수), cause(등기원인), details(권리자 및 기타사항을 줄마다 나눈 배열)
- 빨간 줄로 그어진 기록은 말소된 것이야. 그 기록은 cancelled를 true로 해.
- 글자는 보이는 그대로 옮기고, 없는 내용을 만들지 마.
- 문서 맨 위의 제목(title), 부동산 종류(propertyType: 집합건물/건물/토지), 소재지(address), 열람일시(viewedAt, YYYY-MM-DD)도 넣어 줘.`;

const entrySchema = {
  type: "object",
  properties: {
    section: { type: "string", enum: ["갑", "을"] },
    rank: { type: "string" },
    purpose: { type: "string" },
    receipt: { type: "string" },
    cause: { type: "string" },
    details: { type: "array", items: { type: "string" } },
    cancelled: { type: "boolean" },
  },
  required: ["section", "rank", "purpose", "receipt", "cause", "details", "cancelled"],
};
const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    propertyType: { type: "string" },
    address: { type: "string" },
    viewedAt: { type: "string" },
    entries: { type: "array", items: entrySchema },
  },
  required: ["title", "propertyType", "address", "viewedAt", "entries"],
};
const GeminiOut = z.object({
  title: z.string(),
  propertyType: z.string(),
  address: z.string(),
  viewedAt: z.string(),
  entries: z.array(
    z.object({
      section: z.enum(["갑", "을"]),
      rank: z.string(),
      purpose: z.string(),
      receipt: z.string(),
      cause: z.string(),
      details: z.array(z.string()),
      cancelled: z.boolean(),
    }),
  ),
});

async function geminiFacts(apiKey: string, bytes: Uint8Array): Promise<RegistryFacts> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: "application/pdf", data: Buffer.from(bytes).toString("base64") } }, { text: GEMINI_PROMPT }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_SCHEMA,
      temperature: 0,
      abortSignal: AbortSignal.timeout(60_000),
    },
  });
  const out = GeminiOut.parse(JSON.parse(res.text ?? ""));
  const entries: Entry[] = out.entries.map((e) => ({ ...e, purpose: e.purpose.replace(/\s+/g, "") }));
  // 말소 기록("7번…말소")으로도 한 번 더 표시: Gemini가 빨간 줄을 놓쳐도 잡히게
  for (const e of entries) {
    const m = /^(\d+(?:-\d+)?)번.*말소$/.exec(e.purpose);
    if (m) for (const t of entries) if (t.section === e.section && (t.rank === m[1] || t.rank.startsWith(`${m[1]}-`))) t.cancelled = true;
  }
  return toFacts({ entries, title: out.title, propertyType: out.propertyType, address: out.address, viewedAt: out.viewedAt || null });
}

// ── 핸들러 ─────────────────────────────

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "파일을 받지 못했어요." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "등기부등본 PDF를 올려 주세요." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "10MB 이하 파일만 올릴 수 있어요." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return Response.json({ error: "PDF 파일만 올릴 수 있어요." }, { status: 415 });

  const ctx = {
    today: new Date().toISOString().slice(0, 10),
    deposit: num(form.get("deposit")) ?? 0,
    price: num(form.get("price")),
    landlord: String(form.get("landlord") ?? "").trim() || null,
  };

  let facts: RegistryFacts | null = null;
  let source: RegistryResult["source"] = "text";
  try {
    const items = await textItems(bytes);
    const parsed = items.length ? parseRegistry(items) : null;
    if (parsed && parsed.entries.length) facts = parsed;
  } catch {
    // 글자 추출 실패 → 아래에서 Gemini로
  }

  if (!facts) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "글자를 읽을 수 없는 PDF예요. 인터넷등기소에서 열람한 PDF를 그대로 올려 주세요." }, { status: 422 });
    }
    try {
      facts = await geminiFacts(apiKey, bytes);
      source = "gemini";
    } catch {
      console.error("[registry] Gemini 문서 이해 실패"); // 등본 내용은 남기지 않음
      return Response.json({ error: "등기부등본을 읽지 못했어요. 인터넷등기소에서 열람한 PDF인지 확인해 주세요." }, { status: 422 });
    }
  }

  if (!/등기사항.*증명서/.test(facts.title) && facts.entries.length === 0) {
    return Response.json({ error: "등기사항전부증명서가 아닌 것 같아요." }, { status: 422 });
  }

  const { entries: _entries, ...rest } = facts;
  void _entries;
  const signals = checkRegistry(facts, ctx);
  const laws: RegistryResult["laws"] = {};
  for (const id of new Set(signals.flatMap((s) => s.laws))) {
    const c = lawById.get(id);
    if (c) laws[id] = { label: `${c.law} ${c.article}${c.title ? `(${c.title})` : ""}`, url: c.url };
  }
  const result: RegistryResult = { source, facts: rest, signals, laws };
  return Response.json(result);
}
