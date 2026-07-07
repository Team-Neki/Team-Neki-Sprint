# Spec P3-S3 — 프로필 · 멘션 · 알림 (#5, #6, #7, #8)

- **브랜치**: `feat/social` · **규모**: L · **스키마**: additive(Notification, User.phone) · **순서**: **S2 병합 후**(editor.tsx 공유)

## 범위

### #5 타인 프로필 보기
- 사용자 프로필 조회: **id · 이름 · 팀 · 이메일 · 연락처**. `User`에 `phone String?`(연락처) 추가(additive).
- UI: 프로필 다이얼로그(또는 `/users/[id]` 라우트). 멤버 목록/멘션/담당자 아바타 클릭 시 열림.
- 팀은 개편의 `User.team`(key+name) 표시.

### #6 사람 멘션(@)
- Tiptap **mention 확장**: 에디터에서 `@` 입력 → **사용자 검색 드롭다운**(getMembers) → 인라인 멘션 칩 삽입. 칩 클릭 시 **#5 프로필** 열림.
- (S2의 `#`=티켓 suggestion과 공존. 같은 editor.tsx라 S2 병합 후 작업.)

### #7 멘션 시 앱 내부 알림
- 스키마(additive):
  ```prisma
  model Notification {
    id         String   @id @default(cuid())
    userId     String   // 수신자
    user       User     @relation("NotifRecipient", fields: [userId], references: [id], onDelete: Cascade)
    actorId    String?  // 멘션한 사람
    type       String   // "mention" | ...
    entityType String   // "wiki" | "task" | ...
    entityId   String
    context    String?  // 미리보기 텍스트
    read       Boolean  @default(false)
    createdAt  DateTime @default(now())
    @@index([userId, read, createdAt])
  }
  ```
- 위키 저장/코멘트 작성 시 본문에서 **새로 추가된 멘션**을 파싱해 수신자별 `Notification` 생성(중복/자기멘션 제외). 멘션 칩은 userId를 담으므로 doc JSON에서 추출.

### #8 알림 목록
- 사용자 메뉴/프로필에 **최근 알림 10개** 드롭다운(읽음 표시, 클릭 시 대상으로 이동) + **전체 목록** 라우트(`/notifications`)에서 detail 확인.
- 액션: `markNotificationRead`/`markAllRead`. 미읽음 badge 카운트.

## 코멘트 멘션(스트레치)
- 현재 코멘트는 plain textarea(`comment-form.tsx`). 우선순위는 위키 에디터 멘션. 코멘트 멘션은 시간 남으면 rich input로 확장, 아니면 다음 단계로 명시.

## 마이그레이션 (additive)
- `npx prisma migrate dev --name notifications_profile` (Notification 테이블 + User.phone). 기존 데이터 보존.

## 주의(AGENTS.md)
Tiptap mention/suggestion, server action, `revalidatePath` 작성 전 문서/버전 확인. near-white 토큰 준수.

## 영향 파일(예상)
`prisma/schema.prisma`, `prisma/seed.ts`, `src/server/queries.ts`(notifications, user profile), `src/server/actions/{notifications,wiki,tasks}.ts`(멘션→알림 생성), `src/components/wiki/editor.tsx`(@ mention), 프로필 다이얼로그/`users/[id]`, 알림 드롭다운(user-menu)/`/notifications`, `src/lib/validators.ts`.

## 검증
- `prisma generate` → `tsc --noEmit` clean → `eslint` 신규 0. (`next build`는 병합 후 main에서.)

## Finish
`feat/social`에 커밋. 메시지 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
