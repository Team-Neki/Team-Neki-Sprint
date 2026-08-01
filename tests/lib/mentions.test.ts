import { describe, it, expect } from "vitest";
import { extractMentionUserIds, extractMentionTeamIds } from "@/lib/mentions";

const doc = (content: unknown) => ({ type: "doc", content });
const mention = (id: unknown) => ({ type: "personMention", attrs: { id } });
const teamMention = (id: unknown) => ({ type: "teamMention", attrs: { id } });

describe("extractMentionUserIds", () => {
  it("collects personMention ids across nested content", () => {
    const value = doc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "hi " },
          mention("u1"),
          { type: "text", text: " and " },
          mention("u2"),
        ],
      },
      { type: "paragraph", content: [mention("u3")] },
    ]);
    expect([...extractMentionUserIds(value)].sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("dedupes repeated ids", () => {
    const value = doc([
      { type: "paragraph", content: [mention("u1"), mention("u1")] },
    ]);
    expect([...extractMentionUserIds(value)]).toEqual(["u1"]);
  });

  it("ignores non-mention nodes and non-string/empty ids", () => {
    const value = doc([
      { type: "paragraph", content: [mention(123), mention(""), mention(null)] },
      { type: "taskMention", attrs: { id: "t1" } },
    ]);
    expect(extractMentionUserIds(value).size).toBe(0);
  });

  it("handles null/undefined/non-object input safely", () => {
    expect(extractMentionUserIds(null).size).toBe(0);
    expect(extractMentionUserIds(undefined).size).toBe(0);
    expect(extractMentionUserIds("nope").size).toBe(0);
  });

  it("does not pick up teamMention nodes", () => {
    const value = doc([{ type: "paragraph", content: [teamMention("t1")] }]);
    expect(extractMentionUserIds(value).size).toBe(0);
  });
});

describe("extractMentionTeamIds", () => {
  it("collects teamMention ids and ignores personMention", () => {
    const value = doc([
      {
        type: "paragraph",
        content: [teamMention("t1"), mention("u1"), teamMention("t2")],
      },
    ]);
    expect([...extractMentionTeamIds(value)].sort()).toEqual(["t1", "t2"]);
  });

  it("dedupes and drops invalid ids", () => {
    const value = doc([
      {
        type: "paragraph",
        content: [teamMention("t1"), teamMention("t1"), teamMention("")],
      },
    ]);
    expect([...extractMentionTeamIds(value)]).toEqual(["t1"]);
  });
});
