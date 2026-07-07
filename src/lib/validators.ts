import { z } from "zod";

const status = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const initiativeSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  description: z.string().optional().nullable(),
  status: status.default("BACKLOG"),
  priority: priority.default("MEDIUM"),
  ownerId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
});

export const epicSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  description: z.string().optional().nullable(),
  status: status.default("BACKLOG"),
  priority: priority.default("MEDIUM"),
  ownerId: optionalId,
  initiativeId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  description: z.string().optional().nullable(),
  status: status.default("TODO"),
  priority: priority.default("MEDIUM"),
  assigneeId: optionalId,
  epicId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
  storyPoints: z.coerce.number().int().min(0).max(100).optional().nullable(),
});

export const wikiPageSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  parentId: optionalId,
});

export type InitiativeInput = z.infer<typeof initiativeSchema>;
export type EpicInput = z.infer<typeof epicSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type WikiPageInput = z.infer<typeof wikiPageSchema>;
