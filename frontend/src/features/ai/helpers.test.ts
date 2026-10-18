import { describe, expect, it } from "vitest";
import type { AnalysisRecord, InterviewQuestion } from "@/types/api";
import { analysisToResume, formatQuestions, mergeSkills, providerLabel, readQuestions } from "./helpers";

describe("ai helpers", () => {
  it("merges skills without duplicates, existing first", () => {
    expect(mergeSkills(["SQL", " python "], ["Python", "fastapi", "  "])).toEqual(["sql", "python", "fastapi"]);
  });

  it("labels providers honestly", () => {
    expect(providerLabel("deterministic")).toMatch(/no AI model/);
    expect(providerLabel("template")).toMatch(/no AI model/);
    expect(providerLabel("anthropic", "m1")).toBe("AI model · anthropic (m1)");
  });

  it("formats questions for copying", () => {
    const q: InterviewQuestion = {
      question: "Explain indexes.",
      category: "technical",
      difficulty: "medium",
      competencies: ["sql"],
      evaluation_criteria: ["Accurate"],
      follow_up: "When do they hurt?",
    };
    const text = formatQuestions([q]);
    expect(text).toContain("1. Explain indexes.");
    expect(text).toContain("- Accurate");
    expect(text).toContain("Follow-up: When do they hurt?");
  });

  it("ignores malformed stored data", () => {
    expect(readQuestions({ questions: [{ nope: 1 }, "x"] })).toEqual([]);
    expect(readQuestions({})).toEqual([]);
    const record: AnalysisRecord = {
      id: "a",
      kind: "RESUME_ANALYSIS",
      candidate_id: "c",
      job_id: null,
      provider: "deterministic",
      model: null,
      is_confirmed: false,
      created_at: "2026-01-01T00:00:00Z",
      result: {},
    };
    expect(analysisToResume(record)).toBeNull();
  });
});
