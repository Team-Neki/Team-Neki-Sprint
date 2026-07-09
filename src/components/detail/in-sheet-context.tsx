"use client";

import { createContext, useContext } from "react";

/**
 * 상세 페이지가 우측 슬라이드(DetailSheet) 안에서 렌더되는지 여부.
 * 시트 안에선 뒤로가기 버튼처럼 전체 페이지 전용 UI 를 숨기는 데 쓴다.
 * Provider(client)는 서버 렌더된 상세 자식을 감싸도, 그 안 client 소비자에 전파된다.
 */
const InSheetContext = createContext(false);

export function InSheetProvider({ children }: { children: React.ReactNode }) {
  return (
    <InSheetContext.Provider value={true}>{children}</InSheetContext.Provider>
  );
}

export function useInSheet() {
  return useContext(InSheetContext);
}
