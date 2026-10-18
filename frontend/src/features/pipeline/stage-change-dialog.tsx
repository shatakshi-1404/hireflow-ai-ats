import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CLOSED_STAGES, STAGE_LABEL } from "@/lib/stages";
import type { ApplicationRow, ApplicationStage } from "@/types/api";

export interface PendingMove {
  app: ApplicationRow;
  to: ApplicationStage;
}

/** Moves that need the dialog: into a closed stage (reason optional) or out of one (reason required). */
export function needsDialog(from: ApplicationStage, to: ApplicationStage): boolean {
  return CLOSED_STAGES.includes(from) || CLOSED_STAGES.includes(to);
}

function Body({
  move,
  pending,
  onCancel,
  onConfirm,
}: {
  move: PendingMove;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const reopening = CLOSED_STAGES.includes(move.app.stage);
  const [reason, setReason] = useState("");
  const missing = reopening && reason.trim() === "";

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {reopening ? "Reopen application" : `Move to ${STAGE_LABEL[move.to]}`}
        </DialogTitle>
        <DialogDescription>
          {move.app.candidate_name} · {move.app.job_title}: {STAGE_LABEL[move.app.stage]} →{" "}
          {STAGE_LABEL[move.to]}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="stage-reason">
          Reason {reopening ? "(required)" : "(optional)"}
        </Label>
        <Textarea
          id="stage-reason"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-required={reopening}
          placeholder={
            reopening ? "Why is this application being reopened?" : "Recorded in the stage history"
          }
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(reason.trim() || null)}
          disabled={pending || missing}
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Confirm move
        </Button>
      </DialogFooter>
    </>
  );
}

export function StageChangeDialog({
  move,
  pending,
  onCancel,
  onConfirm,
}: {
  move: PendingMove | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  return (
    <Dialog
      open={move !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent>
        {move && (
          <Body
            key={`${move.app.id}-${move.to}`}
            move={move}
            pending={pending}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
