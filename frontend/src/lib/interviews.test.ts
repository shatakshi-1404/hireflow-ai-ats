import { describe, expect, it } from "vitest";
import { fromLocalInputValue, toLocalInputValue } from "./interviews";

describe("datetime-local helpers", () => {
  it("round-trips an instant at minute precision, in any time zone", () => {
    const iso = "2026-03-05T10:30:00.000Z";
    expect(fromLocalInputValue(toLocalInputValue(iso))?.getTime()).toBe(Date.parse(iso));
  });

  it("rejects empty and invalid values", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("not-a-date")).toBeNull();
  });
});
