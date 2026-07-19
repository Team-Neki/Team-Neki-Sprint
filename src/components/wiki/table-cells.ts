// 표 셀/헤더에 배경색 attr 을 얹은 확장(T22 후속). 순정 TableCell/TableHeader 를
// extend 해 backgroundColor 를 추가한다 — TableKit 에서 tableCell/tableHeader 를
// 끄고 이 둘을 등록한다(extensions.ts). 적용은 setCellAttribute("backgroundColor", v)
// (현재 셀 또는 CellSelection 전체), 헤더 행 일괄은 table-edit.setHeaderRowBackground.

import { TableCell, TableHeader } from "@tiptap/extension-table";

/** data-bg + inline style 로 직렬화(복붙/HTML 라운드트립). null=기본(th 는 --muted). */
const backgroundColorAttribute = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) =>
      el.getAttribute("data-bg") || el.style.backgroundColor || null,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.backgroundColor
        ? {
            "data-bg": attrs.backgroundColor as string,
            style: `background-color: ${attrs.backgroundColor as string}`,
          }
        : {},
  },
};

export const WikiTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttribute };
  },
});

export const WikiTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttribute };
  },
});
