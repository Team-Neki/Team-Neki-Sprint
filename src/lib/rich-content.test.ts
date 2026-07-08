import { describe, it, expect } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  parseDoc,
  docToPlainText,
  plainTextOf,
  isValueEmpty,
  mentionsInValue,
} from "@/lib/rich-content";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function docOf(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

describe("parseDoc", () => {
  it("null/undefined/빈 문자열 → 빈 doc", () => {
    expect(parseDoc(null)).toEqual(EMPTY_DOC);
    expect(parseDoc(undefined)).toEqual(EMPTY_DOC);
    expect(parseDoc("")).toEqual(EMPTY_DOC);
  });

  it("레거시 plain text → 단락으로 감싼 doc", () => {
    const doc = parseDoc("hello world");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello world" }] },
      ],
    });
  });

  it("유효한 doc JSON 문자열 → 그대로 파싱", () => {
    const original = docOf({
      type: "paragraph",
      content: [{ type: "text", text: "hi" }],
    });
    expect(parseDoc(JSON.stringify(original))).toEqual(original);
  });

  it("'{' 로 시작하지만 doc 타입이 아닌 JSON → plain text 폴백", () => {
    const raw = '{"type":"paragraph"}';
    const doc = parseDoc(raw);
    // doc 타입이 아니므로 원문을 그대로 단락 텍스트로 감싼다.
    expect(doc.content?.[0]?.content?.[0]?.text).toBe(raw);
  });

  it("깨진 JSON('{' 시작이지만 파싱 실패) → plain text 폴백", () => {
    const raw = "{not valid json";
    const doc = parseDoc(raw);
    expect(doc.content?.[0]?.content?.[0]?.text).toBe(raw);
  });

  it("'{' 로 시작하지 않는 텍스트는 파싱 시도 없이 plain text", () => {
    const doc = parseDoc("  just text  ");
    // 원문(trim 안 된 값)이 그대로 텍스트로 들어간다.
    expect(doc.content?.[0]?.content?.[0]?.text).toBe("  just text  ");
  });
});

describe("docToPlainText", () => {
  it("단락 텍스트 추출", () => {
    const doc = docOf({
      type: "paragraph",
      content: [{ type: "text", text: "hello" }],
    });
    expect(docToPlainText(doc)).toBe("hello");
  });

  it("여러 단락은 개행으로 join 되고 끝 공백은 trim", () => {
    const doc = docOf(
      { type: "paragraph", content: [{ type: "text", text: "line1" }] },
      { type: "paragraph", content: [{ type: "text", text: "line2" }] },
    );
    expect(docToPlainText(doc)).toBe("line1\nline2");
  });

  it("연속 개행(빈 단락 포함)은 하나로 축약", () => {
    const doc = docOf(
      { type: "paragraph", content: [{ type: "text", text: "a" }] },
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    );
    expect(docToPlainText(doc)).toBe("a\nb");
  });

  it("personMention 은 @label 로", () => {
    const doc = docOf({
      type: "paragraph",
      content: [
        { type: "text", text: "cc " },
        { type: "personMention", attrs: { id: "u1", label: "구태형" } },
      ],
    });
    expect(docToPlainText(doc)).toBe("cc @구태형");
  });

  it("ticketMention 은 label 그대로", () => {
    const doc = docOf({
      type: "paragraph",
      content: [
        { type: "text", text: "see " },
        { type: "ticketMention", attrs: { id: "t1", label: "DESIGN-1" } },
      ],
    });
    expect(docToPlainText(doc)).toBe("see DESIGN-1");
  });

  it("label 없는 멘션은 빈 라벨로(@ / 빈 문자열)", () => {
    const doc = docOf({
      type: "paragraph",
      content: [
        { type: "personMention", attrs: { id: "u1" } },
        { type: "ticketMention", attrs: { id: "t1" } },
      ],
    });
    expect(docToPlainText(doc)).toBe("@");
  });

  it("heading 도 개행 처리", () => {
    const doc = docOf(
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "제목" }] },
      { type: "paragraph", content: [{ type: "text", text: "본문" }] },
    );
    expect(docToPlainText(doc)).toBe("제목\n본문");
  });
});

describe("plainTextOf (저장 문자열 → 텍스트)", () => {
  it("레거시 plain text 는 그대로 통과", () => {
    expect(plainTextOf("legacy comment")).toBe("legacy comment");
  });

  it("doc JSON 문자열 → 텍스트", () => {
    const stored = JSON.stringify(
      docOf({ type: "paragraph", content: [{ type: "text", text: "저장됨" }] }),
    );
    expect(plainTextOf(stored)).toBe("저장됨");
  });

  it("null → 빈 문자열", () => {
    expect(plainTextOf(null)).toBe("");
  });
});

describe("isValueEmpty", () => {
  it("null/undefined/빈 문자열/공백만 → 비었음", () => {
    expect(isValueEmpty(null)).toBe(true);
    expect(isValueEmpty(undefined)).toBe(true);
    expect(isValueEmpty("")).toBe(true);
    expect(isValueEmpty("   ")).toBe(true);
  });

  it("빈 단락만 있는 doc → 비었음", () => {
    expect(isValueEmpty(JSON.stringify(EMPTY_DOC))).toBe(true);
  });

  it("내용 있는 텍스트/doc → 비지 않음", () => {
    expect(isValueEmpty("hi")).toBe(false);
    expect(
      isValueEmpty(
        JSON.stringify(
          docOf({ type: "paragraph", content: [{ type: "text", text: "x" }] }),
        ),
      ),
    ).toBe(false);
  });
});

describe("mentionsInValue", () => {
  it("personMention 의 userId 집합 추출(중복 제거)", () => {
    const stored = JSON.stringify(
      docOf({
        type: "paragraph",
        content: [
          { type: "personMention", attrs: { id: "u1", label: "A" } },
          { type: "personMention", attrs: { id: "u2", label: "B" } },
          { type: "personMention", attrs: { id: "u1", label: "A" } },
        ],
      }),
    );
    const ids = mentionsInValue(stored);
    expect(ids).toBeInstanceOf(Set);
    expect([...ids].sort()).toEqual(["u1", "u2"]);
  });

  it("ticketMention 은 사람 멘션이 아니므로 제외", () => {
    const stored = JSON.stringify(
      docOf({
        type: "paragraph",
        content: [{ type: "ticketMention", attrs: { id: "t1", label: "D-1" } }],
      }),
    );
    expect(mentionsInValue(stored).size).toBe(0);
  });

  it("멘션 없는 값 → 빈 집합", () => {
    expect(mentionsInValue("plain text").size).toBe(0);
    expect(mentionsInValue(null).size).toBe(0);
  });
});
