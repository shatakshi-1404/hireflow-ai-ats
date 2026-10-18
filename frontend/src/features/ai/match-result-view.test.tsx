import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MatchDetail } from "@/types/api";
import { MatchResultView } from "./match-result-view";

const match: MatchDetail = {
  provider: "deterministic",
  score: 71.9,
  components: [
    { key: "required_skills", label: "Required skills", value: 0.5, weight: 0.5625, detail: "1 of 2 evidenced" },
    { key: "text_relevance", label: "Text relevance", value: null, weight: 0, detail: "No candidate text is available to compare" },
  ],
  matched_required: [{ skill: "python", source: "resume", evidence: "I use Python daily" }],
  matched_preferred: [{ skill: "fastapi", source: "profile", evidence: null }],
  unverified_required: [
    { skill: "docker", note: "Not found in the profile skills or resume text. This does not mean the candidate lacks it." },
  ],
  unverified_preferred: [],
  experience: { candidate_years: 4, job_min: 2, job_max: 6, fit: 1, note: "Candidate: 4 yrs. Job range: 2–6." },
  method: "Weighted average of components.",
  warnings: ["No resume text is on file for this candidate."],
  disclaimer: "It is not a prediction of job performance, and the hiring decision stays with you.",
};

describe("MatchResultView", () => {
  it("shows the score, evidence and unverified skills without calling them missing", () => {
    render(<MatchResultView match={match} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText(/I use Python daily/)).toBeInTheDocument();
    expect(screen.getByText("Found in resume")).toBeInTheDocument();
    expect(screen.getByText(/From profile, not in resume text/)).toBeInTheDocument();
    expect(screen.getByText("docker")).toBeInTheDocument();
    expect(screen.getByText(/does not mean the candidate lacks it/)).toBeInTheDocument();
    expect(screen.queryByText(/missing/i)).not.toBeInTheDocument();
  });

  it("marks unassessable components and shows warnings and the disclaimer", () => {
    render(<MatchResultView match={match} />);
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.getByText(/No resume text is on file/)).toBeInTheDocument();
    expect(screen.getByText(/not a prediction of job performance/)).toBeInTheDocument();
  });

  it("handles a null score", () => {
    render(<MatchResultView match={{ ...match, score: null }} />);
    expect(screen.getByText(/Not enough information/)).toBeInTheDocument();
  });
});
