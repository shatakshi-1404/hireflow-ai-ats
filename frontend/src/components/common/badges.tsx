import { cn } from "@/lib/utils";
import { JOB_STATUS_LABEL, JOB_STATUS_STYLE, STAGE_LABEL, STAGE_STYLE } from "@/lib/stages";
import type { ApplicationStage, JobStatus } from "@/types/api";

export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  return <Pill className={STAGE_STYLE[stage]}>{STAGE_LABEL[stage]}</Pill>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Pill className={JOB_STATUS_STYLE[status]}>{JOB_STATUS_LABEL[status]}</Pill>;
}

export function SkillChips({ skills, max = 3 }: { skills: string[]; max?: number }) {
  if (skills.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = skills.slice(0, max);
  const extra = skills.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {s}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-500"
          title={skills.slice(max).join(", ")}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
