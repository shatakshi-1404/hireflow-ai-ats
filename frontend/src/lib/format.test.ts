import { describe, expect, it } from "vitest";
import { initialsOf } from "@/components/common/initials-avatar";
import { isValidOptionalNumber, parseList, parseOptionalNumber, timeAgo } from "./format";

describe("format helpers", () => {
  it("parses comma, semicolon and newline separated lists", () => {
    expect(parseList("python, SQL; docker\n git ,,")).toEqual(["python", "SQL", "docker", "git"]);
    expect(parseList("   ")).toEqual([]);
  });

  it("validates optional numbers", () => {
    expect(isValidOptionalNumber("")).toBe(true);
    expect(isValidOptionalNumber("4.5")).toBe(true);
    expect(isValidOptionalNumber("-1")).toBe(false);
    expect(isValidOptionalNumber("61")).toBe(false);
    expect(isValidOptionalNumber("abc")).toBe(false);
    expect(parseOptionalNumber(" 3 ")).toBe(3);
    expect(parseOptionalNumber("")).toBeNull();
  });

  it("formats relative times", () => {
    const now = Date.parse("2026-01-10T12:00:00Z");
    expect(timeAgo("2026-01-10T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-01-10T09:00:00Z", now)).toContain("3");
  });

  it("builds initials", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("  prince ")).toBe("P");
    expect(initialsOf("")).toBe("?");
  });
});
