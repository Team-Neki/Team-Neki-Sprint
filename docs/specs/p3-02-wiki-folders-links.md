# Spec P3-S2 — 위키 폴더 + 티켓 링크 (#2, #3, #4)

- **브랜치**: `feat/wiki-chunk` · **규모**: L · **스키마**: additive(Folder) · **병렬**: S1과 독립(단, editor.tsx를 S3와 공유 → S3보다 먼저)

## 범위

### #2 위키 폴더 (별도 타입)
- 페이지 하위 페이지 중첩(`WikiPage.parentId`)은 **그대로 유지**. 이것과 **별개로** 문서를 그룹핑하는 **Folder** 타입 신설.
- 스키마(additive):
  ```prisma
  model WikiFolder {
    id        String   @id @default(cuid())
    name      String
    parentId  String?  // 폴더 중첩 허용
    parent    WikiFolder?  @relation("FolderTree", fields: [parentId], references: [id], onDelete: Cascade)
    children  WikiFolder[] @relation("FolderTree")
    position  Int      @default(0)
    pages     WikiPage[]
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```
  `WikiPage`에 `folderId String?` + `folder WikiFolder?`(onDelete: SetNull) 추가.
- UI: 위키 사이드바 트리(`page-tree.tsx`)에 폴더 노드(접기/펼치기) 표시 → 폴더 안에 페이지·하위폴더. 폴더 생성/이름변경/삭제. 페이지를 폴더에 넣기(생성 시 폴더 선택, 또는 이동). 폴더 삭제 시 페이지는 SetNull(보존) 경고.

### #3 티켓 ↔ 위키 상호 링크
- **`WikiPageTaskLink`(이미 존재)** 활용. UI만 추가:
  - 위키 페이지: "연결된 티켓" 섹션 — 티켓 key(`TEAM-n`)로 검색해 연결/해제.
  - 티켓 상세(`tasks/[id]`): "연결된 위키" 섹션 — 페이지 검색해 연결/해제.
  - 링크 액션(server): `linkTaskToPage`/`unlink…` in `actions/wiki.ts` 또는 신규.

### #4 에디터 내 티켓 링크(입력 인식 드롭다운)
- Tiptap **suggestion 확장**: 에디터에서 트리거(`#`)를 입력하면 **티켓 검색 드롭다운** → 선택 시 **인라인 티켓 칩**(예: `TEAM-42`) 삽입, 클릭 시 `/tasks/<id>`로 이동.
- 티켓 검색은 server action(키/제목 contains, `formatIssueKey` 기준)로 조회. (주의: 멘션 `@`=사람은 **S3 소관**이니 여기선 `#`=티켓만.)

## 티켓 key 표기
- 개편 후 표기는 `formatIssueKey(team.key, number)`(`src/lib/constants.ts`). 티켓 검색/표시는 이 헬퍼 사용.

## 마이그레이션 (additive — 리셋 아님)
- `npx prisma migrate dev --name wiki_folder` (Folder 테이블 + WikiPage.folderId 추가). **기존 데이터 보존**. worktree에서 실행해도 공유 DB에 additive라 무해. 시드에 폴더 1~2개 예시 추가(선택).

## 주의(AGENTS.md)
Tiptap 확장·Next server action·`revalidatePath` 작성 전 `node_modules/next/dist/docs/` 및 설치된 tiptap 버전 확인. 디자인은 DESIGN.md/near-white 토큰 준수.

## 영향 파일(예상)
`prisma/schema.prisma`, `prisma/seed.ts`, `src/server/queries.ts`(폴더/링크/티켓검색), `src/server/actions/wiki.ts`(폴더·링크 액션), `src/components/wiki/{page-tree,editor,new-page-button}.tsx` + 폴더/링크 UI 신규, `src/app/(app)/wiki/*`, `src/app/(app)/tasks/[id]/page.tsx`(연결된 위키), `src/lib/validators.ts`.

## 검증 (worktree)
- `npx prisma generate` (additive) → `npx tsc --noEmit` clean → `npx eslint src` 신규 0.
- (`next build`는 worktree Turbopack symlink 이슈로 실행 금지 — 병합 후 main에서 수행.)

## Finish
`feat/wiki-chunk`에 커밋. 메시지 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
