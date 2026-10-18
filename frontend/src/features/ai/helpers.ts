import type {
  AnalysisRecord,
  InterviewQuestion,
  MatchDetail,
  ResumeAnalysis,
  ResumeExtraction,
} from "@/types/api";

export function isAiModel(provider: string): boolean {
  return provider !== "deterministic" && provider !== "template";
}

export function providerLabel(provider: string, model?: string | null): string {
  if (provider === "deterministic") return "Keyword rules (no AI model)";
  if (provider === "template") return "Built-in templates (no AI model)";
  return model ? `AI model · ${provider} (${model})` : `AI model · ${provider}`;
}

/** Existing skills first, then extracted ones; lowercase, trimmed, de-duplicated. */
export function mergeSkills(existing: string[], extracted: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of [...existing, ...extracted]) {
    const skill = raw.trim().replace(/\s+/g, " ").toLowerCase();
    if (skill) seen.add(skill);
  }
  return [...seen];
}

export function formatQuestions(questions: InterviewQuestion[]): string {
  return questions
    .map((q, i) => {
      const lines = [`${i + 1}. ${q.question}`, `   Category: ${q.category} · Difficulty: ${q.difficulty}`];
      if (q.competencies.length > 0) lines.push(`   Competencies: ${q.competencies.join(", ")}`);
      lines.push("   Look for:", ...q.evaluation_criteria.map((c) => `   - ${c}`));
      if (q.follow_up) lines.push(`   Follow-up: ${q.follow_up}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function readQuestions(result: Record<string, unknown>): InterviewQuestion[] {
  const raw = result.questions;
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is InterviewQuestion => {
    if (typeof q !== "object" || q === null) return false;
    const o = q as { question?: unknown; evaluation_criteria?: unknown };
    return typeof o.question === "string" && Array.isArray(o.evaluation_criteria);
  });
}

export function readMatch(result: Record<string, unknown>): MatchDetail | null {
  if (!Array.isArray(result.components) || typeof result.method !== "string") return null;
  return result as unknown as MatchDetail;
}

/** Rebuilds a reviewable analysis from a stored (public) analysis record. */
export function analysisToResume(a: AnalysisRecord): ResumeAnalysis | null {
  const r = a.result as unknown as {
    extraction?: ResumeExtraction;
    warnings?: string[];
    file?: { filename?: string; pages?: number };
    text_chars?: number;
  };
  if (!r.extraction || !r.file) return null;
  return {
    analysis_id: a.id,
    candidate_id: a.candidate_id,
    provider: a.provider,
    model: a.model,
    is_confirmed: a.is_confirmed,
    filename: r.file.filename ?? "resume.pdf",
    pages: r.file.pages ?? 0,
    text_chars: r.text_chars ?? 0,
    extraction: r.extraction,
    warnings: r.warnings ?? [],
    created_at: a.created_at,
  };
}
