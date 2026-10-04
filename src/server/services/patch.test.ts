import { describe, expect, it } from "vitest";
import { taskSchema, sprintSchema } from "@/lib/validators";
import { parsePatch } from "./patch";

describe("parsePatch", () => {
  it("does not inject schema defaults for keys the input omitted", () => {
    expect(parsePatch(taskSchema, { title: " New " })).toEqual({ title: "New" });
    expect(parsePatch(sprintSchema, { name: "S1" })).toEqual({ name: "S1" });
  });

  it("keeps given keys, including explicit nulls normalized by the schema", () => {
    expect(
      parsePatch(taskSchema, { status: "DONE", assigneeId: "", startDate: null }),
    ).toEqual({ status: "DONE", assigneeId: null, startDate: null });
  });

  it("still validates the given keys", () => {
    expect(() => parsePatch(taskSchema, { status: "NOPE" })).toThrow();
  });
});
