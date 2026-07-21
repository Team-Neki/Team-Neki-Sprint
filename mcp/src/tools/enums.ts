import { z } from "zod";

// API(zod)와 동일한 값 집합. BACKLOG 는 DB Status enum 에 없어 API 에서 400 이라 제외.
export const STATUS = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
