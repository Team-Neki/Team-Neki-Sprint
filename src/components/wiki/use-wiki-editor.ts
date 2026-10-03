"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { wikiExtensions } from "@/components/wiki/extensions";
import { UploadPlaceholder } from "@/components/wiki/upload-placeholder";
import { htmlHasText, uploadAndInsertAny } from "@/components/wiki/upload";
import { selectWikiLine } from "@/components/wiki/line-selection";
import type { EditorProps } from "@tiptap/pm/view";

/**
 * 위키 에디터·공지 에디터 공용 Tiptap 설정. 두 에디터가 각자 복사해 쓰다 공지 쪽에서
 * UploadPlaceholder·붙여넣기·드롭·트리플클릭이 빠졌다(BACKEND-187) — 이제 여기 한 곳.
 *
 * extensions·editorProps 는 한 번만 만든다. useEditor 는 렌더마다 옵션을 참조 비교해
 * 다르면 setOptions(view.setProps)를 부르는데, 이 에디터는 shouldRerenderOnTransaction
 * 이라 키 입력마다 렌더된다. onUpdate 는 비교 대상이 아니고 최신 값이 호출되므로 인라인이어도 된다.
 */
export function useWikiEditor({
  content,
  placeholder,
  onUpdate,
}: {
  content: JSONContent;
  placeholder: string;
  onUpdate: () => void;
}) {
  // editorProps 핸들러(생성 시점 클로저)에서 editor 인스턴스에 접근하기 위한 ref.
  const editorRef = useRef<Editor | null>(null);

  const extensions = useMemo(
    () => [
      ...wikiExtensions({ placeholder }),
      // 업로드 중 삽입 위치를 표시·추적하는 위젯(편집 모드 전용 — 데코레이션이라
      // 스키마/저장 내용에는 영향 없음). 없으면 업로드가 성공해도 삽입되지 않는다.
      UploadPlaceholder,
    ],
    [placeholder],
  );

  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: { class: "tiptap focus:outline-none" },
      handleTripleClick: selectWikiLine,
      // 파일 붙여넣기. ProseMirror 기본 paste 보다 먼저 실행되는 handlePaste 로
      // 가로챈다 — DOM paste 리스너는 PM 기본 처리 이후에 실행돼 HTML+파일 혼합
      // 클립보드(브라우저 '이미지 복사' 등)에서 핫링크+업로드본이 이중 삽입된다.
      // 업로드 성공 URL 만 삽입(base64 금지).
      // - 파일만(스크린샷·Finder 파일 복사·'이미지 복사'): 업로드 후 삽입 —
      //   이미지는 image 노드, 그 외는 fileAttachment 칩(upload.ts). 여러 개면
      //   순서 유지. Finder 가 넣는 파일명 text/plain 은 무시.
      // - HTML 에 텍스트가 함께 있으면(웹페이지 선택 복사·엑셀 표 등): 기본
      //   붙여넣기로 텍스트를 보존하고, 파일로 중복 동봉된 이미지는 HTML 쪽이
      //   정본이므로 업로드하지 않는다.
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (htmlHasText(html)) return false;
        void uploadAndInsertAny(editorRef.current, files);
        return true;
      },
      // 파일 드롭 → 드롭 좌표에 순서대로 삽입(이미지/그 외 분기는 upload.ts).
      // moved(에디터 내 노드 이동)는 기본 처리에 맡긴다. 파일이 하나라도 있으면
      // 종류와 무관하게 true 를 돌려 브라우저 기본 동작(드롭한 PDF 등을 열며
      // 페이지 이탈)을 막는다.
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;
        void uploadAndInsertAny(editorRef.current, files, pos);
        return true;
      },
    }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    // Tiptap 3.x 기본값은 트랜잭션에 리렌더하지 않는다(useEditor 셀렉터가 null 반환).
    // 툴바·버블이 render 중 editor.isActive() 를 읽으므로 선택 변경마다 리렌더가 필요하다.
    shouldRerenderOnTransaction: true,
    extensions,
    content,
    editorProps,
    onUpdate,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  return editor;
}

/**
 * Cmd/Ctrl+S, Cmd/Ctrl+Enter 로 저장(커밋) + 미저장 편집이 있으면 이탈 경고.
 *
 * 키 리스너는 캡처 단계(3번째 인자 true)로 등록한다. 버블 단계로 두면 ProseMirror 가
 * 에디터 DOM 에서 먼저 Enter 를 처리해 줄바꿈을 삽입한 뒤 이 리스너가 실행돼,
 * preventDefault 를 해도 줄바꿈이 이미 들어간다. 캡처 단계에서 가로채
 * stopPropagation 으로 이벤트가 에디터까지 닿지 못하게 막아 줄바꿈 없이 저장만 한다.
 */
export function useSaveShortcuts(
  commit: () => void,
  dirtyRef: RefObject<boolean>,
) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "s" || k === "enter") {
        e.preventDefault();
        e.stopPropagation();
        commit();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [commit]);

  // 저장 전 이탈 시 편집 유실 경고(위키는 draft 로 대부분 보호되지만 안전장치).
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyRef]);
}
