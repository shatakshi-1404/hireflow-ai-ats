import type { ApplicationStage, EmploymentType, JobStatus } from "@/types/api";

export const STAGES = [
  "APPLIED",
  "SCREENING",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const STAGE_STYLE: Record<ApplicationStage, string> = {
  APPLIED: "bg-slate-100 text-slate-700 ring-slate-200",
  SCREENING: "bg-sky-50 text-sky-800 ring-sky-200",
  SHORTLISTED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  INTERVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  OFFER: "bg-teal-50 text-teal-800 ring-teal-200",
  HIRED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  WITHDRAWN: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export const JOB_STATUSES = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED"] as const;

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

export const JOB_STATUS_STYLE: Record<JobStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  OPEN: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ON_HOLD: "bg-amber-50 text-amber-800 ring-amber-200",
  CLOSED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] as const;

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export function stageLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value in STAGE_LABEL ? STAGE_LABEL[value as ApplicationStage] : value;
}

export const CLOSED_STAGES: readonly ApplicationStage[] = ["REJECTED", "WITHDRAWN"];

export function isStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export const STAGE_COLOR: Record<ApplicationStage, string> = {
  APPLIED: "#94a3b8",
  SCREENING: "#38bdf8",
  SHORTLISTED: "#818cf8",
  INTERVIEW: "#fbbf24",
  OFFER: "#14b8a6",
  HIRED: "#059669",
  REJECTED: "#fb7185",
  WITHDRAWN: "#a1a1aa",
};
