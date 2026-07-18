import { describe, it, expect } from "vitest";
import { deepLink, describeApiError } from "./format";

describe("format", () => {
  it("builds a deep link for a task", () => {
    expect(deepLink("https://sprint.example.com", "tasks", "abc")).toBe(
      "https://sprint.example.com/tasks/abc",
    );
  });

  it("describes a validation error with flattened issues", () => {
    const msg = describeApiError({
      ok: false,
      error: "validation_error",
      issues: { fieldErrors: { title: ["필수"] }, formErrors: [] },
    });
    expect(msg).toContain("validation_error");
    expect(msg).toContain("title");
  });

  it("falls back to the error string", () => {
    expect(describeApiError({ ok: false, error: "unauthorized" })).toContain(
      "unauthorized",
    );
  });
});
