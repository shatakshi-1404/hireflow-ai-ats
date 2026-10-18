import type { InterviewStatus, InterviewType } from "@/types/api";

export const INTERVIEW_TYPES = ["TECHNICAL", "BEHAVIORAL", "HR", "PANEL", "OTHER"] as const;
export const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  HR: "HR",
  PANEL: "Panel",
  OTHER: "Other",
};

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const INTERVIEW_STATUS_STYLE: Record<InterviewStatus, string> = {
  SCHEDULED: "bg-sky-50 text-sky-800 ring-sky-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  NO_SHOW: "bg-rose-50 text-rose-800 ring-rose-200",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant -> value for <input type="datetime-local"> in the viewer's local time. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) -> Date, or null when empty/invalid. */
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
