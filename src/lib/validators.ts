import { z } from "zod";

const status = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const sprintStatus = z.enum(["PLANNED", "ACTIVE", "DONE"]);

// 상단 property bar의 인라인 편집이 쓰는 단일 필드 검증용 스키마.
export const statusEnum = status;
export const priorityEnum = priority;
export const sprintStatusEnum = sprintStatus;
export const assigneeIdSchema = z.string().min(1).nullable();

// 폼은 미선택 시 null 을 보낸다(undefined 아님). null·undefined·"" 모두 null 로 정규화.
const optionalId = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

// 필수 관계 id (팀 등): 비어 있으면 검증 실패.
const requiredId = z.string().trim().min(1, "값을 선택하세요");

const optionalDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? new Date(v) : null));

// 숫자 옵션 필드(MD 등). ""/null/undefined 는 모두 null 로 정규화, 그 외엔 0 이상 실수.
const optionalMd = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().min(0).nullable(),
);

export const sprintSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(200),
  status: sprintStatus.default("PLANNED"),
  startDate: optionalDate,
  endDate: optionalDate,
});

export const teamSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "key를 입력하세요")
    .max(20)
    .regex(/^[A-Z0-9]+$/, "대문자/숫자만 사용하세요")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, "이름을 입력하세요").max(50),
  color: z.string().trim().optional().nullable(),
});

export const projectSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  description: z.string().optional().nullable(),
  status: status.default("BACKLOG"),
  priority: priority.default("MEDIUM"),
  ownerId: optionalId,
  sprintId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
});

export const epicSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  description: z.string().optional().nullable(),
  status: status.default("BACKLOG"),
  priority: priority.default("MEDIUM"),
  ownerId: optionalId,
  teamId: requiredId,
  projectId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  description: z.string().optional().nullable(),
  status: status.default("TODO"),
  priority: priority.default("MEDIUM"),
  assigneeId: optionalId,
  reporterId: optionalId,
  teamId: requiredId,
  epicId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
  storyPoints: z.coerce.number().int().min(0).max(100).optional().nullable(),
  estimatedMd: optionalMd,
  actualMd: optionalMd,
});

export const wikiPageSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  parentId: optionalId,
  folderId: optionalId,
});

export const wikiFolderSchema = z.object({
  name: z.string().trim().min(1, "폴더 이름을 입력하세요").max(100),
  parentId: optionalId,
});

// 위키 인라인 댓글 본문(B10). 평문(멘션 없이) — 짧은 코멘트/답글.
export const wikiCommentBodySchema = z
  .string()
  .trim()
  .min(1, "댓글을 입력하세요")
  .max(2000);

export type SprintInput = z.infer<typeof sprintSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type EpicInput = z.infer<typeof epicSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type WikiPageInput = z.infer<typeof wikiPageSchema>;
export type WikiFolderInput = z.infer<typeof wikiFolderSchema>;
