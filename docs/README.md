# Sprint 프로젝트 문서

Sprint(Jira + Wiki 통합 워크스페이스) 프로젝트의 문서 인덱스. 새 문서를 추가하면 아래 표와 루트 `CLAUDE.md`의 라우팅도 함께 갱신한다.

| 문서 | 내용 | 언제 참고 |
|---|---|---|
| [`design-system.md`](./design-system.md) | 구현된 디자인 시스템 — 토큰 매핑, near-white 라이트 테마, elevation, 공용 컴포넌트(`ItemRow`) | UI·스타일·색 작업 시(루트 [`DESIGN.md`](../DESIGN.md) 토큰과 함께) |
| [`gotchas.md`](./gotchas.md) | 실제로 물렸던 함정 — Prisma/dev서버, worktree+Turbopack, zod nullish, Base UI Select, Card 여백 | 새 작업/디버깅 착수 전 훑기 |
| [`work-log.md`](./work-log.md) | 세션별 변경 이력(무엇을·왜) | 최근 무엇이 바뀌었는지 확인 |
| [`roadmap.md`](./roadmap.md) | Phase 1~4 백로그 스코핑·이력(전부 `DONE`) | 과거 결정·스코핑 맥락 참고 |
| [`roadmap-v2.md`](./roadmap-v2.md) | Phase 1~4 종료 후 신규 개선 백로그 8건(알려진 한계 + 코드 갭) | 다음 작업 착수·우선순위 합의 |

## 관련 정본

- 디자인 토큰 정본: 루트 [`DESIGN.md`](../DESIGN.md)
- 프레임워크 주의: 루트 [`AGENTS.md`](../AGENTS.md) — 이 Next.js는 breaking change가 있으니 코드 작성 전 `node_modules/next/dist/docs/` 확인
- 데이터 모델: [`prisma/schema.prisma`](../prisma/schema.prisma)
