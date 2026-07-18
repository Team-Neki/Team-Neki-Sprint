# Sprint MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose ticket (create/update/get/search) and wiki (create/update/get/search) operations to MCP clients (Claude Code/Desktop/Cursor) via a thin MCP server that calls a new token-authenticated HTTP API on the deployed Sprint app, so teammates can drive the tracker from their assistant using their own account.

**Architecture:** MCP server (`mcp/`, stdio) → HTTP + `Authorization: Bearer <personal token>` → new `/api/mcp/v1/*` Next.js route handlers → existing server logic refactored into actor-injectable "core" functions → Prisma. No business logic (issue keys, activity log, notifications, revisions, cache invalidation) is duplicated in the MCP layer.

**Tech Stack:** Next.js 16 (App Router route handlers), Prisma 6 (PostgreSQL), NextAuth v5 (existing session; new `ApiToken` model for MCP), zod 4 (app validators), `@modelcontextprotocol/sdk` + zod 3 (mcp package), Vitest.

---

## Worktree & environment constraints (read first)

- **This runs in the `.worktrees/mcp-server` worktree** (branch `feat/mcp-server`, base `main`). App `node_modules` is a **symlink** to main's.
- **Do NOT run `next build` / `next dev` in the worktree** — Turbopack rejects symlinked `node_modules` (gotchas). Verify app-side changes only with:
  - `npx tsc --noEmit`
  - `npx eslint <path>`
  - `npm test` (Vitest — baseline is 106 passing)
- **`prisma migrate` needs a DB** and there is no `.env` here. Do the actual migration **post-merge on `main`** (see final task). In the worktree, after editing `schema.prisma`, run **`npx prisma generate`** (schema-only, no DB) so `tsc` sees the new `ApiToken` type. This writes into the shared (symlinked) client; that is acceptable because the change is purely additive.
- **The `mcp/` package is standalone** with its **own** `mcp/node_modules` (a real install, not the app symlink) and its **own** Vitest. Installing there in the worktree is fine.
- Optional-value validators use `.nullish()` (gotchas). Follow `DESIGN.md` for any UI.

## File structure

**App (create):**
- `src/lib/api-token.ts` — token generation/hashing + bearer parsing (pure) and DB authentication helper.
- `src/lib/api-token.test.ts` — unit tests for the pure parts.
- `src/lib/text-to-doc.ts` — markdown-subset → Tiptap doc JSON (pure).
- `src/lib/text-to-doc.test.ts` — unit tests.
- `src/lib/issue-key.ts` — parse `TEAM-123` (pure) + `resolveTaskByKeyOrId`, `resolveTeamRef`, `resolveUserByEmailOrId` (DB) helpers.
- `src/lib/issue-key.test.ts` — unit tests for the pure parse function.
- `src/server/api/mcp-auth.ts` — `withMcpAuth()` wrapper + JSON response helpers for route handlers.
- `src/app/api/mcp/v1/tasks/route.ts` — `POST` (create) + `GET` (search/list).
- `src/app/api/mcp/v1/tasks/[idOrKey]/route.ts` — `GET` (single) + `PATCH` (update).
- `src/app/api/mcp/v1/wiki/route.ts` — `POST` (create) + `GET` (search).
- `src/app/api/mcp/v1/wiki/[id]/route.ts` — `GET` (single) + `PATCH` (update).
- `src/app/api/mcp/v1/teams/route.ts` — `GET`.
- `src/app/api/mcp/v1/members/route.ts` — `GET`.
- `src/app/api/mcp/v1/epics/route.ts` — `GET`.
- `src/server/actions/api-tokens.ts` — `createApiToken`, `revokeApiToken` server actions.
- `src/app/(app)/settings/tokens/page.tsx` — token management page (server component).
- `src/components/settings/token-manager.tsx` — client UI (create/copy/revoke).

**App (modify):**
- `prisma/schema.prisma` — add `ApiToken` model + `User.apiTokens` relation.
- `src/server/actions/tasks.ts` — extract `createTaskCore`, `updateTaskFieldsCore`.
- `src/server/actions/wiki.ts` — extract `createWikiPageCore`, `updateWikiContentCore`.
- `src/server/queries.ts` — add `getTeamOptionsMini`/`getEpicOptions` if needed for `/epics` (see Task 9).
- `src/components/app-shell/sidebar-nav.tsx` — add a "설정" / 토큰 nav entry.
- `docs/README.md`, `docs/work-log.md` — index + changelog.

**MCP package (create) under `mcp/`:**
- `mcp/package.json`, `mcp/tsconfig.json`, `mcp/.gitignore`, `mcp/vitest.config.ts`
- `mcp/src/config.ts` — env parsing (`SPRINT_API_URL`, `SPRINT_API_TOKEN`).
- `mcp/src/client.ts` — fetch wrapper + error mapping (pure-ish).
- `mcp/src/client.test.ts` — error mapping tests.
- `mcp/src/format.ts` — deep-link + summary formatting (pure) + tests `mcp/src/format.test.ts`.
- `mcp/src/tools/tickets.ts`, `mcp/src/tools/wiki.ts`, `mcp/src/tools/lookups.ts`
- `mcp/src/index.ts` — `McpServer` + stdio wiring.

**Repo root (create):**
- `.mcp.json` — project-scoped MCP config for Claude Code.
- `mcp/README.md` — teammate setup (Claude Code / Desktop / Cursor) + token instructions.

---

## Task 1: `ApiToken` schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model + relation**

In `prisma/schema.prisma`, add to the `User` model's relation list (near the other `[]` relations):

```prisma
  apiTokens ApiToken[]
```

Then add the model (place it near `Session`/`Account`):

```prisma
model ApiToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String
  tokenHash  String    @unique
  prefix     String
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
  revokedAt  DateTime?

  @@index([userId])
}
```

- [ ] **Step 2: Regenerate the client (schema-only, no DB)**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no DB connection needed.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no references to `ApiToken` yet, but the client type now exists).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add ApiToken model for MCP personal tokens"
```

---

## Task 2: token helper (`src/lib/api-token.ts`) — TDD

**Files:**
- Create: `src/lib/api-token.ts`
- Test: `src/lib/api-token.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/api-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TOKEN_PREFIX,
  hashToken,
  parseBearer,
  buildToken,
} from "./api-token";

