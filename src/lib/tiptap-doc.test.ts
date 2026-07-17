import { describe, it, expect } from "vitest";
import { tiptapDocSchema } from "./tiptap-doc";

describe("tiptapDocSchema", () => {
  it("accepts a minimal doc and preserves the original object", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    };
    const parsed = tiptapDocSchema.parse(doc);
    expect(parsed).toEqual(doc);
  });

  it("accepts a doc with no content array", () => {
    expect(tiptapDocSchema.parse({ type: "doc" })).toEqual({ type: "doc" });
  });

  it("rejects non-doc shapes", () => {
    expect(tiptapDocSchema.safeParse({ type: "paragraph" }).success).toBe(false);
    expect(tiptapDocSchema.safeParse({ type: "doc", content: "x" }).success).toBe(
      false,
    );
    expect(tiptapDocSchema.safeParse("just a string").success).toBe(false);
    expect(tiptapDocSchema.safeParse(null).success).toBe(false);
  });
});
