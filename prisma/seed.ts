import { PrismaClient } from "@prisma/client";

// tsx doesn't auto-load .env (the Prisma CLI does). Load it if present.
try {
  process.loadEnvFile?.();
} catch {
  // no .env file — rely on the ambient environment
}

const prisma = new PrismaClient();

async function main() {
  // Demo members (in production these are created on first Google login).
  const [jiwon, minseo, taehyung] = await Promise.all([
    prisma.user.upsert({
      where: { email: "jiwon@example.com" },
      update: {},
      create: { email: "jiwon@example.com", name: "김지원", role: "ADMIN" },
    }),
    prisma.user.upsert({
      where: { email: "minseo@example.com" },
      update: {},
      create: { email: "minseo@example.com", name: "이민서" },
    }),
    prisma.user.upsert({
      where: { email: "taehyung@example.com" },
      update: {},
      create: { email: "taehyung@example.com", name: "구태형" },
    }),
  ]);

  const initiative = await prisma.initiative.create({
    data: {
      title: "2026 상반기 브랜드 캠페인",
      description: "봄 시즌 신규 브랜드 캠페인 기획 및 실행",
      status: "IN_PROGRESS",
      priority: "HIGH",
      ownerId: jiwon.id,
      startDate: new Date("2026-01-05"),
      dueDate: new Date("2026-06-30"),
    },
  });

  const epic = await prisma.epic.create({
    data: {
      title: "랜딩 페이지 리뉴얼",
      description: "캠페인 랜딩 페이지 기획/디자인/개발",
      status: "IN_PROGRESS",
      priority: "HIGH",
      ownerId: minseo.id,
      initiativeId: initiative.id,
      startDate: new Date("2026-02-01"),
      dueDate: new Date("2026-03-15"),
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "히어로 배너 카피 작성",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: jiwon.id,
        reporterId: minseo.id,
        epicId: epic.id,
        dueDate: new Date("2026-02-20"),
        storyPoints: 3,
      },
      {
        title: "랜딩 와이어프레임 설계",
        status: "IN_REVIEW",
        priority: "MEDIUM",
        assigneeId: minseo.id,
        reporterId: minseo.id,
        epicId: epic.id,
        dueDate: new Date("2026-02-25"),
        storyPoints: 5,
      },
      {
        title: "타겟 세그먼트 정의",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: taehyung.id,
        reporterId: jiwon.id,
        epicId: epic.id,
        dueDate: new Date("2026-03-02"),
        storyPoints: 2,
      },
      {
        title: "성과 지표(KPI) 대시보드 초안",
        status: "BACKLOG",
        priority: "LOW",
        reporterId: jiwon.id,
        epicId: epic.id,
      },
    ],
  });

  const parent = await prisma.wikiPage.create({
    data: {
      title: "브랜드 캠페인 위키",
      authorId: jiwon.id,
      editorId: jiwon.id,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "브랜드 캠페인 개요" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "이 공간에서 캠페인 기획 문서와 회의록을 함께 관리합니다.",
              },
            ],
          },
        ],
      },
    },
  });

  await prisma.wikiPage.create({
    data: {
      title: "킥오프 회의록",
      parentId: parent.id,
      authorId: minseo.id,
      editorId: minseo.id,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "2026-01-05 킥오프" }],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "목표와 일정 공유" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "역할 분담 확정" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
