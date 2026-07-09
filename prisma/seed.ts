import { PrismaClient } from "@prisma/client";

// tsx doesn't auto-load .env (the Prisma CLI does). Load it if present.
try {
  process.loadEnvFile?.();
} catch {
  // no .env file — rely on the ambient environment
}

const prisma = new PrismaClient();

// 초기 팀(= 이슈 key 접두어 = 유저 그룹). ADR 0002 확정 7개.
const TEAMS = [
  { key: "DESIGN", name: "디자인", color: "#8b5cf6" },
  { key: "FRONTEND", name: "프론트엔드", color: "#0070f3" },
  { key: "BACKEND", name: "백엔드", color: "#10b981" },
  { key: "AOS", name: "안드로이드", color: "#f59e0b" },
  { key: "IOS", name: "iOS", color: "#64748b" },
  { key: "MARKETING", name: "마케팅", color: "#ec4899" },
  { key: "PM", name: "기획", color: "#ef4444" },
];

async function main() {
  // ---------- 팀 (유저 배정은 관리 UI에서 수동으로) ----------
  await Promise.all(
    TEAMS.map((t) =>
      prisma.team.upsert({
        where: { key: t.key },
        update: { name: t.name, color: t.color },
        create: t,
      }),
    ),
  );
  const teamByKey = Object.fromEntries(
    (await prisma.team.findMany()).map((t) => [t.key, t]),
  );

  // ---------- 데모 멤버 (실서비스는 Google 최초 로그인 시 생성) ----------
  // 시연을 위해 일부만 팀에 배정한다(정책상 배정은 수동이지만 데모 데이터로 노출).
  const [jiwon, minseo, taehyung, dohyun] = await Promise.all([
    prisma.user.upsert({
      where: { email: "jiwon@example.com" },
      update: { teamId: teamByKey.PM.id, phone: "010-1000-0001" },
      create: {
        email: "jiwon@example.com",
        name: "김지원",
        role: "ADMIN",
        teamId: teamByKey.PM.id,
        phone: "010-1000-0001",
      },
    }),
    prisma.user.upsert({
      where: { email: "minseo@example.com" },
      update: { teamId: teamByKey.DESIGN.id, phone: "010-1000-0002" },
      create: {
        email: "minseo@example.com",
        name: "이민서",
        teamId: teamByKey.DESIGN.id,
        phone: "010-1000-0002",
      },
    }),
    prisma.user.upsert({
      where: { email: "taehyung@example.com" },
      update: { teamId: teamByKey.BACKEND.id, phone: "010-1000-0003" },
      create: {
        email: "taehyung@example.com",
        name: "구태형",
        teamId: teamByKey.BACKEND.id,
        phone: "010-1000-0003",
      },
    }),
    prisma.user.upsert({
      where: { email: "dohyun@example.com" },
      update: { teamId: teamByKey.FRONTEND.id, phone: "010-1000-0004" },
      create: {
        email: "dohyun@example.com",
        name: "박도현",
        teamId: teamByKey.FRONTEND.id,
        phone: "010-1000-0004",
      },
    }),
  ]);

  // ---------- 스프린트 ----------
  const sprintH1 = await prisma.sprint.create({
    data: {
      name: "2026 상반기 스프린트",
      status: "ACTIVE",
      startDate: new Date("2026-01-05"),
      endDate: new Date("2026-06-30"),
    },
  });
  await prisma.sprint.create({
    data: {
      name: "2026 3분기 스프린트",
      status: "PLANNED",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-09-30"),
    },
  });

  // ---------- 프로젝트 (팀 횡단 작업) ----------
  const campaign = await prisma.project.create({
    data: {
      title: "브랜드 캠페인 리뉴얼",
      description: "봄 시즌 신규 브랜드 캠페인 랜딩/프론트/기획을 팀 횡단으로 진행",
      status: "IN_PROGRESS",
      priority: "HIGH",
      ownerId: jiwon.id,
      sprintId: sprintH1.id,
      startDate: new Date("2026-01-05"),
      dueDate: new Date("2026-03-31"),
    },
  });
  const search = await prisma.project.create({
    data: {
      title: "검색 품질 개선",
      description: "검색 랭킹/색인 개선을 통한 전환율 향상",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      ownerId: taehyung.id,
      sprintId: sprintH1.id,
      startDate: new Date("2026-02-01"),
      dueDate: new Date("2026-05-15"),
    },
  });

  // 팀 시퀀스: epic·task가 팀 단위 연속 번호를 공유(재시작 없음).
  // 아래에서 팀별로 번호를 수동 부여하고, 끝에서 Team.seq를 max로 맞춘다.

  // DESIGN: 랜딩 리뉴얼 에픽 + 태스크
  const designEpic = await prisma.epic.create({
    data: {
      number: 1, // DESIGN-1
      title: "랜딩 페이지 리뉴얼",
      description: "캠페인 랜딩 페이지 기획/디자인",
      status: "IN_PROGRESS",
      priority: "HIGH",
      ownerId: minseo.id,
      teamId: teamByKey.DESIGN.id,
      projectId: campaign.id,
      startDate: new Date("2026-02-01"),
      dueDate: new Date("2026-03-15"),
    },
  });
  await prisma.task.createMany({
    data: [
      {
        number: 2, // DESIGN-2
        title: "히어로 배너 디자인",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: minseo.id,
        reporterId: jiwon.id,
        teamId: teamByKey.DESIGN.id,
        epicId: designEpic.id,
        dueDate: new Date("2026-02-20"),
      },
      {
        number: 3, // DESIGN-3
        title: "랜딩 와이어프레임 설계",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        assigneeId: minseo.id,
        reporterId: minseo.id,
        teamId: teamByKey.DESIGN.id,
        epicId: designEpic.id,
        dueDate: new Date("2026-02-25"),
      },
    ],
  });

  // FRONTEND: 랜딩 프론트 구현
  const feEpic = await prisma.epic.create({
    data: {
      number: 1, // FRONTEND-1
      title: "랜딩 프론트 구현",
      description: "디자인 시안을 반응형 웹으로 구현",
      status: "TODO",
      priority: "HIGH",
      ownerId: dohyun.id,
      teamId: teamByKey.FRONTEND.id,
      projectId: campaign.id,
      startDate: new Date("2026-02-25"),
      dueDate: new Date("2026-03-25"),
    },
  });
  await prisma.task.create({
    data: {
      number: 2, // FRONTEND-2
      title: "히어로 컴포넌트 개발",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: dohyun.id,
      reporterId: dohyun.id,
      teamId: teamByKey.FRONTEND.id,
      epicId: feEpic.id,
      dueDate: new Date("2026-03-05"),
    },
  });

  // BACKEND: 검색 랭킹 개선
  const beEpic = await prisma.epic.create({
    data: {
      number: 1, // BACKEND-1
      title: "검색 랭킹 개선",
      description: "랭킹 지표 수집 및 A/B 테스트 파이프라인 구축",
      status: "IN_PROGRESS",
      priority: "HIGH",
      ownerId: taehyung.id,
      teamId: teamByKey.BACKEND.id,
      projectId: search.id,
      startDate: new Date("2026-02-05"),
      dueDate: new Date("2026-04-30"),
    },
  });
  await prisma.task.createMany({
    data: [
      {
        number: 2, // BACKEND-2
        title: "랭킹 지표 수집 배치",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: taehyung.id,
        reporterId: taehyung.id,
        teamId: teamByKey.BACKEND.id,
        epicId: beEpic.id,
        dueDate: new Date("2026-03-10"),
      },
      {
        number: 3, // BACKEND-3
        title: "A/B 테스트 파이프라인",
        status: "BACKLOG",
        priority: "MEDIUM",
        reporterId: taehyung.id,
        teamId: teamByKey.BACKEND.id,
        epicId: beEpic.id,
        dueDate: new Date("2026-04-01"),
      },
    ],
  });

  // Team.seq를 팀별 최대 번호로 맞춰, 이후 UI 생성분이 이어지도록 한다.
  await Promise.all([
    prisma.team.update({ where: { key: "DESIGN" }, data: { seq: 3 } }),
    prisma.team.update({ where: { key: "FRONTEND" }, data: { seq: 2 } }),
    prisma.team.update({ where: { key: "BACKEND" }, data: { seq: 3 } }),
  ]);

  // ---------- 위키 ----------
  // 데모 폴더(문서 그룹핑). 페이지 중첩(parentId)과는 별개 타입.
  const campaignFolder = await prisma.wikiFolder.create({
    data: { name: "캠페인 문서" },
  });

  const parent = await prisma.wikiPage.create({
    data: {
      title: "브랜드 캠페인 위키",
      folderId: campaignFolder.id,
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
