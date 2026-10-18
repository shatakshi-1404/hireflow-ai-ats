import { useDroppable } from "@dnd-kit/core";
import { CLOSED_STAGES, STAGE_LABEL } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { ApplicationRow, ApplicationStage } from "@/types/api";
import { DraggableCard } from "./application-card";

export type DropState = "idle" | "valid" | "invalid";

export function StageColumn({
  stage,
  apps,
  canMove,
  busy,
  dropState,
  onMove,
}: {
  stage: ApplicationStage;
  apps: ApplicationRow[];
  canMove: boolean;
  busy: boolean;
  dropState: DropState;
  onMove: (app: ApplicationRow, to: ApplicationStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const closed = CLOSED_STAGES.includes(stage);

  return (
    <section
      aria-label={`${STAGE_LABEL[stage]} stage`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border p-2.5 transition",
        closed ? "border-dashed bg-slate-100/70" : "bg-slate-50",
        dropState === "invalid" && "opacity-50",
        dropState === "valid" && "border-brand-500/60",
        dropState === "valid" && isOver && "bg-teal-50 ring-2 ring-brand-500",
      )}
    >
      <header className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-800">{STAGE_LABEL[stage]}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600 ring-1 ring-inset ring-slate-200">
          {apps.length}
        </span>
      </header>
      <div ref={setNodeRef} className="max-h-[calc(100vh-17rem)] min-h-24 space-y-2.5 overflow-y-auto">
        {apps.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No candidates</p>
        ) : (
          apps.map((a) => (
            <DraggableCard key={a.id} app={a} canMove={canMove} busy={busy} onMove={onMove} />
          ))
        )}
      </div>
    </section>
  );
}
