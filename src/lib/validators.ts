import { z } from "zod";

const status = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const sprintStatus = z.enum(["PLANNED", "ACTIVE", "DONE"]);

// 상단 property bar의 인라인 편집이 쓰는 단일 필드 검증용 스키마.
export const statusEnum = status;
export const priorityEnum = priority;
export const sprintStatusEnum = sprintStatus;
export const assigneeIdSchema = z.string().min(1).nullable();

// 본인 프로필 편집(내 정보). 이름은 필수, 연락처는 옵션(빈 값은 null).
export const profileSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(100),
  phone: z.string().trim().max(30).nullish(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

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
  estimatedMd: optionalMd,
  actualMd: optionalMd,
});

// 라벨(C8). name 은 필수(고유), color 는 옵션 hex(#RRGGBB) — 미지정 시 DB 기본값 사용.
// gotchas §3: 옵션 필드는 .optional() 이 아니라 .nullish() 로(폼이 null 을 보냄).
export const labelSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(50),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "색상은 #RRGGBB 형식이어야 합니다")
    .nullish()
    .transform((v) => (v ? v : null)),
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

// 태스크 댓글 본문(B6). Tiptap doc JSON 문자열이라 평문 스키마와 별개 —
// 구조/크기만 방어(빈 문서 여부는 isValueEmpty 로 별도 판정). 과대 페이로드 차단.
export const taskCommentBodySchema = z
  .string()
  .max(100_000, "댓글이 너무 깁니다");

export type SprintInput = z.infer<typeof sprintSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type EpicInput = z.infer<typeof epicSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type LabelInput = z.infer<typeof labelSchema>;
export type WikiPageInput = z.infer<typeof wikiPageSchema>;
export type WikiFolderInput = z.infer<typeof wikiFolderSchema>;

export const createBranchSchema = z.object({
  taskId: z.string(),
  repoFullName: z.string().min(1),
  branchName: z.string().min(1),
  base: z.string().nullish(),
});
