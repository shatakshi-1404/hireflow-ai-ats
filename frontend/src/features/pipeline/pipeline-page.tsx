import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Columns3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BOARD_LIMIT, useBoard, useChangeStage } from "@/features/applications/api";
import { useCurrentUser } from "@/features/auth/user-context";
import { useJobOptions } from "@/features/jobs/api";
import { canWrite } from "@/lib/permissions";
import { STAGE_LABEL, STAGES, isStage } from "@/lib/stages";
import type { ApplicationRow, ApplicationStage } from "@/types/api";
import { CardView } from "./application-card";
import { type PendingMove, StageChangeDialog, needsDialog } from "./stage-change-dialog";
import { type DropState, StageColumn } from "./stage-column";

// Pointer position decides the target column; keyboard drags have no pointer, so fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-busy="true" aria-label="Loading pipeline">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-80 w-72 shrink-0" />
      ))}
    </div>
  );
}

export function PipelinePage() {
  const writer = canWrite(useCurrentUser());
  const [sp, setSp] = useSearchParams();
  const jobId = sp.get("job_id") ?? undefined;
  const jobs = useJobOptions();
  const board = useBoard(jobId);
  const change = useChangeStage(jobId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const items = board.data?.items;
  const byStage = useMemo(() => {
    const map = new Map<ApplicationStage, ApplicationRow[]>(
      STAGES.map((s): [ApplicationStage, ApplicationRow[]] => [s, []]),
    );
    for (const a of items ?? []) map.get(a.stage)?.push(a);
    return map;
  }, [items]);

  const activeApp = items?.find((a) => a.id === activeId) ?? null;
  const busy = change.isPending;

  function commit(app: ApplicationRow, to: ApplicationStage, reason: string | null) {
    change.mutate(
      { id: app.id, to_stage: to, reason },
      {
        onSuccess: () => {
          toast.success(`${app.candidate_name} moved to ${STAGE_LABEL[to]}`);
          setPendingMove(null);
        },
        onError: (err) => {
          toast.error(err.message);
          setPendingMove(null);
        },
      },
    );
  }

  function requestMove(app: ApplicationRow, to: ApplicationStage) {
    if (busy || app.stage === to) return;
    if (!app.allowed_next_stages.includes(to)) {
      const allowed = app.allowed_next_stages.map((s) => STAGE_LABEL[s]).join(", ") || "none";
      toast.error(
        `${app.candidate_name} can't move from ${STAGE_LABEL[app.stage]} to ${STAGE_LABEL[to]}. Allowed: ${allowed}.`,
      );
      return;
    }
    if (needsDialog(app.stage, to)) {
      setPendingMove({ app, to });
      return;
    }
    commit(app, to, null);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const app = items?.find((a) => a.id === e.active.id);
    const target = e.over?.id;
    if (app && isStage(target)) requestMove(app, target);
  }

  const nameOf = (id: string | number) => items?.find((a) => a.id === id)?.candidate_name ?? "Candidate";
  const labelOf = (id: string | number) => (isStage(id) ? STAGE_LABEL[id] : "no stage");
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${labelOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} dropped on ${labelOf(over.id)}.` : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Move of ${nameOf(active.id)} cancelled.`,
  };

  function dropStateFor(stage: ApplicationStage): DropState {
    if (!activeApp) return "idle";
    return activeApp.allowed_next_stages.includes(stage) ? "valid" : "invalid";
  }

  function setJob(value: string) {
    const next = new URLSearchParams(sp);
    if (value === "all") next.delete("job_id");
    else next.set("job_id", value);
    setSp(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          writer
            ? "Drag a card to another stage, or use its menu. Every move is validated and recorded by the server."
            : "A read-only view of every application by stage."
        }
        actions={
          <Select value={jobId ?? "all"} onValueChange={setJob}>
            <SelectTrigger className="w-56" aria-label="Filter by job">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.data?.items.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {board.isError ? (
        <ErrorState
          title="Couldn't load the pipeline"
          message={board.error.message}
          onRetry={() => void board.refetch()}
        />
      ) : board.isPending ? (
        <BoardSkeleton />
      ) : board.data.items.length === 0 ? (
        <EmptyState
          icon={Columns3}
          title="No applications yet"
          description="Add a candidate to a job from their profile and they will appear here."
          action={
            <Button asChild>
              <Link to="/candidates">Go to candidates</Link>
            </Button>
          }
        />
      ) : (
        <>
          {board.data.total > BOARD_LIMIT && (
            <p role="status" className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Showing the {BOARD_LIMIT} most recent of {board.data.total} applications. Filter by job to see
              the rest.
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={collision}
            accessibility={{ announcements }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex gap-4">
                {STAGES.map((stage) => (
                  <StageColumn
                    key={stage}
                    stage={stage}
                    apps={byStage.get(stage) ?? []}
                    canMove={writer}
                    busy={busy}
                    dropState={dropStateFor(stage)}
                    onMove={requestMove}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>{activeApp ? <CardView app={activeApp} overlay /> : null}</DragOverlay>
          </DndContext>
        </>
      )}

      <StageChangeDialog
        move={pendingMove}
        pending={busy}
        onCancel={() => setPendingMove(null)}
        onConfirm={(reason) => pendingMove && commit(pendingMove.app, pendingMove.to, reason)}
      />
    </>
  );
}
