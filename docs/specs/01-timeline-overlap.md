# Spec #1 — 타임라인 날짜 겹침 수정

- **브랜치**: `feat/timeline-overlap`
- **규모**: S · **스키마 변경**: 없음

## 문제

`src/components/timeline/epic-timeline.tsx`의 주(week) 헤더 눈금. 각 라벨이 `absolute` + `-translate-x-1/2`로 `left: pct(w)%`에 중앙 정렬되는데(약 124–135행), 주 밀도가 높으면 인접 라벨("7/6"·"7/13"…)이 충돌 회피 없이 겹친다.

## 결정된 접근

라벨 밀도 기반 thinning:
- 전체 창(`totalDays`)과 주 개수로부터 라벨 간 예상 간격을 계산.
- 인접 라벨이 최소 간격(약 44px 상당의 % — 컨테이너 `min-w-[760px]` 기준으로 환산) 미만이면 **N주마다 하나만** 표기(첫 주는 항상 표기).
- 절대 위치·가로 스크롤(`overflow-x-auto`, `min-w`)은 유지.

## 변경 파일

- `src/components/timeline/epic-timeline.tsx` (단일)

## 수용 기준

- 주가 촘촘한 넓은 창에서도 헤더 라벨이 시각적으로 겹치지 않는다.
- epic/task 바 라벨도 겹치면 함께 처리(줄임/툴팁 등 최소 조치).
- today 마커·바 위치 정확성 회귀 없음.

## 검증

- `npm run build` + `npm run lint`(신규 경고 없음).
- 가능하면 dev에서 긴 범위(장기 프로젝트) 타임라인 렌더 확인.
