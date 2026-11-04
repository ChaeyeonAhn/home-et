/**
 * 법령 조문을 Gemini API File Search 저장소에 올리기 (Google 관리형 RAG)
 *
 *   npm run build:file-search     (.env.local의 GEMINI_API_KEY 필요)
 *
 * data/law-chunks.json의 조문을 하나씩 문서로 올려요(조문 1개 = 문서 1개).
 * 자르기·임베딩·색인은 File Search가 하고, 답변의 근거(grounding)가 조문 단위로 돌아와요.
 * 끝나면 출력되는 저장소 이름을 .env.local의 GEMINI_FILE_SEARCH_STORE에 넣으세요.
 * 저장소는 API 키의 프로젝트에 속해서, 다른 키를 쓰면 이 스크립트를 다시 돌려야 해요.
 * GEMINI_FILE_SEARCH_STORE가 이미 있으면 그 저장소는 지우고 새로 만들어요.
 */
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

interface LawChunk {
  id: string;
  law: string;
  article: string;
  title: string;
  text: string;
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(".env.local에 GEMINI_API_KEY가 없어요");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 문서 이름 = 화면에 보여 줄 조문 이름. /api/ask가 근거를 조문으로 되돌릴 때 customMetadata의 id를 씀 */
const docName = (c: LawChunk) => `${c.law} ${c.article}${c.title ? `(${c.title})` : ""}`;

async function main() {
  const { chunks } = JSON.parse(readFileSync("data/law-chunks.json", "utf8")) as { chunks: LawChunk[] };

  const old = process.env.GEMINI_FILE_SEARCH_STORE;
  if (old) {
    await ai.fileSearchStores.delete({ name: old, config: { force: true } }).catch(() => {});
    console.log(`이전 저장소 삭제: ${old}`);
  }

  const store = await ai.fileSearchStores.create({ config: { displayName: "home-et-law" } });
  console.log(`저장소 생성: ${store.name}`);

  for (const [i, c] of chunks.entries()) {
    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: store.name!,
      file: new Blob([`${docName(c)}\n\n${c.text}`], { type: "text/plain" }),
      config: {
        mimeType: "text/plain",
        displayName: docName(c),
        customMetadata: [
          { key: "id", stringValue: c.id },
          { key: "law", stringValue: c.law },
        ],
        // 가장 긴 조문도 한두 조각이면 되게 크게 자름
        chunkingConfig: { whiteSpaceConfig: { maxTokensPerChunk: 512, maxOverlapTokens: 32 } },
      },
    });
    while (!op.done) {
      await sleep(1_500);
      op = await ai.operations.get({ operation: op });
    }
    if (op.error) throw new Error(`${c.id} 업로드 실패: ${JSON.stringify(op.error)}`);
    process.stdout.write(`\r업로드 ${i + 1}/${chunks.length}`);
  }

  console.log(`\n\n완료. .env.local에 아래 줄을 넣으세요:\nGEMINI_FILE_SEARCH_STORE=${store.name}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