describe("api-token", () => {
  it("hashToken is deterministic sha-256 hex (64 chars)", () => {
    const a = hashToken("sprint_pat_abc");
    const b = hashToken("sprint_pat_abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("other")).not.toBe(a);
  });

  it("buildToken returns a prefixed raw token, its hash, and a display prefix", () => {
    const t = buildToken(() => new Uint8Array(24).fill(1));
    expect(t.raw.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.hash).toBe(hashToken(t.raw));
    expect(t.prefix.length).toBeGreaterThanOrEqual(12);
    expect(t.raw.startsWith(t.prefix)).toBe(true);
  });

  it("parseBearer extracts the token from an Authorization header", () => {
    expect(parseBearer("Bearer sprint_pat_xyz")).toBe("sprint_pat_xyz");
    expect(parseBearer("bearer sprint_pat_xyz")).toBe("sprint_pat_xyz");
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Bearer   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/api-token.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/api-token.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/authz";

export const TOKEN_PREFIX = "sprint_pat_";

/** sha-256 hex of the raw token. Only the hash is stored. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** "Bearer <token>" -> token, else null. */
export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  return token ? token : null;
}

/** Create a new raw token + its hash + a display prefix. randomFn is injectable for tests. */
export function buildToken(
  randomFn: (n: number) => Uint8Array = (n) => randomBytes(n),
): { raw: string; hash: string; prefix: string } {
  const body = Buffer.from(randomFn(24)).toString("base64url");
  const raw = `${TOKEN_PREFIX}${body}`;
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, TOKEN_PREFIX.length + 4) };
}

/**
 * Authenticate an incoming request by bearer token.
 * Returns the acting user as an Actor, or null if the token is missing/invalid/revoked.
 * Updates lastUsedAt (best-effort, throttled to once/minute).
 */
export async function authenticateBearer(
  authorization: string | null,
): Promise<Actor | null> {
  const raw = parseBearer(authorization);
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const token = await prisma.apiToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { id: true, lastUsedAt: true, user: { select: { id: true, role: true } } },
  });
  if (!token) return null;

  const now = Date.now();
  const last = token.lastUsedAt?.getTime() ?? 0;
  if (now - last > 60_000) {
    await prisma.apiToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return { id: token.user.id, role: token.user.role };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/api-token.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/lib/api-token.ts src/lib/api-token.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-token.ts src/lib/api-token.test.ts
git commit -m "feat(auth): API personal-token hashing, parsing, and bearer authentication"
```

---

## Task 3: extract task mutation cores

**Files:**
- Modify: `src/server/actions/tasks.ts`

Goal: split `createTask` and `updateTaskFields` so the DB logic takes an explicit `actor`, keeping the exported server-action signatures identical (UI unaffected). No new tests — correctness is guaranteed by the existing 106 tests staying green plus `tsc`.

- [ ] **Step 1: Add the `Actor` import**

At the top of `src/server/actions/tasks.ts`, alongside the existing `import { assertCanManage } from "@/lib/authz";`, change it to also import the type:

```ts
import { assertCanManage, type Actor } from "@/lib/authz";
```

- [ ] **Step 2: Refactor `createTask` to delegate to `createTaskCore`**

Replace the current `createTask` function body (lines starting `export async function createTask(input: unknown) {`) with:

```ts
export async function createTask(input: unknown) {
  const user = await requireUser();
  return createTaskCore(user, input);
}

/** Actor-injectable core of createTask. Called by the server action and the MCP API route. */
export async function createTaskCore(actor: Actor, input: unknown) {
  const data = taskSchema.parse(input);

  const task = await prisma.$transaction(async (tx) => {
    let teamId = data.teamId;
    if (data.epicId) {
      const epic = await tx.epic.findUnique({
        where: { id: data.epicId },
        select: { teamId: true },
      });
      if (epic) teamId = epic.teamId;
    }
    const number = await nextTeamNumber(tx, teamId);
    const status = data.status ?? "TODO";
    const agg = await tx.task.aggregate({
      where: { status },
      _max: { boardOrder: true },
    });
    const boardOrder = (agg._max.boardOrder ?? 0) + 1;
    return tx.task.create({
      data: { ...data, teamId, number, reporterId: actor.id, boardOrder },
    });
  });

  await logActivity({
    userId: actor.id,
    entityType: "task",
    entityId: task.id,
    action: "created",
    meta: { title: task.title },
  });

  revalidatePath("/board");
  revalidatePath("/tasks");
  if (task.epicId) revalidatePath(`/epics/${task.epicId}`);
  return { id: task.id };
}
```

- [ ] **Step 3: Refactor `updateTaskFields` to delegate to `updateTaskFieldsCore`**

Replace the current `updateTaskFields` function with:

```ts
export async function updateTaskFields(id: string, input: unknown) {
  const user = await requireUser();
  return updateTaskFieldsCore(user, id, input);
}

/** Actor-injectable core of updateTaskFields. */
export async function updateTaskFieldsCore(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const patch = taskSchema.partial().parse(input) as Record<string, unknown>;
  delete patch.teamId;

  const current = await prisma.task.findUnique({
    where: { id },
    select: TASK_EDITABLE,
  });
  if (!current) throw new Error("태스크를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const task = await prisma.task.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: actor.id,
        entityType: "task",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  const descChange = changes.find((c) => c.field === "description");
  if (descChange) {
    await notifyNewMentions({
      actorId: actor.id,
      entityType: "task",
      entityId: id,
      context: task.title,
      before: current.description,
      after: task.description,
    });
  }

  revalidateTaskPaths(id, task.epicId);
  if (current.epicId && current.epicId !== task.epicId) {
    revalidatePath(`/epics/${current.epicId}`);
  }
  return { id };
}
```

- [ ] **Step 4: Verify nothing broke**

Run: `npm test && npx tsc --noEmit && npx eslint src/server/actions/tasks.ts`
Expected: 106 tests still PASS; tsc/eslint clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/tasks.ts
git commit -m "refactor(tasks): extract actor-injectable createTaskCore/updateTaskFieldsCore"
```

---

## Task 4: extract wiki mutation cores

**Files:**
- Modify: `src/server/actions/wiki.ts`

- [ ] **Step 1: Import `Actor`**

Change `import { assertCanManage } from "@/lib/authz";` to:

```ts
import { assertCanManage, type Actor } from "@/lib/authz";
```

- [ ] **Step 2: Refactor `createWikiPage`**

```ts
export async function createWikiPage(input: unknown) {
  const user = await requireUser();
  return createWikiPageCore(user, input);
}

/** Actor-injectable core of createWikiPage. */
export async function createWikiPageCore(actor: Actor, input: unknown) {
  const data = wikiPageSchema.parse(input);

  const siblingCount = await prisma.wikiPage.count({
    where: { parentId: data.parentId, folderId: data.folderId },
  });

  const page = await prisma.wikiPage.create({
    data: {
      title: data.title,
      parentId: data.parentId,
      folderId: data.folderId,
      content: EMPTY_DOC,
      searchText: "",
      position: siblingCount,
      authorId: actor.id,
      editorId: actor.id,
    },
  });

  await logActivity({
    userId: actor.id,
    entityType: "wiki",
    entityId: page.id,
    action: "created",
    meta: { title: page.title },
  });

  revalidatePath("/wiki", "layout");
  return { id: page.id };
}
```

- [ ] **Step 3: Refactor `updateWikiContent`**

```ts
export async function updateWikiContent(
  id: string,
  title: string,
  content: unknown,
) {
  const user = await requireUser();
  return updateWikiContentCore(user, id, title, content);
}

/** Actor-injectable core of updateWikiContent. */
export async function updateWikiContentCore(
  actor: Actor,
  id: string,
  title: string,
  content: unknown,
) {
  const current = await prisma.wikiPage.findUnique({ where: { id } });
  if (!current) throw new Error("페이지를 찾을 수 없습니다");

  const nextTitle = title.trim() || "제목 없음";

  const unchanged =
    current.title === nextTitle &&
    JSON.stringify(current.content) === JSON.stringify(content);
  if (unchanged) {
    return { id };
  }

  await prisma.wikiRevision.create({
    data: {
      pageId: id,
      title: current.title,
      content: current.content as Prisma.InputJsonValue,
      editorId: current.editorId,
    },
  });

  await prisma.wikiPage.update({
    where: { id },
    data: {
      title: nextTitle,
      content: content as Prisma.InputJsonValue,
      searchText: docToPlainText(content as JSONContent),
      editorId: actor.id,
    },
  });

  await logActivity({
    userId: actor.id,
    entityType: "wiki",
    entityId: id,
    action: "updated",
  });

  const before = extractMentionUserIds(current.content);
  const after = extractMentionUserIds(content);
  const added = [...after].filter((uid) => !before.has(uid) && uid !== actor.id);
  if (added.length > 0) {
    await prisma.notification.createMany({
      data: added.map((uid) => ({
        userId: uid,
        actorId: actor.id,
        type: "mention",
        entityType: "wiki",
        entityId: id,
        context: nextTitle,
      })),
    });
  }

  await prisma.wikiDraft
    .delete({ where: { pageId_userId: { pageId: id, userId: actor.id } } })
    .catch(() => {});

  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${id}`);
  return { id };
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npx eslint src/server/actions/wiki.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/wiki.ts
git commit -m "refactor(wiki): extract actor-injectable createWikiPageCore/updateWikiContentCore"
```

---

## Task 5: markdown-subset → Tiptap doc (`src/lib/text-to-doc.ts`) — TDD

**Files:**
- Create: `src/lib/text-to-doc.ts`
- Test: `src/lib/text-to-doc.test.ts`

Scope (v1): blank-line-separated blocks. A block is a heading (`#`..`######`), a fenced code block (```` ``` ````), a bullet list (lines starting `- ` or `* `), an ordered list (`1. `), or a paragraph. Inline: `**bold**`, `*italic*`/`_italic_`, `` `code` ``, `[text](url)`. Anything fancier passes through as plain text. This mirrors `docToPlainText` in reverse well enough for LLM-authored wiki bodies.

- [ ] **Step 1: Write the failing test**

`src/lib/text-to-doc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { markdownToDoc } from "./text-to-doc";

describe("markdownToDoc", () => {
  it("wraps a plain paragraph", () => {
    expect(markdownToDoc("hello world")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello world" }] },
      ],
    });
  });

  it("parses headings by leading hashes", () => {
    const doc = markdownToDoc("# Title\n\nbody");
    expect(doc.content[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Title" }],
    });
    expect(doc.content[1].type).toBe("paragraph");
  });

  it("parses a bullet list block", () => {
    const doc = markdownToDoc("- a\n- b");
    expect(doc.content[0].type).toBe("bulletList");
    expect(doc.content[0].content).toHaveLength(2);
    expect(doc.content[0].content[0]).toEqual({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
      ],
    });
  });

  it("parses a fenced code block preserving text and language", () => {
    const doc = markdownToDoc("```ts\nconst a = 1\n```");
    expect(doc.content[0]).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1" }],
    });
  });

  it("parses bold, italic, code, and links inline", () => {
    const doc = markdownToDoc("a **b** _c_ `d` [e](https://x.io)");
    const marks = doc.content[0].content;
    expect(marks).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "c", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "d", marks: [{ type: "code" }] },
      { type: "text", text: " " },
      {
        type: "text",
        text: "e",
        marks: [{ type: "link", attrs: { href: "https://x.io" } }],
      },
    ]);
  });

  it("returns an empty paragraph for empty input", () => {
    expect(markdownToDoc("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/text-to-doc.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/text-to-doc.ts`:

```ts
import type { JSONContent } from "@tiptap/core";

type Node = JSONContent;

/** Parse inline markdown (bold/italic/code/link) into an array of Tiptap text nodes. */
export function inlineToNodes(text: string): Node[] {
  if (!text) return [];
  // Ordered so code wins over emphasis; links last.
  const pattern =
    /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  const nodes: Node[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push({ type: "text", text: text.slice(last, m.index) });
    if (m[2] !== undefined) {
      nodes.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    } else if (m[4] !== undefined) {
      nodes.push({ type: "text", text: m[4], marks: [{ type: "code" }] });
    } else if (m[6] !== undefined) {
      nodes.push({ type: "text", text: m[6], marks: [{ type: "italic" }] });
    } else if (m[8] !== undefined) {
      nodes.push({ type: "text", text: m[8], marks: [{ type: "italic" }] });
    } else if (m[10] !== undefined && m[11] !== undefined) {
      nodes.push({
        type: "text",
        text: m[10],
        marks: [{ type: "link", attrs: { href: m[11] } }],
      });
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}

function paragraph(text: string): Node {
  const content = inlineToNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function listItems(lines: string[], stripLen: RegExp): Node[] {
  return lines.map((l) => ({
    type: "listItem",
    content: [paragraph(l.replace(stripLen, ""))],
  }));
}

/** Convert a markdown subset to a Tiptap doc JSON. Safe for LLM-authored wiki bodies. */
export function markdownToDoc(md: string): Node {
  const src = (md ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return { type: "doc", content: [{ type: "paragraph" }] };

  const content: Node[] = [];
  const lines = src.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1] ?? null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: buf.join("\n") }],
      });
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineToNodes(heading[2].trim()),
      });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      content.push({ type: "bulletList", content: listItems(buf, /^[-*]\s+/) });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      content.push({ type: "orderedList", content: listItems(buf, /^\d+\.\s+/) });
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    content.push(paragraph(buf.join(" ")));
  }

  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/text-to-doc.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/lib/text-to-doc.ts src/lib/text-to-doc.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/text-to-doc.ts src/lib/text-to-doc.test.ts
git commit -m "feat(wiki): markdown-subset to Tiptap doc converter for MCP wiki bodies"
```

---

## Task 6: issue-key parsing + reference resolution (`src/lib/issue-key.ts`) — TDD (pure part)

**Files:**
- Create: `src/lib/issue-key.ts`
- Test: `src/lib/issue-key.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/issue-key.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseIssueKey } from "./issue-key";

describe("parseIssueKey", () => {
  it("splits TEAM-123 into key and number", () => {
    expect(parseIssueKey("NEKI-42")).toEqual({ teamKey: "NEKI", number: 42 });
    expect(parseIssueKey("design-7")).toEqual({ teamKey: "DESIGN", number: 7 });
  });

  it("returns null for non-key strings (cuids, plain numbers, garbage)", () => {
    expect(parseIssueKey("cl# not a key")).toBeNull();
    expect(parseIssueKey("123")).toBeNull();
    expect(parseIssueKey("ckhx3n0000")).toBeNull();
    expect(parseIssueKey("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/issue-key.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/issue-key.ts`:

```ts
import { prisma } from "@/lib/prisma";

/** Parse "TEAM-123" (case-insensitive key) into its parts, or null if not a key. */
export function parseIssueKey(
  s: string,
): { teamKey: string; number: number } | null {
  const m = s.trim().match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (!m) return null;
  return { teamKey: m[1].toUpperCase(), number: Number(m[2]) };
}

/** Resolve a task id given either a cuid or a "TEAM-123" key. Returns the id or null. */
export async function resolveTaskId(idOrKey: string): Promise<string | null> {
  const key = parseIssueKey(idOrKey);
  if (key) {
    const task = await prisma.task.findFirst({
      where: {
        number: key.number,
        team: { key: { equals: key.teamKey, mode: "insensitive" } },
      },
      select: { id: true },
    });
    return task?.id ?? null;
  }
  const byId = await prisma.task.findUnique({
    where: { id: idOrKey },
    select: { id: true },
  });
  return byId?.id ?? null;
}

/** Resolve a team id from a team id or a team key (e.g. "NEKI"). Returns id or null. */
export async function resolveTeamId(idOrKey: string): Promise<string | null> {
  const team = await prisma.team.findFirst({
    where: {
      OR: [{ id: idOrKey }, { key: { equals: idOrKey.toUpperCase(), mode: "insensitive" } }],
    },
    select: { id: true },
  });
  return team?.id ?? null;
}

/** Resolve a user id from a user id or an email. Returns id or null. */
export async function resolveUserId(idOrEmail: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: idOrEmail }, { email: idOrEmail.toLowerCase() }] },
    select: { id: true },
  });
  return user?.id ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/issue-key.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/lib/issue-key.ts src/lib/issue-key.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/issue-key.ts src/lib/issue-key.test.ts
git commit -m "feat(api): issue-key parsing and team/user/task reference resolution"
```

---

## Task 7: MCP auth wrapper + response helpers (`src/server/api/mcp-auth.ts`)

**Files:**
- Create: `src/server/api/mcp-auth.ts`

No unit test (thin glue over `authenticateBearer` + `NextResponse`); verified by route usage + `tsc`.

- [ ] **Step 1: Implement**

`src/server/api/mcp-auth.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Actor } from "@/lib/authz";
import { authenticateBearer } from "@/lib/api-token";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: string, status = 400, extra?: unknown) {
  return NextResponse.json({ ok: false, error, ...(extra ? { issues: extra } : {}) }, { status });
}

type Handler = (actor: Actor, req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Wrap a route handler with bearer-token auth + uniform error handling. */
export function withMcpAuth(handler: Handler): Handler {
  return async (_actor, req, ctx) => {
    const actor = await authenticateBearer(req.headers.get("authorization"));
    if (!actor) return fail("unauthorized", 401);
    try {
      return await handler(actor, req, ctx);
    } catch (e) {
      if (e instanceof ZodError) {
        return fail("validation_error", 400, e.flatten());
      }
      const message = e instanceof Error ? e.message : "internal_error";
      return fail(message, 400);
    }
  };
}
```

Note: Next.js passes route handlers `(req, ctx)`; the wrapper's outer signature adapts — the route file (Task 8) calls `withMcpAuth(...)` and exports `(req, ctx) => wrapped(undefined as never, req, ctx)`. To keep it simple, the wrapper actually returns a Next-compatible function:

Replace the `withMcpAuth` return type usage — final form:

```ts
type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type AuthedHandler = (actor: Actor, req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function withMcpAuth(handler: AuthedHandler): RouteHandler {
  return async (req, ctx) => {
    const actor = await authenticateBearer(req.headers.get("authorization"));
    if (!actor) return fail("unauthorized", 401);
    try {
      return await handler(actor, req, ctx);
    } catch (e) {
      if (e instanceof ZodError) return fail("validation_error", 400, e.flatten());
      const message = e instanceof Error ? e.message : "internal_error";
      return fail(message, 400);
    }
  };
}
```

Use this final form (delete the first `Handler`/`withMcpAuth` draft above it — only one definition).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit && npx eslint src/server/api/mcp-auth.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/mcp-auth.ts
git commit -m "feat(api): withMcpAuth wrapper and JSON response helpers"
```

---

## Task 8: task API routes

**Files:**
- Create: `src/app/api/mcp/v1/tasks/route.ts`
- Create: `src/app/api/mcp/v1/tasks/[idOrKey]/route.ts`

- [ ] **Step 1: Implement the collection route (create + search)**

`src/app/api/mcp/v1/tasks/route.ts`:

```ts
import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { createTaskCore } from "@/server/actions/tasks";
import { searchTasks } from "@/server/queries";
import { resolveTeamId, resolveUserId } from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

const createInput = z.object({
  title: z.string().trim().min(1),
  team: z.string().trim().min(1), // team id or key
  description: z.string().nullish(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]).nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullish(),
  assignee: z.string().trim().nullish(), // user id or email
  epicId: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  dueDate: z.string().trim().nullish(),
  estimatedMd: z.number().nullish(),
});

export const POST = withMcpAuth(async (actor, req) => {
  const body = createInput.parse(await req.json());

  const teamId = await resolveTeamId(body.team);
  if (!teamId) return fail(`unknown team: ${body.team}`, 422);

  let assigneeId: string | null = null;
  if (body.assignee) {
    assigneeId = await resolveUserId(body.assignee);
    if (!assigneeId) return fail(`unknown assignee: ${body.assignee}`, 422);
  }

  const created = await createTaskCore(actor, {
    title: body.title,
    teamId,
    description: body.description ?? null,
    status: body.status ?? undefined,
    priority: body.priority ?? undefined,
    assigneeId,
    epicId: body.epicId ?? null,
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    estimatedMd: body.estimatedMd ?? null,
  });

  return ok({ id: created.id }, 201);
});

export const GET = withMcpAuth(async (_actor, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  const rows = await searchTasks(query, limit);
  return ok(
    rows.map((t) => ({
      id: t.id,
      key: formatIssueKey(t.team?.key, t.number),
      title: t.title,
      status: t.status,
    })),
  );
});
```

- [ ] **Step 2: Implement the item route (get + update)**

`src/app/api/mcp/v1/tasks/[idOrKey]/route.ts`:

```ts
import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { updateTaskFieldsCore } from "@/server/actions/tasks";
import { getTask } from "@/server/queries";
import { resolveTaskId, resolveUserId } from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  title: z.string().trim().min(1).nullish(),
  description: z.string().nullish(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]).nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullish(),
  assignee: z.string().trim().nullish(),
  epicId: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  dueDate: z.string().trim().nullish(),
  estimatedMd: z.number().nullish(),
});

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveTaskId(idOrKey);
  if (!id) return fail(`task not found: ${idOrKey}`, 404);
  const task = await getTask(id);
  if (!task) return fail(`task not found: ${idOrKey}`, 404);
  return ok({
    id: task.id,
    key: formatIssueKey(task.team?.key, task.number),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name } : null,
    epic: task.epic ? { id: task.epic.id, title: task.epic.title } : null,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedMd: task.estimatedMd,
  });
});

