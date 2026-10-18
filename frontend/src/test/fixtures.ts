import type { ApplicationRow } from "@/types/api";

export function makeApp(over: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: "a1",
    candidate_id: "c1",
    candidate_name: "Ada Lovelace",
    candidate_skills: ["python", "sql"],
    candidate_years_experience: 4,
    job_id: "j1",
    job_title: "Backend Engineer",
    stage: "APPLIED",
    applied_at: "2026-01-05T10:00:00Z",
    stage_changed_at: "2026-01-05T10:00:00Z",
    match_score: null,
    allowed_next_stages: ["SCREENING", "REJECTED", "WITHDRAWN"],
    ...over,
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
