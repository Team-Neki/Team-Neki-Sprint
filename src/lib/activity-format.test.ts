import { describe, it, expect } from "vitest";
import {
  truncateText,
  buildLookups,
  formatFieldValue,
  activityDescription,
  FIELD_LABEL,
  type Lookups,
} from "@/lib/activity-format";

const lookups: Lookups = buildLookups({
  members: [
    { id: "u1", name: "구태형", email: "koo@x.com" },
    { id: "u2", name: null, email: "no-name@x.com" },
  ],
  epics: [{ id: "e1", title: "에픽 A" }],
  projects: [{ id: "p1", title: "프로젝트 A" }],
  sprints: [{ id: "s1", name: "스프린트 1" }],
});

describe("truncateText", () => {
  it("n 이하이면 그대로", () => {
    expect(truncateText("hello", 40)).toBe("hello");
  });

  it("n 초과이면 … 로 자름", () => {
    expect(truncateText("abcdef", 3)).toBe("abc…");
  });
});

describe("buildLookups", () => {
  it("member name 없으면 email 로 fallback", () => {
    expect(lookups.members.get("u1")).toBe("구태형");
    expect(lookups.members.get("u2")).toBe("no-name@x.com");
  });

  it("epic/project/sprint title·name 매핑", () => {
    expect(lookups.epics.get("e1")).toBe("에픽 A");
    expect(lookups.projects.get("p1")).toBe("프로젝트 A");
    expect(lookups.sprints.get("s1")).toBe("스프린트 1");
  });
});

describe("formatFieldValue", () => {
  it("null/빈 값 → '없음'", () => {
    expect(formatFieldValue("status", null, lookups)).toBe("없음");
    expect(formatFieldValue("status", "", lookups)).toBe("없음");
  });

  it("status/priority 는 한국어 라벨", () => {
    expect(formatFieldValue("status", "IN_PROGRESS", lookups)).toBe("진행 중");
    expect(formatFieldValue("priority", "URGENT", lookups)).toBe("긴급");
  });

  it("알 수 없는 status enum 은 원문 유지", () => {
    expect(formatFieldValue("status", "WEIRD", lookups)).toBe("WEIRD");
  });

  it("날짜 필드는 yyyy.M.d 로 포맷", () => {
    expect(formatFieldValue("dueDate", "2026-07-08", lookups)).toBe("2026.7.8");
  });

  it("잘못된 날짜는 원문 유지", () => {
    expect(formatFieldValue("startDate", "not-a-date", lookups)).toBe("not-a-date");
  });

  it("멤버 id → 이름, 없으면 '사용자'", () => {
    expect(formatFieldValue("assigneeId", "u1", lookups)).toBe("구태형");
    expect(formatFieldValue("ownerId", "unknown", lookups)).toBe("사용자");
  });

  it("epic/project/sprint id → 이름, 없으면 라벨 fallback", () => {
    expect(formatFieldValue("epicId", "e1", lookups)).toBe("에픽 A");
    expect(formatFieldValue("epicId", "nope", lookups)).toBe("에픽");
    expect(formatFieldValue("projectId", "nope", lookups)).toBe("프로젝트");
    expect(formatFieldValue("sprintId", "nope", lookups)).toBe("스프린트");
  });

  it("description 은 doc JSON 을 풀어 발췌", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "설명 본문" }] }],
    });
    expect(formatFieldValue("description", doc, lookups)).toBe("설명 본문");
  });

  it("긴 title 은 truncate", () => {
    const long = "가".repeat(50);
    expect(formatFieldValue("title", long, lookups)).toBe(`${"가".repeat(40)}…`);
  });

  it("알 수 없는 필드는 문자열 그대로", () => {
    expect(formatFieldValue("whatever", "raw", lookups)).toBe("raw");
  });
});

describe("activityDescription", () => {
  it("field_changed: 라벨 + from → to 문장", () => {
    const s = activityDescription(
      "field_changed",
      { field: "status", from: "TODO", to: "DONE" },
      lookups,
    );
    expect(s).toBe("상태 할 일 → 완료 로 변경");
    expect(FIELD_LABEL.status).toBe("상태");
  });

  it("status_changed: 상태 라벨 문장", () => {
    expect(
      activityDescription("status_changed", { status: "IN_PROGRESS" }, lookups),
    ).toBe("상태를 진행 중 로 변경");
  });

  it("정형 액션 → 한국어", () => {
    expect(activityDescription("created", {}, lookups)).toBe("생성");
    expect(activityDescription("commented", null, lookups)).toBe("댓글 작성");
    expect(activityDescription("updated", undefined, lookups)).toBe("수정");
    expect(activityDescription("deleted", {}, lookups)).toBe("삭제");
  });

  it("알 수 없는 액션은 원문 반환", () => {
    expect(activityDescription("mystery", {}, lookups)).toBe("mystery");
  });

  it("dependency_added: role 에 따라 차단/차단하는 항목 문장", () => {
    expect(
      activityDescription(
        "dependency_added",
        { role: "blockedBy", key: "DESIGN-2", title: "히어로 배너" },
        lookups,
      ),
    ).toBe("차단 항목 DESIGN-2 히어로 배너 추가");
    expect(
      activityDescription(
        "dependency_removed",
        { role: "blocking", key: "PM-5", title: "랜딩 기획" },
        lookups,
      ),
    ).toBe("차단하는 항목 PM-5 랜딩 기획 제거");
  });

  it("dependency: key 없으면 '태스크' 폴백", () => {
    expect(activityDescription("dependency_added", {}, lookups)).toBe(
      "차단 항목 태스크 추가",
    );
  });

  it("field_changed 인데 field 없으면 액션 fallback 로 처리", () => {
    // field 가 문자열이 아니면 field_changed 분기를 타지 않고 switch 로 → default(원문).
    expect(activityDescription("field_changed", {}, lookups)).toBe("field_changed");
  });
});
