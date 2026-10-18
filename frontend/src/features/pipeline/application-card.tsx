import { useDraggable } from "@dnd-kit/core";
import { CalendarDays, GripVertical, MoveRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SkillChips } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { STAGE_LABEL } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { ApplicationRow, ApplicationStage } from "@/types/api";

export function CardView({
  app,
  dragging = false,
  overlay = false,
  handle,
  menu,
}: {
  app: ApplicationRow;
  dragging?: boolean;
  overlay?: boolean;
  handle?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-3 shadow-sm",
        dragging && "opacity-40",
        overlay && "shadow-lg ring-2 ring-brand-500",
      )}
    >
      <div className="flex items-start gap-1.5">
        {handle}
        <div className="min-w-0 flex-1">
          <Link
            to={`/candidates/${app.candidate_id}`}
            className="block truncate text-sm font-medium text-slate-900 hover:text-brand-600 hover:underline"
          >
            {app.candidate_name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{app.job_title}</p>
        </div>
        {menu}
      </div>
      <div className="mt-2">
        <SkillChips skills={app.candidate_skills} max={3} />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {app.candidate_years_experience !== null ? `${app.candidate_years_experience} yrs` : "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {formatDate(app.applied_at)}
        </span>
      </div>
      {app.match_score !== null && (
        <p
          className="mt-2 text-xs font-medium text-teal-800"
          title="Heuristic relevance score. It is not a prediction of job performance."
        >
          Match score {Math.round(app.match_score)}
        </p>
      )}
    </article>
  );
}

function MoveMenu({
  app,
  disabled,
  onMove,
}: {
  app: ApplicationRow;
  disabled: boolean;
  onMove: (app: ApplicationRow, to: ApplicationStage) => void;
}) {
  if (app.allowed_next_stages.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={disabled}
          aria-label={`Move options for ${app.candidate_name}`}
        >
          <MoveRight className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {app.allowed_next_stages.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onMove(app, s)}>
            {STAGE_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DraggableCard({
  app,
  canMove,
  busy,
  onMove,
}: {
  app: ApplicationRow;
  canMove: boolean;
  busy: boolean;
  onMove: (app: ApplicationRow, to: ApplicationStage) => void;
}) {
  const movable = canMove && !busy && app.allowed_next_stages.length > 0;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: app.id,
    disabled: !movable,
  });

  return (
    <div ref={setNodeRef}>
      <CardView
        app={app}
        dragging={isDragging}
        handle={
          canMove ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Drag ${app.candidate_name}`}
              aria-disabled={!movable}
              className={cn(
                "mt-0.5 shrink-0 touch-none rounded p-0.5 text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                movable ? "cursor-grab hover:text-slate-700 active:cursor-grabbing" : "opacity-40",
              )}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : undefined
        }
        menu={canMove ? <MoveMenu app={app} disabled={busy} onMove={onMove} /> : undefined}
      />
    </div>
  );
}
