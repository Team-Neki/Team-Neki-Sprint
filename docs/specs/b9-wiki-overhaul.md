# Spec B9 — 위키 대개편 (뷰/편집 · 버전 · 사이드바 · 즐겨찾기)

- **브랜치**: `feat/wiki-overhaul` · **규모**: XL · **스키마**: additive(WikiFavorite) · **한 스트림**(위키 상세·사이드바·에디터 광범위 공유)
- 관련 기존 모델: `WikiPage`(parent 중첩) · `WikiFolder`(그룹핑) · `WikiRevision`(저장 시 스냅샷) · `WikiPageTaskLink`.
- **B10(인라인 댓글)은 별도 후속** — 이 스펙에 포함 안 함.

## 1. 뷰 / 편집 모드 분리

- 위키 상세(`src/app/(app)/wiki/[id]/page.tsx`)는 **기본 뷰 모드**: Tiptap JSON을 **읽기전용 렌더**(editable=false, 툴바 없음).
- **우측 상단 '편집' 버튼** → 편집 모드(기존 에디터 마운트). 저장 시 기존처럼 `WikiRevision` 스냅샷(변경 있을 때만). last-write-wins(편집 중인 사람 무영향, 뒤 저장이 덮어씀 — 현행 유지).
- `editor.tsx`를 뷰/편집 겸용으로: `mode: "view" | "edit"` prop 또는 상위에서 read-only 렌더러와 에디터를 토글. 뷰 렌더는 별도 경량 컴포넌트(`WikiView`)로 분리 가능.

## 2. 버전 기록 (⋯ 메뉴)

- 상세 우측 상단 **⋯(점3개) 드롭다운**(`dropdown-menu`): 버전 기록 · 별표 · (삭제 등).
- **버전 기록**: `WikiRevision` 목록(작성자·시각) → 특정 버전 **내용 확인** + **복원**(그 내용을 현재로 되돌리는 것도 새 리비전). 신규 액션 `restoreWikiRevision(revisionId)`. 조회 `getWikiRevisions(pageId)`(경량: id/title/editor/createdAt) + `getWikiRevision(id)`(내용 포함).

## 3. 즐겨찾기(별표) — additive 스키마

```prisma
model WikiFavorite {
  userId    String
  pageId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  page      WikiPage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@id([userId, pageId])
}
```
(User·WikiPage 에 역참조 관계 추가.) 마이그레이션 `wiki_favorite`(additive).

- ⋯ 메뉴 **별표 토글** → 액션 `toggleWikiFavorite(pageId)`(현재 유저 기준 upsert/delete).
- **위키 우측에 즐겨찾기 패널**: 현재 유저가 별표한 페이지 목록(링크). 조회 `getWikiFavorites(userId)`. 위키 레이아웃(`wiki/layout.tsx`) 우측 사이드 또는 상세 우측.

## 4. 사이드바 재설계 (`components/wiki/page-tree.tsx` 등)

- **상단 '폴더/새 페이지' 버튼(및 우상단 폴더 버튼) 제거.**
- 트리 최상단에 **'콘텐츠' 섹션 헤더** + 헤더 우측 **`+` 버튼 → 드롭다운(폴더 추가 / 새 페이지 추가)**(루트에 생성).
- **각 페이지/폴더 행 우측 hover `+` 버튼 → 드롭다운(하위 폴더 추가 / 하위 새 페이지 추가)**(그 노드 아래 생성).
- **우클릭 컨텍스트 메뉴**(`context-menu` — Base UI/shadcn 있으면 사용, 없으면 dropdown 재사용)로 추가/이름변경/삭제/별표.
- 기존 `new-folder-button`·`new-page-button`은 이 드롭다운 항목으로 흡수/재작성(parentId/folderId 컨텍스트 받도록).

## 영향 파일(예상)
`prisma/schema.prisma`, `prisma/migrations/*`, `src/server/queries.ts`(favorites·revisions), `src/server/actions/wiki.ts`(toggleFavorite·restoreRevision + 생성 액션 parent 컨텍스트), `src/components/wiki/{page-tree,editor,new-folder-button,new-page-button}.tsx` + 신규 `wiki-view`·`wiki-toolbar-menu`·`favorites-panel`·`version-history`, `src/app/(app)/wiki/{layout,[id]/page}.tsx`, `src/lib/session`(현재 유저 id).

## 마이그레이션 (additive)
`npx prisma migrate dev --name wiki_favorite` + `generate`. 로컬 dev DB, additive(신규 조인 테이블) — 데이터 보존. AI 가드 걸리면 로컬·additive 근거로 consent env.

## 주의(AGENTS.md)
Next server action·`revalidatePath`·Tiptap(읽기전용 렌더는 `generateHTML` 또는 `EditorContent editable=false`) 사용 전 `node_modules/next/dist/docs/` 및 설치된 tiptap 버전 확인. near-white 토큰 준수.

## 검증(worktree)
`prisma generate` → `tsc --noEmit` clean → `eslint src` 신규 0. `next build`/`dev`는 병합 후 main.

## Finish
`feat/wiki-overhaul` 커밋. 메시지 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 보고: 파일·마이그레이션 결과·tsc/eslint·뷰/편집 토글 방식·컨텍스트메뉴 구현·미결.
