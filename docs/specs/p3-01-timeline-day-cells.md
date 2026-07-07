# Spec P3-S1 — 타임라인 일(day) 단위 셀

- **브랜치**: `feat/timeline-day` · **규모**: S · **스키마**: 없음 · **병렬**: 독립(worktree)

## 목표

타임라인(`src/components/timeline/epic-timeline.tsx`)이 현재 주(week) 눈금 기준이라 하루 단위가 안 보인다. **일(day) 단위 셀**로 눈금을 조절해 각 날짜가 개별 셀로 보이도록 한다.

## 접근

- 눈금을 **일 단위 컬럼**으로: 각 날짜가 고정 폭 셀(예: `--day-w`, 28~40px)을 가지도록 컨테이너 폭 = `totalDays * dayWidth`.
- 주말/오늘 셀 시각 구분(옅은 배경/보더). today 마커 유지.
- 라벨 겹침 방지(P1에서 한 thinning)와 공존: 일 단위면 라벨이 촘촘하므로 **주 시작일에만 날짜 라벨**을 굵게, 나머지 날은 눈금선만(또는 일 밀도에 따라 라벨 thinning 유지).
- 에픽/태스크 바 위치는 `pct()` 대신 day-index 기반 px로 배치(정확도 향상). 가로 스크롤 유지.
- 범위가 길면 셀이 많아지므로 `min`/`max` day-width 가드.

## 영향 파일

- `src/components/timeline/epic-timeline.tsx` 단일. (timeline page는 그대로)

## 검증 (worktree)

- `npx tsc --noEmit` clean. `npx eslint src` 신규 문제 0(baseline 없음 — 개편 후 lint clean 상태 유지).
- `prisma generate` **실행 금지**(스키마 변경 없음, 공유 client 건드리지 말 것).

## Finish
`git add -A && git commit` on `feat/timeline-day`, 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
