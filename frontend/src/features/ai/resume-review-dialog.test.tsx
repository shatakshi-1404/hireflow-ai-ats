import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetchJson, renderWithProviders } from "@/test/utils";
import type { ResumeAnalysis } from "@/types/api";
import { ResumeReviewDialog } from "./resume-review-dialog";

const analysis: ResumeAnalysis = {
  analysis_id: "an1",
  candidate_id: "c1",
  provider: "deterministic",
  model: null,
  is_confirmed: false,
  filename: "resume.pdf",
  pages: 1,
  text_chars: 900,
  extraction: {
    skills: ["python", "fastapi"],
    years_experience: 6,
    years_experience_evidence: "6 years of experience building APIs",
    summary: null,
    education: [
      { institution: null, degree: "B.Tech", field_of_study: null, year: 2018, evidence: "B.Tech in CS, 2018" },
    ],
    work_experience: [{ title: null, company: null, period: null, description: "Built REST APIs" }],
    projects: [],
    uncertainties: ["Institution names are not auto-extracted."],
    skill_evidence: { python: "Python, FastAPI" },
  },
  warnings: ["No AI provider is configured, so deterministic keyword extraction was used."],
  created_at: "2026-01-01T00:00:00Z",
};
const candidate = { skills: ["sql"], years_experience: 1, experience_summary: null };

function renderDialog(onOpenChange = vi.fn()) {
  renderWithProviders(<ResumeReviewDialog analysis={analysis} candidate={candidate} onOpenChange={onOpenChange} />);
  return onOpenChange;
}

describe("ResumeReviewDialog", () => {
  it("shows warnings and provider, and prefills merged values", () => {
    renderDialog();
    expect(screen.getByText("Keyword rules (no AI model)")).toBeInTheDocument();
    expect(screen.getByText(/No AI provider is configured/)).toBeInTheDocument();
    expect(screen.getByLabelText("Skills")).toHaveValue("sql, python, fastapi");
    expect(screen.getByLabelText("Years of experience")).toHaveValue("6");
    expect(screen.getByText(/6 years of experience building APIs/)).toBeInTheDocument();
  });

  it("requires an institution before anything is sent", async () => {
    const fetchMock = mockFetchJson(200, {});
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Confirm and save profile" }));
    expect(await screen.findByText("Institution is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the corrected profile to the confirm endpoint", async () => {
    const fetchMock = mockFetchJson(200, { id: "c1" });
    const onOpenChange = renderDialog();
    await userEvent.type(screen.getByLabelText("Institution 1"), "Riverside Institute");
    await userEvent.click(screen.getByRole("button", { name: "Confirm and save profile" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/ai/resume-analysis/an1/confirm");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.skills).toEqual(["sql", "python", "fastapi"]);
    expect(body.years_experience).toBe(6);
    expect(body.summary).toBeNull();
    expect(body.education).toEqual([
      { institution: "Riverside Institute", degree: "B.Tech", field_of_study: null, year: 2018 },
    ]);
    expect(body.work_experience).toHaveLength(1);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("lets the recruiter remove an extracted work entry", async () => {
    const fetchMock = mockFetchJson(200, { id: "c1" });
    renderDialog();
    await userEvent.type(screen.getByLabelText("Institution 1"), "Riverside Institute");
    await userEvent.click(screen.getByRole("button", { name: "Remove work entry 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm and save profile" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.work_experience).toEqual([]);
  });

  it("shows the server error and stays open", async () => {
    mockFetchJson(409, { detail: "This analysis has already been confirmed" });
    const onOpenChange = renderDialog();
    await userEvent.type(screen.getByLabelText("Institution 1"), "Riverside Institute");
    await userEvent.click(screen.getByRole("button", { name: "Confirm and save profile" }));
    expect(await screen.findByText("This analysis has already been confirmed")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