export const PATCH = withMcpAuth(async (actor, req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveTaskId(idOrKey);
  if (!id) return fail(`task not found: ${idOrKey}`, 404);

  const body = patchInput.parse(await req.json());
  const patch: Record<string, unknown> = {};
  if (body.title != null) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.status != null) patch.status = body.status;
  if (body.priority != null) patch.priority = body.priority;
  if (body.epicId !== undefined) patch.epicId = body.epicId;
  if (body.startDate !== undefined) patch.startDate = body.startDate;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate;
  if (body.estimatedMd !== undefined) patch.estimatedMd = body.estimatedMd;
  if (body.assignee !== undefined) {
    if (body.assignee === null) {
      patch.assigneeId = null;
    } else {
      const uid = await resolveUserId(body.assignee);
      if (!uid) return fail(`unknown assignee: ${body.assignee}`, 422);
      patch.assigneeId = uid;
    }
  }

  await updateTaskFieldsCore(actor, id, patch);
  return ok({ id });
});
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/mcp/v1/tasks/**/*.ts"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/mcp/v1/tasks
git commit -m "feat(api): MCP task routes (create, search, get, update)"
```

---

## Task 9: wiki + lookup API routes

**Files:**
- Create: `src/app/api/mcp/v1/wiki/route.ts`
- Create: `src/app/api/mcp/v1/wiki/[id]/route.ts`
- Create: `src/app/api/mcp/v1/teams/route.ts`
- Create: `src/app/api/mcp/v1/members/route.ts`
- Create: `src/app/api/mcp/v1/epics/route.ts`
- Modify: `src/server/queries.ts` (add `getEpicOptions`)

- [ ] **Step 1: Add `getEpicOptions` to `src/server/queries.ts`**

Add near `getTeamOptions`:

```ts
/** 경량 에픽 옵션(id·key·title) — MCP id 해석용. */
export const getEpicOptions = () =>
  prisma.epic.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      number: true,
      title: true,
      team: { select: { key: true } },
    },
  });
