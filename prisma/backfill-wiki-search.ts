import { PrismaClient } from "@prisma/client";

// tsx doesn't auto-load .env (the Prisma CLI does). Load it if present.
try {
  process.loadEnvFile?.();
} catch {
  // no .env file — rely on the ambient environment
}

const prisma = new PrismaClient();

// 주의: src/lib/rich-content.ts 의 docToPlainText 와 동일 로직을 인라인한다.
// (tsx 가 '@/' alias 를 해석하지 못해 relative import 시 전이 의존이 깨지므로 복제.)
// rich-content 의 docToPlainText 를 바꾸면 여기도 함께 맞춘다.
type Node = {
  type?: string;
  text?: string;
  attrs?: { label?: string };
  content?: Node[];
};

function docToPlainText(doc: Node | null | undefined): string {
  let out = "";
  const walk = (node: Node | undefined) => {
    if (!node) return;
    if (node.type === "personMention") {
      out += `@${node.attrs?.label ?? ""}`;
      return;
    }
    if (node.type === "ticketMention") {
      out += node.attrs?.label ?? "";
      return;
    }
    if (typeof node.text === "string") out += node.text;
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
      if (node.type === "paragraph" || node.type === "heading") out += "\n";
    }
  };
  walk(doc ?? undefined);
  return out.replace(/\n{2,}/g, "\n").trim();
}

async function main() {
  // 미백필(searchText=null)만 대상 — 재실행 안전(idempotent). 이미 채워진 건 건너뜀.
  const pages = await prisma.wikiPage.findMany({
    where: { searchText: null },
    select: { id: true, content: true },
  });
  console.log(`백필 대상 위키 페이지: ${pages.length}건`);

  let updated = 0;
  for (const page of pages) {
    const text = docToPlainText(page.content as Node);
    await prisma.wikiPage.update({
      where: { id: page.id },
      data: { searchText: text },
    });
    updated += 1;
  }
  console.log(`✓ searchText 백필 완료: ${updated}건`);
}

main()
  .catch((e) => {
    console.error("✗ 백필 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
