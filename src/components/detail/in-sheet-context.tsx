"use client";

import { createContext, useContext } from "react";

/**
 * 상세 페이지가 우측 슬라이드(DetailSheet) 안에서 렌더되는지 여부 + 시트 크롬의
 * 삭제 버튼 슬롯. 시트 안에선 뒤로가기 버튼처럼 전체 페이지 전용 UI 를 숨기거나
 * (BackButton), 삭제 버튼을 크롬 슬롯으로 포털(SheetDeleteButton)하는 데 쓴다.
 *
 * 값 규약:
 * - `false`        = 시트 밖(전체 페이지).
 * - `HTMLElement`  = 시트 안이며, 크롬 삭제 슬롯 DOM 노드.
 * - `null`         = 시트 안이지만 슬롯이 아직 마운트 전.
 * Provider(client)는 서버 렌더된 상세 자식을 감싸도 그 안 client 소비자에 전파된다.
 */
type InSheetValue = HTMLElement | null | false;

const InSheetContext = createContext<InSheetValue>(false);

export function InSheetProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <InSheetContext.Provider value={slot}>{children}</InSheetContext.Provider>
  );
}

/** 상세가 우측 슬라이드 시트 안에서 렌더되는지. */
export function useInSheet() {
  return useContext(InSheetContext) !== false;
}

/** 시트 크롬의 삭제 버튼 슬롯 노드(시트 밖이거나 아직 마운트 전이면 null). */
export function useSheetChromeSlot() {
  const value = useContext(InSheetContext);
  return value === false ? null : value;
}
