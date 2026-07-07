# Spec #8 — 위키 버그 수정

- **브랜치**: `feat/wiki-bugs`
- **규모**: M · **스키마 변경**: 없음

## 대상 결함 (근거: `server/actions/wiki.ts`, `components/wiki/editor.tsx` 리뷰)

1. **자동저장마다 리비전 폭증** (확정)
   - `updateWikiContent`가 저장마다 `WikiRevision` 생성. 에디터는 1.5s 디바운스 자동저장 → 편집 중 1.5초마다 리비전 1건.
   - **수정**: 저장 시 직전 상태와 비교해 **실제 변경이 있을 때만** 리비전 스냅샷. 최소 가드: `JSON.stringify(current.content) === JSON.stringify(newContent) && current.title === title` 이면 리비전 생성/업데이트 skip. (no-op 자동저장은 DB 쓰기 자체를 건너뛰어도 됨.)

2. **페이지 전환 시 에디터 remount** (확인 필요)
   - `WikiEditor`가 `initialTitle`/`initialContent`를 `useState` 초기값으로만 사용. `src/app/(app)/wiki/[id]/page.tsx`에서 `<WikiEditor key={page.id} ... />`로 remount되는지 확인하고, 아니면 `key` 추가. (이전 페이지 내용이 새 페이지에 저장되는 것 방지.)

3. **삭제 cascade 자식 소실 경고** (확정)
   - `WikiPage.parent` 관계가 `onDelete: Cascade` → 부모 삭제 시 자식 페이지·리비전 전부 삭제. 삭제 UI(`ConfirmDelete` 사용처, `components/wiki/*` 및 `page-tree.tsx`)에서 **자식 개수를 경고 문구로 노출**(예: "하위 N개 페이지도 함께 삭제됩니다").

4. **링크 입력 `window.prompt` 대체** (UX)
   - `editor.tsx`의 `setLink`가 `window.prompt` 사용. Base UI `Popover` + `Input` 인라인 입력으로 대체(블로킹 다이얼로그 제거).

5. **unsaved 이탈 가드** (경미)
   - dirty 상태에서 페이지 이탈 시 디바운스(1.5s) 전 편집 유실 가능. `beforeunload` 경고 추가(dirty일 때만).

## 추가 점검

- `src/components/wiki/page-tree.tsx`의 `position` 정렬·재정렬 정합성, `new-page-button.tsx` 동작. 명백한 버그 있으면 함께 수정, 아니면 발견 사항을 PR 설명/`work-log`에 기록.

## 변경 파일(예상)

- `src/server/actions/wiki.ts`, `src/components/wiki/editor.tsx`, `src/app/(app)/wiki/[id]/page.tsx`, (필요 시) `src/components/wiki/page-tree.tsx` / 삭제 트리거.

## 주의 (AGENTS.md)

이 Next.js는 breaking change가 있다. server action·revalidatePath 등 사용 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인할 것.

## 검증

- `npm run build` + `npm run lint`(신규 경고 없음).
- 자동저장 반복 시 리비전이 무한 증가하지 않음(동일 내용 저장은 리비전 미생성).
