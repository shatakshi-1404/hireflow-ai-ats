import { stageLabel } from "@/lib/stages";

interface ActivityLike {
  action: string;
  details: Record<string, unknown> | null;
}

const STATIC: Record<string, string> = {
  "workspace.created": "Workspace created",
  "user.created": "Team member added",
  "user.updated": "Team member updated",
  "candidate.updated": "Profile updated",
  "candidate.deleted": "Candidate deleted",
  "candidate.note_added": "Note added",
  "job.created": "Job created",
  "job.updated": "Job updated",
  "job.closed": "Job closed",
  "job.status_changed": "Job status changed",
  "interview.rescheduled": "Interview rescheduled",
  "interview.updated": "Interview updated",
};

export function describeActivity(a: ActivityLike): string {
  const d = a.details ?? {};
  const text = (key: string): string | null => {
    const v = d[key];
    return typeof v === "string" ? v : null;
  };
  switch (a.action) {
    case "candidate.created":
      return d.via === "csv_import" ? "Imported from CSV" : "Candidate added";
    case "candidate.imported":
      return `Imported ${typeof d.count === "number" ? d.count : ""} candidates from CSV`.replace("  ", " ");
    case "application.created":
      return `Applied to ${text("job_title") ?? "a job"}`;
    case "application.stage_changed": {
      const job = text("job_title");
      return `Moved from ${stageLabel(text("from"))} to ${stageLabel(text("to"))}${job ? ` (${job})` : ""}`;
    }
    case "interview.scheduled":
      return "Interview scheduled";
    case "interview.status_changed":
      return `Interview marked ${(text("status") ?? "updated").toLowerCase().replace("_", " ")}`;
    case "candidate.resume_analyzed":
      return "Resume analyzed (awaiting review)";
    case "candidate.resume_confirmed":
      return "Resume details confirmed";
    case "ai.match_run": {
      const job = text("job_title");
      const score = typeof d.score === "number" ? Math.round(d.score) : null;
      return `Match ${score === null ? "run" : `score ${score}`}${job ? ` for ${job}` : ""}`;
    }
    case "ai.questions_saved": {
      const job = text("job_title");
      return `Interview questions saved${job ? ` for ${job}` : ""}`;
    }
    default:
      return STATIC[a.action] ?? a.action.replace(/[._]/g, " ");
  }
}
