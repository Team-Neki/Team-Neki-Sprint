import type { ReactNode } from "react";

/**
 * 유저별 PLP 컬럼 커스터마이즈(F4)의 공용 타입·머지 로직.
 * 표(서버 컴포넌트)와 설정 UI(`column-settings.tsx`, client)가 같은 머지 규칙을 공유한다.
 */

/** 저장되는 컬럼 설정 1건: 표시 순서대로의 { key, visible }. */
export type ColumnPrefEntry = { key: string; visible: boolean };
/** 유저 저장 설정. null/undefined = 미설정(기본 컬럼으로 폴백). */
export type ColumnPref = ColumnPrefEntry[];

/** 설정 UI·목록 페이지에 넘기는 컬럼 메타(렌더 함수 제외). */
export type ColumnMeta = { key: string; label: string };

/**
 * 표 컬럼 정의. `cell` 에 기존 인라인 셀 JSX(`edit ? <Inline/> : <읽기전용/>`)를 그대로 담는다.
 * - `head`: 헤더 표시 override(미지정 시 `label`). sr-only 헤더 등에 사용.
 * - `sortField`: 지정 + 표의 `sortable` 이 true 면 헤더를 `SortableHead` 로 렌더.
 */
export type ColumnDef<Row, Edit> = {
  key: string;
  label: string;
  headClassName?: string;
  head?: ReactNode;
  sortField?: string;
  cell: (row: Row, edit?: Edit) => ReactNode;
};

/**
 * 저장된 pref 순서/노출로 컬럼을 정렬·필터한다.
 * - pref 순서 우선(COLUMNS 에 존재하는 것만), pref 에 없는 컬럼은 기본 순서로 뒤에 append(신규 컬럼 노출).
 * - pref 에서 visible:false 인 컬럼은 제외.
 * - pref 없음(null/빈배열) → COLUMNS 원본(전부·기본 순서).
 */
export function resolveColumns<Row, Edit>(
  columns: ColumnDef<Row, Edit>[],
  pref?: ColumnPref | null,
): ColumnDef<Row, Edit>[] {
  if (!pref || pref.length === 0) return columns;
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const ordered: ColumnDef<Row, Edit>[] = [];
  for (const entry of pref) {
    const col = byKey.get(entry.key);
    if (!col || seen.has(entry.key)) continue;
    seen.add(entry.key);
    if (entry.visible) ordered.push(col);
  }
  // pref 에 없는(신규) 컬럼은 기본 순서로 뒤에 붙여 항상 노출.
  for (const col of columns) {
    if (!seen.has(col.key)) ordered.push(col);
  }
  return ordered;
}

/**
 * 설정 UI 초기 목록: available(메타)과 저장 pref 를 머지해 순서·체크 상태가 있는 전체 목록을 만든다.
 * resolveColumns 와 동일한 순서 규칙이되, visible:false 컬럼도 (체크 해제 상태로) 유지한다.
 */
export function mergeColumnPref(
  available: ColumnMeta[],
  pref?: ColumnPref | null,
): { key: string; label: string; visible: boolean }[] {
  const byKey = new Map(available.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const out: { key: string; label: string; visible: boolean }[] = [];
  if (pref) {
    for (const entry of pref) {
      const col = byKey.get(entry.key);
      if (!col || seen.has(entry.key)) continue;
      seen.add(entry.key);
      out.push({ key: col.key, label: col.label, visible: entry.visible });
    }
  }
  for (const col of available) {
    if (seen.has(col.key)) continue;
    out.push({ key: col.key, label: col.label, visible: true });
  }
  return out;
}
