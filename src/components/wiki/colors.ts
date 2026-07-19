/**
 * 위키 에디터 색상 팔레트 정본. 툴바 ColorButton·버블 툴바·테이블 셀 배경이
 * 공유한다. DESIGN 은 새 액센트 남용을 금하지만 본문 글자/배경색은 사용자
 * 콘텐츠(상태 태그 예외와 동일)라 큐레이트된 팔레트로만 허용한다.
 */

export type PaletteColor = { name: string; value: string };

/** 글자 색 10종(진한 톤). '기본 색'은 unsetColor 로 처리(스와치 없음). */
export const TEXT_COLORS: PaletteColor[] = [
  { name: "회색", value: "#6b7280" },
  { name: "갈색", value: "#8d6e63" },
  { name: "빨강", value: "#e5484d" },
  { name: "주황", value: "#f76808" },
  { name: "노랑", value: "#d97706" },
  { name: "초록", value: "#30a46c" },
  { name: "청록", value: "#0d9488" },
  { name: "파랑", value: "#0070f3" },
  { name: "보라", value: "#8e4ec6" },
  { name: "분홍", value: "#e93d82" },
];

/** 글자 배경(하이라이트) 9종(파스텔 톤 — 잉크 텍스트 대비 유지). */
export const BG_COLORS: PaletteColor[] = [
  { name: "회색 배경", value: "#f1f1ef" },
  { name: "갈색 배경", value: "#f3eeee" },
  { name: "빨강 배경", value: "#fdebec" },
  { name: "주황 배경", value: "#fbecdd" },
  { name: "노랑 배경", value: "#fbf3db" },
  { name: "초록 배경", value: "#edf3ec" },
  { name: "청록 배경", value: "#e7f3f1" },
  { name: "파랑 배경", value: "#e7f3f8" },
  { name: "보라 배경", value: "#f1ecf9" },
];

/** 테이블 셀/헤더 배경 프리셋(BG_COLORS 재사용 — 표 안에서도 같은 톤). */
export const CELL_COLORS: PaletteColor[] = BG_COLORS;