```

- [ ] **Step 2: wiki collection route (create + search)**

`src/app/api/mcp/v1/wiki/route.ts`:

```ts
import { z } from "zod";
import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { createWikiPageCore, updateWikiContentCore } from "@/server/actions/wiki";
import { searchWikiPages } from "@/server/queries";
import { markdownToDoc } from "@/lib/text-to-doc";

export const dynamic = "force-dynamic";

const createInput = z.object({
  title: z.string().trim().min(1),
  body: z.string().nullish(), // markdown subset
  contentJson: z.unknown().nullish(), // raw Tiptap doc (advanced)
  parentId: z.string().trim().nullish(),
  folderId: z.string().trim().nullish(),
});

export const POST = withMcpAuth(async (actor, req) => {
  const input = createInput.parse(await req.json());
  const created = await createWikiPageCore(actor, {
    title: input.title,
    parentId: input.parentId ?? null,
    folderId: input.folderId ?? null,
  });

  if (input.contentJson != null || (input.body && input.body.trim())) {
    const content = input.contentJson ?? markdownToDoc(input.body ?? "");
    await updateWikiContentCore(actor, created.id, input.title, content);
  }

  return ok({ id: created.id }, 201);
});

export const GET = withMcpAuth(async (_actor, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  const rows = await searchWikiPages(query, limit);
  return ok(rows);
});
```

- [ ] **Step 3: wiki item route (get + update)**

`src/app/api/mcp/v1/wiki/[id]/route.ts`:

```ts
import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { updateWikiContentCore } from "@/server/actions/wiki";
import { getWikiPage } from "@/server/queries";
import { docToPlainText } from "@/lib/rich-content";
import { markdownToDoc } from "@/lib/text-to-doc";
import type { JSONContent } from "@tiptap/core";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  title: z.string().trim().min(1).nullish(),
  body: z.string().nullish(),
  contentJson: z.unknown().nullish(),
});

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { id } = await ctx.params;
  const page = await getWikiPage(id);
  if (!page) return fail(`wiki page not found: ${id}`, 404);
  return ok({
    id: page.id,
    title: page.title,
    text: docToPlainText(page.content as JSONContent),
    content: page.content,
    updatedAt: page.updatedAt,
  });
});

