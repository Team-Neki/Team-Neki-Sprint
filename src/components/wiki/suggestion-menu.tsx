"use client";

// '#' 티켓·'@' 사람·'/' 슬래시 제안 메뉴의 공용 부분. 세 메뉴가 복사해 쓰던 목록
// 키보드 탐색(useSuggestionList)과 Suggestion render 수명주기(suggestionRender)를
// 한 곳에 둔다. 항목 마크업·빈 상태·너비 같은 메뉴별 차이는 각 호출부에 남긴다.

import {
  useImperativeHandle,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type ForwardedRef,
  type PropsWithoutRef,
  type RefAttributes,
} from "react";
import { ReactRenderer } from "@tiptap/react";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";

export type SuggestionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

// 선택 인덱스·↑↓ 순환·Enter 선택. 반환한 listRef 를 항목들의 직계 부모에 달면
// 키보드로 옮긴 항목을 스크롤해 보이게 한다(마우스 hover 는 이미 보이는 항목이라 제외).
export function useSuggestionList<I>(
  props: SuggestionProps<I, I>,
  ref: ForwardedRef<SuggestionListHandle>,
) {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = props.items;

  // items가 바뀌면 선택을 0으로 리셋. effect 대신 렌더 중 이전값 비교 패턴 사용.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setSelected(0);
  }

  function pick(index: number) {
    const item = items[index];
    if (item) props.command(item);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      const n = items.length;
      if (n === 0) return false;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const next = (selected + (event.key === "ArrowUp" ? n - 1 : 1)) % n;
        setSelected(next);
        listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
        return true;
      }
      if (event.key === "Enter") {
        pick(selected);
        return true;
      }
      return false;
    },
  }));

  return { selected, setSelected, pick, listRef };
}

// Suggestion 옵션의 render. 목록 컴포넌트를 ReactRenderer 로 띄우고 위치는
// props.mount(관리형 포지셔닝)에 맡긴다. Escape 는 팝업만 내린다.
export function suggestionRender<I>(
  List: ForwardRefExoticComponent<
    PropsWithoutRef<SuggestionProps<I, I>> & RefAttributes<SuggestionListHandle>
  >,
): NonNullable<SuggestionOptions<I, I>["render"]> {
  return () => {
    let component: ReactRenderer<
      SuggestionListHandle,
      SuggestionProps<I, I>
    > | null = null;
    let unmount: (() => void) | undefined;

    return {
      onStart: (props) => {
        component = new ReactRenderer(List, { props, editor: props.editor });
        unmount = props.mount(component.element);
      },
      onUpdate: (props) => {
        component?.updateProps(props);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          unmount?.();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        unmount?.();
        component?.destroy();
        component = null;
      },
    };
  };
}
