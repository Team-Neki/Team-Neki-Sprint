// 위키 본문 파일 업로드 헬퍼. 툴바 버튼·붙여넣기·드롭·슬래시 커맨드가 공유한다.
// 이미지는 /api/wiki/upload 로 올려 image 노드로, 그 외는 /api/wiki/file 로 올려
// fileAttachment 노드(다운로드 칩)로 삽입한다. 최상위에서 DOM 을 만지지 않아
// (document 접근은 함수 본문 안에서만) Node 환경 단위 테스트가 가능하다.

import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import {
  addUploadPlaceholder,
  findUploadPlaceholder,
  removeUploadPlaceholder,
} from "@/components/wiki/upload-placeholder";

/** 이미지 업로드 허용 타입(서버 /api/wiki/upload 와 동일). 그 외는 첨부파일로. */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** 이미지 파일을 업로드하고 서빙 URL 을 반환. 실패 시 토스트 + null(본문 이미지 첨부). */
async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/wiki/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(err?.error ?? "이미지 업로드에 실패했습니다");
      return null;
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  } catch {
    toast.error("이미지 업로드에 실패했습니다");
    return null;
  }
}

/** 첨부파일 업로드 결과(서버 응답 메타). fileAttachment 노드 attrs 로 그대로 매핑된다. */
type UploadedFile = {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

/** 임의 파일을 업로드하고 메타를 반환. 실패 시 토스트 + null(본문 파일 첨부). */
async function uploadFile(file: File): Promise<UploadedFile | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/wiki/file", { method: "POST", body: fd });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(err?.error ?? "파일 업로드에 실패했습니다");
      return null;
    }
    return (await res.json()) as UploadedFile;
  } catch {
    toast.error("파일 업로드에 실패했습니다");
    return null;
  }
}

/**
 * 파일들을 이미지/그 외로 나눈다. SVG 는 이미지 라우트가 거부(XSS)하므로 첨부 쪽으로
 * 보낸다 — 파일 라우트도 SVG 를 415 로 막으므로 서버 메시지가 토스트로 뜬다(의도된 동작).
 */
export function splitFiles(files: FileList | File[] | null | undefined) {
  const all = Array.from(files ?? []);
  return {
    images: all.filter((f) => IMAGE_TYPES.has(f.type)),
    others: all.filter((f) => !IMAGE_TYPES.has(f.type)),
  };
}

/** 클립보드 HTML 에 이미지 외 실질 텍스트 콘텐츠가 있는지. */
export function htmlHasText(html: string): boolean {
  if (!html) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").trim().length > 0;
}

/** 파일 선택 다이얼로그를 열고 선택 결과를 돌려준다(취소 시 빈 배열). 툴바·슬래시가 공유. */
export function pickFiles(
  opts: { accept?: string; multiple?: boolean } = {},
): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (opts.accept) input.accept = opts.accept;
    input.multiple = !!opts.multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    // ponytail: 취소 감지는 휴리스틱 — 취소는 change 가 안 오므로 창 포커스 복귀 후
    // 300ms 안에 change 가 없으면 취소로 간주(resolve 는 첫 호출만 유효). 파일 창은
    // OS 모달이라 보통 change 가 focus 보다 먼저 오지만 보장은 없어, 그보다 늦게 오는
    // 선택은 유실된다. 지원 브라우저가 확정되면 input.oncancel(Chrome 113+/Safari
    // 16.4+) 로 교체.
    window.addEventListener("focus", () => setTimeout(() => resolve([]), 300), {
      once: true,
    });
    input.click();
  });
}

/**
 * 이미지 파일들을 병렬 업로드하고, 성공분만 원래 순서대로 본문에 삽입.
 * dropPos 가 있으면 그 위치(드롭 좌표)에, 없으면 현재 커서에 삽입한다.
 *
 * 업로드 동안 사용자가 계속 타이핑/편집할 수 있으므로 완료 시점의 selection/
 * 좌표를 쓰면 원래 붙여넣기·드롭한 위치를 벗어난다. 호출 시점에 placeholder
 * 위젯을 먼저 넣고 ProseMirror mapping 으로 추적한 뒤(upload-placeholder.ts),
 * 완료 시 그 위치에 삽입한다. 업로드 중 사용자가 placeholder 자리를 지우면
 * 삽입도 취소한다(위젯이 사라지는 것이 보이므로 의도된 취소로 간주).
 */
export async function uploadAndInsertImages(
  editor: Editor | null,
  files: File[],
  dropPos?: number,
) {
  if (!editor || editor.isDestroyed || files.length === 0) return;
  const id = {};
  if (dropPos == null) {
    // 붙여넣기·툴바 첨부: 기존 insertContent 동작과 같이 선택 영역을 대체한다.
    editor.chain().focus().deleteSelection().run();
  }
  addUploadPlaceholder(editor.view, id, dropPos ?? editor.state.selection.from);
  try {
    const urls = (await Promise.all(files.map((f) => uploadImage(f)))).filter(
      (u): u is string => u !== null,
    );
    if (editor.isDestroyed || urls.length === 0) return;
    const pos = findUploadPlaceholder(editor.state, id);
    if (pos == null) return;
    const nodes = urls.map((src) => ({ type: "image", attrs: { src } }));
    editor.chain().insertContentAt(pos, nodes).run();
  } finally {
    if (!editor.isDestroyed) removeUploadPlaceholder(editor.view, id);
  }
}

/** 임의 파일들을 병렬 업로드하고 성공분만 fileAttachment 노드로 삽입(이미지 헬퍼와 동형). */
export async function uploadAndInsertFiles(
  editor: Editor | null,
  files: File[],
  dropPos?: number,
) {
  if (!editor || editor.isDestroyed || files.length === 0) return;
  const id = {};
  if (dropPos == null) editor.chain().focus().deleteSelection().run();
  addUploadPlaceholder(
    editor.view,
    id,
    dropPos ?? editor.state.selection.from,
    "파일 업로드 중…",
  );
  try {
    const metas = (await Promise.all(files.map(uploadFile))).filter(
      (m): m is UploadedFile => m !== null,
    );
    if (editor.isDestroyed || metas.length === 0) return;
    const pos = findUploadPlaceholder(editor.state, id);
    if (pos == null) return;
    const nodes = metas.map((m) => ({
      type: "fileAttachment",
      attrs: { id: m.id, name: m.name, size: m.size, mime: m.mimeType },
    }));
    editor.chain().insertContentAt(pos, nodes).run();
  } finally {
    if (!editor.isDestroyed) removeUploadPlaceholder(editor.view, id);
  }
}

/** 드롭·붙여넣기·슬래시 공용: 이미지는 이미지로, 나머지는 첨부로. */
export async function uploadAndInsertAny(
  editor: Editor | null,
  files: File[],
  dropPos?: number,
) {
  const { images, others } = splitFiles(files);
  await Promise.all([
    uploadAndInsertImages(editor, images, dropPos),
    uploadAndInsertFiles(editor, others, dropPos),
  ]);
}
