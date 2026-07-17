// 슬래시 커맨드 메타데이터 + 매칭(순수). React/lucide/tiptap 런타임 의존을 두지 않아
// 단위 테스트가 가능하다(vitest 는 Node 환경·import-safe 모듈만 대상). 아이콘·실행
// 로직(에디터 의존)은 slash-menu.tsx 에서 key 로 결합한다.

export type SlashCommandMeta = {
  /** 아이콘·실행 로직과 결합하는 안정 키. */
  key: string;
  title: string;
  subtitle: string;
  /** 검색 별칭(한글/영문). title 과 함께 부분 일치로 매칭된다. */
  aliases: string[];
};

export const SLASH_COMMANDS: SlashCommandMeta[] = [
  {
    key: "h1",
    title: "제목 1",
    subtitle: "큰 제목",
    aliases: ["h1", "heading1", "제목1"],
  },
  {
    key: "h2",
    title: "제목 2",
    subtitle: "중간 제목",
    aliases: ["h2", "heading2", "제목2"],
  },
  {
    key: "h3",
    title: "제목 3",
    subtitle: "작은 제목",
    aliases: ["h3", "heading3", "제목3"],
  },
  {
    key: "h4",
    title: "제목 4",
    subtitle: "더 작은 제목",
    aliases: ["h4", "heading4", "제목4"],
  },
  {
    key: "h5",
    title: "제목 5",
    subtitle: "더 작은 제목",
    aliases: ["h5", "heading5", "제목5"],
  },
  {
    key: "h6",
    title: "제목 6",
    subtitle: "가장 작은 제목",
    aliases: ["h6", "heading6", "제목6"],
  },
  {
    key: "bullet",
    title: "글머리 목록",
    subtitle: "• 순서 없는 목록",
    aliases: ["bullet", "ul", "list", "글머리", "목록"],
  },
  {
    key: "ordered",
    title: "번호 목록",
    subtitle: "1. 순서 있는 목록",
    aliases: ["number", "ol", "ordered", "번호"],
  },
  {
    key: "task",
    title: "체크리스트",
    subtitle: "할 일 목록",
    aliases: ["todo", "task", "check", "체크", "할일"],
  },
  {
    key: "quote",
    title: "인용",
    subtitle: "인용문 블록",
    aliases: ["quote", "blockquote", "인용"],
  },
  {
    key: "code",
    title: "코드 블록",
    subtitle: "구문 강조 코드",
    aliases: ["code", "코드"],
  },
  {
    key: "table",
    title: "표",
    subtitle: "3×3 표 삽입",
    aliases: ["table", "표"],
  },
  {
    key: "mermaid",
    title: "다이어그램",
    subtitle: "mermaid 차트",
    aliases: ["mermaid", "diagram", "chart", "다이어그램"],
  },
  {
    key: "divider",
    title: "구분선",
    subtitle: "가로 구분선",
    aliases: ["divider", "hr", "구분선", "선"],
  },
];

/**
 * title/aliases 부분 일치로 필터(대소문자 무시, query 앞뒤 공백 무시). 빈 query 는 전체
 * 반환. title 과 aliases 만 보므로 메타 객체든 아이콘·run 이 붙은 런타임 객체든 동작한다.
 */
export function filterByQuery<T extends { title: string; aliases: string[] }>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      it.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}