export const PATCH = withMcpAuth(async (actor, req, ctx) => {
  const { id } = await ctx.params;
  const input = patchInput.parse(await req.json());

  const page = await getWikiPage(id);
  if (!page) return fail(`wiki page not found: ${id}`, 404);

  const title = input.title ?? page.title;
  const hasNewContent = input.contentJson != null || input.body != null;
  const content = hasNewContent
    ? (input.contentJson ?? markdownToDoc(input.body ?? ""))
    : page.content;

  await updateWikiContentCore(actor, id, title, content);
  return ok({ id });
});
```

- [ ] **Step 4: lookup routes**

`src/app/api/mcp/v1/teams/route.ts`:

```ts
import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getTeamOptions } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const teams = await getTeamOptions();
  return ok(teams);
});
```

`src/app/api/mcp/v1/members/route.ts`:

```ts
import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getMembers } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const members = await getMembers();
  return ok(
    members.map((m) => ({ id: m.id, name: m.name, email: m.email, team: m.team?.key ?? null })),
  );
});
```

`src/app/api/mcp/v1/epics/route.ts`:

```ts
import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getEpicOptions } from "@/server/queries";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const epics = await getEpicOptions();
  return ok(
    epics.map((e) => ({ id: e.id, key: formatIssueKey(e.team?.key, e.number), title: e.title })),
  );
});
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/mcp/v1/**/*.ts" src/server/queries.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mcp/v1/wiki src/app/api/mcp/v1/teams src/app/api/mcp/v1/members src/app/api/mcp/v1/epics src/server/queries.ts
git commit -m "feat(api): MCP wiki routes and team/member/epic lookups"
```

---

## Task 10: token management UI (`/settings/tokens`)

**Files:**
- Create: `src/server/actions/api-tokens.ts`
- Create: `src/app/(app)/settings/tokens/page.tsx`
- Create: `src/components/settings/token-manager.tsx`
- Modify: `src/components/app-shell/sidebar-nav.tsx`

Follow `DESIGN.md` (near-white light, ink primary, `Card` spacing rules). Reuse existing shadcn primitives in `src/components/ui/`.

- [ ] **Step 1: Server actions**

`src/server/actions/api-tokens.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { buildToken } from "@/lib/api-token";

const nameSchema = z.string().trim().min(1, "이름을 입력하세요").max(60);

/** Create a token for the current user. Returns the raw token ONCE (never stored). */
export async function createApiToken(name: string) {
  const user = await requireUser();
  const parsed = nameSchema.parse(name);
  const { raw, hash, prefix } = buildToken();
  await prisma.apiToken.create({
    data: { userId: user.id, name: parsed, tokenHash: hash, prefix },
  });
  revalidatePath("/settings/tokens");
  return { raw };
}

