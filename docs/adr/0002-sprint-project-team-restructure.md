# ADR 0002 — Sprint / Project / Team 계층 개편

- **상태**: Accepted (2026-07-08, 핑퐁 결정) · 구현은 스펙 승인 후
- **supersedes**: [ADR 0001](./0001-initiative-parent.md) (#2 이니셔티브 상위 항목 — 본 개편으로 해소)
- **통합**: roadmap #2 + #3(커스텀 key) + #4(유저 그룹) → 단일 개편으로 병합
- **스펙**: [`../specs/02-03-04-hierarchy-restructure.md`](../specs/02-03-04-hierarchy-restructure.md)

## 배경 / 요구

스프린트 단위로 일을 관리하되, 한 스프린트에 여러 팀 횡단 "작업"이 있고, 각 작업을 팀들이 나눠 수행한다. 팀은 곧 key 접두어이자 유저 그룹이다.

## 결정 (핑퐁 요약)

1. **계층 개편**: 기존 `Initiative > Epic > Task` → **`Sprint > Project > Epic > Task`** (4단계).
2. **Initiative 제거**: 팀별 목표 레인을 별도 계층으로 두지 않고, **팀 소유권을 Epic으로 이관**(핑 6에서 옵션 B 선택). Project(팀 횡단 작업)와 Team(팀 소유)로 역할 분리.
3. **Team = key = 유저 그룹 (통합)**: 팀 key(DESIGN, BACKEND, FRONTEND, AOS, IOS, MARKETING, PM…)가 이슈 key 접두어이자 #4의 유저 그룹. **한 사람 = 한 팀**.
4. **key 부여**: 팀 key는 **Epic·Task**에 붙고, **팀 단위 연속 시퀀스**(`DESIGN-1` 에픽, `DESIGN-2` 태스크…). 스프린트/프로젝트가 바뀌어도 리셋 없이 이어짐.
5. **마이그레이션**: 기존 **Initiative → Project 로 전환**(에픽들의 부모 링크 보존) + 기본 Sprint 1개 생성 + 기존 Epic/Task를 기본 팀 하나로 몰아 배정 후 재배정.
6. **초기 팀 시드**: `DESIGN`, `FRONTEND`, `BACKEND`, `AOS`, `IOS`, `MARKETING`, `PM`.

## 근거

- Project는 "무엇을(팀 횡단 목표)", Team은 "누가(팀 소유)"를 잡아 역할이 겹치지 않는다. 팀이 프로젝트마다 별도 목표 레인(구 Initiative)을 세울 필요는 없다고 판단(옵션 B) → 계층 단순화.
- key=Team=그룹 통합으로 #3·#4가 하나의 개념으로 수렴, 모델·UI 중복 제거.
- 앱 이름이 "Sprint"인데 스프린트 엔티티가 없던 공백을 메운다.

## 영향

- **큰 스키마 개편 + 데이터 마이그레이션**(모델 3개 신설/전환: Sprint·Project·Team, Epic/Task key 체계 교체, User 팀 소속). 단독 phase 2 과제. 상세·단계는 스펙 참조.

## 확정 필요(스펙에서 다룸)

- key 시퀀스 동시성(팀 카운터 원자적 증가), 기존 key(`EPIC-n`/`TASK-n`) → `<TEAM>-<n>` 전환 시 표시 변경 수용.
- 타임라인 그룹핑 기준(구: 이니셔티브 → 신: Project 또는 Team) 재설계.
