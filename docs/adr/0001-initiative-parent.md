# ADR 0001 — 이니셔티브 상위 항목 도입 여부

- **상태**: Superseded by [ADR 0002](./0002-sprint-project-team-restructure.md) (2026-07-08 핑퐁 결정 — Initiative 제거 후 Sprint/Project/Team 개편으로 #2 해소)
- **날짜**: 2026-07-08
- **관련**: roadmap #2, #3(커스텀 key/Project)

## 배경

현재 엔티티 계층은 `Initiative > Epic > Task`이며 Initiative가 최상위다(`prisma/schema.prisma`의 `Initiative`에 `parentId` 없음). "이니셔티브 위에 상위 항목이 필요한가"에 대한 결정이 필요하다.

## 선택지

1. **현행 유지(플랫 최상위)** — Initiative가 최상위 목표. 추가 모델/관계 없음.
2. **Initiative self-parent** — `Initiative.parentId` 자기참조로 하위 이니셔티브 계층 허용.
3. **상위 티어 신설** — Initiative 위에 `Objective`/`Theme` 같은 새 모델 도입.

## 판단

- 상위 그룹핑의 **실제 유스케이스가 아직 확인되지 않았다**(OKR 묶음? 로드맵 테마?). 근거 없이 계층을 늘리면 UI·쿼리·필터·타임라인 그룹핑이 전부 복잡해진다.
- roadmap #3의 **Project(커스텀 key) 개념이 사실상 상위 그룹 역할**을 할 수 있다. 프로젝트 단위로 이니셔티브를 묶으면 "상위 항목" 요구의 상당 부분이 흡수된다.
- 타임라인은 이미 이니셔티브 기준으로 에픽을 그룹핑한다(`epic-timeline.tsx`의 `groups`). 최상위가 하나 더 생기면 이 그룹핑도 재설계 대상이 된다.

## 권장 (초안)

**옵션 1(현행 유지)** 를 기본으로 하고, 그룹핑 요구는 **#3 Project 도입 시 함께 해결**한다. 하위 이니셔티브(옵션 2)는 스키마 1줄(`parentId` 자기참조)로 비용이 작으므로, "이니셔티브를 이니셔티브 아래 묶고 싶다"는 구체 요구가 나오면 그때 최소 도입한다.

## 확정에 필요한 입력 (사용자)

- 상위 항목이 필요한 **구체 시나리오**가 있는가? (예: 분기 OKR로 여러 이니셔티브 묶기)
- 그 묶음을 **Project(#3)** 로 표현해도 충분한가, 별도 상위 계층이어야 하는가?

> 확정 전까지 코드/스키마 변경 없음. 확정되면 이 ADR 상태를 Accepted로 바꾸고 roadmap #2를 갱신한다.