/** Revoke one of the current user's tokens. */
export async function revokeApiToken(id: string) {
  const user = await requireUser();
  await prisma.apiToken.updateMany({
    where: { id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings/tokens");
}
```

- [ ] **Step 2: Page (server component)**

`src/app/(app)/settings/tokens/page.tsx`:

```tsx
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TokenManager } from "@/components/settings/token-manager";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const user = await requireUser();
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-lg font-semibold text-foreground">개인 API 토큰</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        MCP 연동에 사용할 개인 토큰입니다. 생성 시 한 번만 표시되니 안전하게 보관하세요.
      </p>
      <div className="mt-4">
        <TokenManager tokens={tokens} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Client UI**

`src/components/settings/token-manager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createApiToken, revokeApiToken } from "@/server/actions/api-tokens";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function TokenManager({ tokens }: { tokens: TokenRow[] }) {
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { raw } = await createApiToken(name.trim());
      setNewToken(raw);
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="토큰 이름 (예: MCP - 노트북)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
        <Button onClick={onCreate} disabled={busy || !name.trim()}>
          생성
        </Button>
      </div>

      {newToken && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-foreground">
              아래 토큰은 지금만 표시됩니다. 복사해 두세요.
            </p>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                {newToken}
              </code>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                  toast.success("복사됨");
                }}
              >
                복사
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-y p-0">
          {tokens.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">발급된 토큰이 없습니다.</p>
          ) : (
            tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.prefix}… · 마지막 사용 {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "없음"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await revokeApiToken(t.id);
                    toast.success("폐기됨");
                  }}
                >
                  폐기
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

Note: confirm `@/components/ui/input`, `button`, `card` exist (they do — shadcn). If `Input` has a different export path, match the existing import used elsewhere (grep `from "@/components/ui/input"`). The `CardContent` uses `p-0` + `divide-y` per the gotcha (no doubled padding).

- [ ] **Step 4: Add nav link**

In `src/components/app-shell/sidebar-nav.tsx`, locate the array of nav items (objects with `href`/`label`/`icon`) and add an entry mirroring an existing one, e.g. after the last item:

```tsx
{ href: "/settings/tokens", label: "API 토큰", icon: KeyRound },
```

Add `KeyRound` to the existing `lucide-react` import at the top of that file.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/server/actions/api-tokens.ts "src/app/(app)/settings/**/*.tsx" src/components/settings/token-manager.tsx src/components/app-shell/sidebar-nav.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/api-tokens.ts "src/app/(app)/settings" src/components/settings src/components/app-shell/sidebar-nav.tsx
git commit -m "feat(settings): personal API token management page and nav entry"
```

---

## Task 11: MCP package scaffold

**Files:**
- Create: `mcp/package.json`, `mcp/tsconfig.json`, `mcp/.gitignore`, `mcp/vitest.config.ts`

- [ ] **Step 1: `mcp/package.json`**

```json
{
  "name": "@team-neki/sprint-mcp",
  "version": "0.1.0",
  "description": "MCP server for the Team Neki Sprint tracker (tickets + wiki)",
  "type": "module",
  "bin": { "sprint-mcp": "dist/index.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsc -p tsconfig.json --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: `mcp/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: `mcp/.gitignore`**

```
node_modules
dist
```

- [ ] **Step 4: `mcp/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 5: Install deps (standalone, physical — this is fine in the worktree)**

Run: `cd mcp && npm install && cd ..`
Expected: creates `mcp/node_modules`, `mcp/package-lock.json`.

- [ ] **Step 6: Commit**

```bash
git add mcp/package.json mcp/tsconfig.json mcp/.gitignore mcp/vitest.config.ts mcp/package-lock.json
git commit -m "chore(mcp): scaffold @team-neki/sprint-mcp package"
```

---

## Task 12: MCP config, HTTP client, formatting — TDD for the pure parts

**Files:**
- Create: `mcp/src/config.ts`
- Create: `mcp/src/client.ts`
- Create: `mcp/src/client.test.ts`
- Create: `mcp/src/format.ts`
- Create: `mcp/src/format.test.ts`

- [ ] **Step 1: `mcp/src/config.ts`**

```ts
export interface Config {
  apiUrl: string;
  token: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiUrl = env.SPRINT_API_URL?.replace(/\/+$/, "");
  const token = env.SPRINT_API_TOKEN;
  if (!apiUrl) throw new Error("SPRINT_API_URL is required");
  if (!token) throw new Error("SPRINT_API_TOKEN is required");
  return { apiUrl, token };
}
```

- [ ] **Step 2: format test (failing)**

`mcp/src/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deepLink, describeApiError } from "./format";

describe("format", () => {
  it("builds a deep link for a task", () => {
    expect(deepLink("https://sprint.example.com", "tasks", "abc")).toBe(
      "https://sprint.example.com/tasks/abc",
    );
  });

  it("describes a validation error with flattened issues", () => {
    const msg = describeApiError({
      ok: false,
      error: "validation_error",
      issues: { fieldErrors: { title: ["필수"] }, formErrors: [] },
    });
    expect(msg).toContain("validation_error");
    expect(msg).toContain("title");
  });

  it("falls back to the error string", () => {
    expect(describeApiError({ ok: false, error: "unauthorized" })).toContain("unauthorized");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd mcp && npm test -- src/format.test.ts; cd ..`
Expected: FAIL (module not found).

- [ ] **Step 4: `mcp/src/format.ts`**

```ts
export function deepLink(base: string, kind: "tasks" | "wiki", id: string): string {
  return `${base.replace(/\/+$/, "")}/${kind}/${id}`;
}

interface ApiError {
  ok: false;
  error: string;
  issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
}

export function describeApiError(body: ApiError): string {
  const parts = [body.error];
  const fe = body.issues?.fieldErrors;
  if (fe) {
    for (const [field, msgs] of Object.entries(fe)) {
      if (msgs?.length) parts.push(`${field}: ${msgs.join(", ")}`);
    }
  }
  if (body.issues?.formErrors?.length) parts.push(body.issues.formErrors.join(", "));
  return parts.join(" — ");
}
```

- [ ] **Step 5: Run to verify format passes**

Run: `cd mcp && npm test -- src/format.test.ts; cd ..`
Expected: PASS (3 tests).

- [ ] **Step 6: `mcp/src/client.ts`**

```ts
import type { Config } from "./config.js";
import { describeApiError } from "./format.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class SprintClient {
  constructor(private cfg: Config, private fetchImpl: typeof fetch = fetch) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.cfg.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.cfg.token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as
      | { ok: true; data: T }
      | { ok: false; error: string; issues?: unknown };
    if (!res.ok || json.ok === false) {
      const message =
        json && "ok" in json && json.ok === false
          ? describeApiError(json as never)
          : `HTTP ${res.status}`;
      throw new ApiError(res.status, message);
    }
    return json.data;
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body: unknown) {
    return this.request<T>("POST", path, body);
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>("PATCH", path, body);
  }
}
```

- [ ] **Step 7: `mcp/src/client.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { SprintClient, ApiError } from "./client";

const cfg = { apiUrl: "https://sprint.test", token: "sprint_pat_x" };

function fakeFetch(status: number, payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("SprintClient", () => {
  it("returns data on success", async () => {
    const c = new SprintClient(cfg, fakeFetch(200, { ok: true, data: { id: "1" } }));
    expect(await c.get("/x")).toEqual({ id: "1" });
  });

  it("throws ApiError with a described message on failure", async () => {
    const c = new SprintClient(
      cfg,
      fakeFetch(422, { ok: false, error: "unknown team: ZZZ" }),
    );
    await expect(c.post("/x", {})).rejects.toBeInstanceOf(ApiError);
    await expect(c.post("/x", {})).rejects.toThrow(/unknown team/);
  });
});
```

- [ ] **Step 8: Run all mcp tests + build**

Run: `cd mcp && npm test && npx tsc -p tsconfig.json --noEmit; cd ..`
Expected: PASS (format 3 + client 2).

- [ ] **Step 9: Commit**

```bash
git add mcp/src/config.ts mcp/src/client.ts mcp/src/client.test.ts mcp/src/format.ts mcp/src/format.test.ts
git commit -m "feat(mcp): config loader, HTTP client, and error formatting"
```

---

## Task 13: MCP tools + server entry

**Files:**
- Create: `mcp/src/tools/tickets.ts`
- Create: `mcp/src/tools/wiki.ts`
- Create: `mcp/src/tools/lookups.ts`
- Create: `mcp/src/index.ts`

- [ ] **Step 1: `mcp/src/tools/tickets.ts`**

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";
import type { Config } from "../config.js";
import { deepLink } from "../format.js";

const STATUS = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]);
const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export function registerTicketTools(server: McpServer, client: SprintClient, cfg: Config) {
  server.registerTool(
    "create_ticket",
    {
      description:
        "Create a ticket (task). 'team' accepts a team key like NEKI or a team id. 'assignee' accepts an email or user id.",
      inputSchema: {
        title: z.string().describe("Ticket title"),
        team: z.string().describe("Team key (e.g. NEKI) or team id"),
        description: z.string().optional(),
        status: STATUS.optional(),
        priority: PRIORITY.optional(),
        assignee: z.string().optional().describe("Assignee email or user id"),
        epicId: z.string().optional(),
        startDate: z.string().optional().describe("ISO date"),
        dueDate: z.string().optional().describe("ISO date"),
        estimatedMd: z.number().optional(),
      },
    },
    async (args) => {
      const data = await client.post<{ id: string }>("/api/mcp/v1/tasks", args);
      return {
        content: [
          {
            type: "text",
            text: `Created ticket ${data.id}\n${deepLink(cfg.apiUrl, "tasks", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_ticket",
    {
      description: "Update a ticket by id or issue key (e.g. NEKI-42). Only provided fields change.",
      inputSchema: {
        idOrKey: z.string(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        status: STATUS.optional(),
        priority: PRIORITY.optional(),
        assignee: z.string().nullable().optional(),
        epicId: z.string().nullable().optional(),
        startDate: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        estimatedMd: z.number().nullable().optional(),
      },
    },
    async ({ idOrKey, ...patch }) => {
      const data = await client.patch<{ id: string }>(
        `/api/mcp/v1/tasks/${encodeURIComponent(idOrKey)}`,
        patch,
      );
      return {
        content: [
          { type: "text", text: `Updated ${data.id}\n${deepLink(cfg.apiUrl, "tasks", data.id)}` },
        ],
      };
    },
  );

  server.registerTool(
    "get_ticket",
    {
      description: "Get a ticket by id or issue key (e.g. NEKI-42).",
      inputSchema: { idOrKey: z.string() },
    },
    async ({ idOrKey }) => {
      const data = await client.get(`/api/mcp/v1/tasks/${encodeURIComponent(idOrKey)}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "search_tickets",
    {
      description: "Search tickets by title/key. Returns id, key, title, status.",
      inputSchema: { query: z.string().optional(), limit: z.number().optional() },
    },
    async ({ query, limit }) => {
      const qs = new URLSearchParams();
      if (query) qs.set("query", query);
      if (limit) qs.set("limit", String(limit));
      const data = await client.get(`/api/mcp/v1/tasks?${qs.toString()}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
```

- [ ] **Step 2: `mcp/src/tools/wiki.ts`**

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";
import type { Config } from "../config.js";
import { deepLink } from "../format.js";

export function registerWikiTools(server: McpServer, client: SprintClient, cfg: Config) {
  server.registerTool(
    "create_wiki_page",
    {
      description:
        "Create a wiki page. 'body' is markdown (headings, lists, code, bold/italic/links). Optional parentId/folderId to nest.",
      inputSchema: {
        title: z.string(),
        body: z.string().optional(),
        parentId: z.string().optional(),
        folderId: z.string().optional(),
      },
    },
    async (args) => {
      const data = await client.post<{ id: string }>("/api/mcp/v1/wiki", args);
      return {
        content: [
          { type: "text", text: `Created wiki page ${data.id}\n${deepLink(cfg.apiUrl, "wiki", data.id)}` },
        ],
      };
    },
  );

  server.registerTool(
    "update_wiki_page",
    {
      description: "Update a wiki page's title and/or body (markdown). Body replaces the page content.",
      inputSchema: { id: z.string(), title: z.string().optional(), body: z.string().optional() },
    },
    async ({ id, ...patch }) => {
      const data = await client.patch<{ id: string }>(`/api/mcp/v1/wiki/${encodeURIComponent(id)}`, patch);
      return {
        content: [
          { type: "text", text: `Updated wiki page ${data.id}\n${deepLink(cfg.apiUrl, "wiki", data.id)}` },
        ],
      };
    },
  );

  server.registerTool(
    "get_wiki_page",
    { description: "Get a wiki page by id (returns plain text + Tiptap JSON).", inputSchema: { id: z.string() } },
    async ({ id }) => {
      const data = await client.get(`/api/mcp/v1/wiki/${encodeURIComponent(id)}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "search_wiki_pages",
    {
      description: "Search wiki pages by title.",
      inputSchema: { query: z.string(), limit: z.number().optional() },
    },
    async ({ query, limit }) => {
      const qs = new URLSearchParams({ query });
      if (limit) qs.set("limit", String(limit));
      const data = await client.get(`/api/mcp/v1/wiki?${qs.toString()}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
```

- [ ] **Step 3: `mcp/src/tools/lookups.ts`**

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";

export function registerLookupTools(server: McpServer, client: SprintClient) {
  const simple = (name: string, path: string, description: string) =>
    server.registerTool(name, { description, inputSchema: {} }, async () => {
      const data = await client.get(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });

  simple("list_teams", "/api/mcp/v1/teams", "List teams (id, key, name) to resolve a team for create_ticket.");
  simple("list_members", "/api/mcp/v1/members", "List members (id, name, email) to resolve an assignee.");
  simple("list_epics", "/api/mcp/v1/epics", "List epics (id, key, title) to resolve an epicId.");
}
```

- [ ] **Step 4: `mcp/src/index.ts`**

```ts
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { SprintClient } from "./client.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerWikiTools } from "./tools/wiki.js";
import { registerLookupTools } from "./tools/lookups.js";

async function main() {
  const cfg = loadConfig();
  const client = new SprintClient(cfg);
  const server = new McpServer({ name: "sprint-mcp", version: "0.1.0" });

  registerTicketTools(server, client, cfg);
  registerWikiTools(server, client, cfg);
  registerLookupTools(server, client);

  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error(`[sprint-mcp] fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
```

- [ ] **Step 5: Build (verifies SDK API + types)**

Run: `cd mcp && npm run build; cd ..`
Expected: compiles to `mcp/dist/` with no type errors.

If `registerTool`'s signature differs in the installed SDK version, adjust to the installed API: check `mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` for the `registerTool`/`tool` method shape and align (the `{ description, inputSchema }` + handler shape shown here matches SDK ≥1.10). Keep the tool names and behavior identical.

- [ ] **Step 6: Smoke the binary fails cleanly without env**

Run: `node mcp/dist/index.js`
Expected: exits non-zero printing `SPRINT_API_URL is required` (proves wiring + config guard).

- [ ] **Step 7: Commit**

```bash
git add mcp/src/tools mcp/src/index.ts
git commit -m "feat(mcp): ticket, wiki, and lookup tools with stdio server entry"
```

---

## Task 14: distribution config + docs

**Files:**
- Create: `.mcp.json` (repo root)
- Create: `mcp/README.md`
- Modify: `docs/README.md`, `docs/work-log.md`

- [ ] **Step 1: `.mcp.json`**

Replace `<DEPLOYED_URL>` with the real deployed app URL from `k8s/configmap.yaml` `AUTH_URL` during implementation.

```json
{
  "mcpServers": {
    "sprint": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": {
        "SPRINT_API_URL": "${SPRINT_API_URL:-<DEPLOYED_URL>}",
        "SPRINT_API_TOKEN": "${SPRINT_API_TOKEN}"
      }
    }
  }
}
```

- [ ] **Step 2: `mcp/README.md`**

Write setup instructions covering: (1) getting a token from `/settings/tokens`, (2) building `mcp/` (`npm install && npm run build`), (3) Claude Code via project `.mcp.json` (`export SPRINT_API_TOKEN=...` then restart, approve the project server), (4) Claude Desktop `claude_desktop_config.json` and Cursor `~/.cursor/mcp.json` snippets using `npx -y @team-neki/sprint-mcp` with `SPRINT_API_URL` + `SPRINT_API_TOKEN` env, (5) the tool list, (6) security notes (token shown once, revoke in settings). Use the exact JSON:

```jsonc
// Claude Desktop / Cursor
{
  "mcpServers": {
    "sprint": {
      "command": "npx",
      "args": ["-y", "@team-neki/sprint-mcp"],
      "env": {
        "SPRINT_API_URL": "https://<DEPLOYED_URL>",
        "SPRINT_API_TOKEN": "sprint_pat_..."
      }
    }
  }
}
```

- [ ] **Step 3: Update docs index + changelog**

Add to `docs/README.md` a line pointing to `mcp/README.md` and the spec/plan. Add a `docs/work-log.md` entry: date 2026-07-17, "MCP 서버 추가 (티켓/위키 도구, 개인 토큰 HTTP API)".

- [ ] **Step 4: Commit**

```bash
git add .mcp.json mcp/README.md docs/README.md docs/work-log.md
git commit -m "docs(mcp): project .mcp.json, README, and docs index/changelog"
```

---

## Task 15: worktree verification + post-merge checklist

- [ ] **Step 1: Full worktree verification**

Run:
```bash
npm test
npx tsc --noEmit
npx eslint "src/**/*.{ts,tsx}"
cd mcp && npm test && npm run build && cd ..
```
Expected: app tests (106 + new pure tests) PASS; tsc clean; eslint clean; mcp tests PASS; mcp builds.

- [ ] **Step 2: Confirm no binary/NUL files snuck in (gotchas §9)**

Run: `git diff --stat main...feat/mcp-server | grep -i "Bin " || echo "no binary files"`
Expected: "no binary files".

- [ ] **Step 3: Write the post-merge checklist into the PR description**

The following MUST run on `main` after merge (cannot run in the worktree):

```bash
# on main, after merging feat/mcp-server
npm install                                   # pick up nothing new app-side; safe
npx prisma migrate dev --name add_api_token   # create the ApiToken table (needs DATABASE_URL)
npx prisma generate
cd mcp && npm install && npm run build && cd ..
# restart next dev / redeploy so the new Prisma client + routes load (schema-change gotcha)
```

- [ ] **Step 4: Manual smoke (on main, against local dev)**

1. Start dev, sign in, open `/settings/tokens`, create a token, copy it.
2. `export SPRINT_API_URL=http://localhost:3000 SPRINT_API_TOKEN=<token>`
3. `node mcp/dist/index.js` should start (stdio; Ctrl-C to exit) without the env error.
4. In an MCP client (or via `curl`): `curl -s -H "authorization: Bearer $SPRINT_API_TOKEN" $SPRINT_API_URL/api/mcp/v1/teams` returns `{ "ok": true, "data": [...] }`.
5. `curl -s -X POST -H "authorization: Bearer $SPRINT_API_TOKEN" -H "content-type: application/json" -d '{"title":"MCP smoke","team":"<KEY>"}' $SPRINT_API_URL/api/mcp/v1/tasks` returns `{ "ok": true, "data": { "id": ... } }`; verify the ticket appears in the board with you as reporter and an activity-log "created" entry.
6. Create a wiki page with a markdown body; verify headings/lists render in the editor.

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch to open the PR (include the post-merge checklist from Step 3).

---

## Self-review notes

- **Spec coverage:** ApiToken (T1), token auth (T2), core refactors (T3/T4), text-to-doc (T5), id resolution (T6), auth wrapper (T7), task routes (T8), wiki+lookup routes (T9), settings UI (T10), mcp package (T11–13), distribution both ways + docs (T14), verification + post-merge migration (T15). All spec sections mapped.
- **Deletion excluded** from tools per decision — confirmed no delete route/tool.
- **Type consistency:** `Actor` from `@/lib/authz` used in T2/T3/T4/T7; `createTaskCore(actor, input)`, `updateTaskFieldsCore(actor, id, input)`, `createWikiPageCore(actor, input)`, `updateWikiContentCore(actor, id, title, content)` signatures consistent across route usage. `SprintClient.get/post/patch`, `deepLink`, `describeApiError` names consistent between definition (T12) and use (T13).
- **Worktree limits:** every verification step uses tsc/eslint/vitest (never `next build/dev`); migration deferred to post-merge (T15).
