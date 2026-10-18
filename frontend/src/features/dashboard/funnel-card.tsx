import { STAGE_LABEL } from "@/lib/stages";
import type { PipelineStats } from "@/types/api";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function Funnel({ stats }: { stats: PipelineStats }) {
  const max = Math.max(1, ...stats.funnel.map((s) => s.reached));
  return (
    <div>
      <ol className="space-y-3">
        {stats.funnel.map((step) => (
          <li key={step.stage}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-800">{STAGE_LABEL[step.stage]}</span>
              <span className="tabular-nums text-slate-600">
                {step.reached}
                <span className="ml-2 text-xs text-muted-foreground">
                  {step.conversion_from_previous === null ? "" : `${pct(step.conversion_from_previous)} of previous`}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100" aria-hidden="true">
              <div
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${(step.reached / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        {stats.definitions.funnel ?? "Applications that ever reached each stage."}
      </p>
    </div>
  );
}
