"use client";

// 슬래시 커맨드(/) 확장. '/' 트리거로 블록 삽입 커맨드 목록을 띄운다. 노드를 삽입하는
// 멘션과 달리 마크/노드를 새로 만들지 않으므로 Node 가 아니라 Extension 으로 배선한다
// (뷰/에디터 스키마 동등성에 영향 없음). 커맨드 정의·드롭다운은 slash-menu.tsx 참고.

import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import {
  SlashMenu,
  filterSlashItems,
  type SlashItem,
  type SlashMenuHandle,
} from "@/components/wiki/slash-menu";

const slashSuggestionKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        pluginKey: slashSuggestionKey,
        // 줄 시작 또는 공백 뒤 '/' 만 트리거(단어 중간 '/' 는 무시). 코드블록 안은 제외.
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name === "codeBlock") return false;
          const before = $from.nodeBefore;
          const textBefore = before?.isText ? (before.text ?? "") : "";
          // range.from 바로 앞 문자가 없거나(줄 시작) 공백이면 허용.
          return textBefore === "" || /\s$/.test(textBefore);
        },
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          props.run(editor, range);
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle> | null = null;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor,
              });
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
        },
      }),
    ];
  },
});
