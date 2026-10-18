import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field, FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveApplications } from "@/features/applications/api";
import { useCurrentUser } from "@/features/auth/user-context";
import { useTeam } from "@/features/settings/api";
import { emptyToNull } from "@/lib/format";
import {
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABEL,
  fromLocalInputValue,
  toLocalInputValue,
} from "@/lib/interviews";
import type { Interview } from "@/types/api";
import {
  type InterviewChanges,
  type InterviewPayload,
  useCreateInterview,
  useUpdateInterview,
} from "./api";

const schema = z.object({
  application_id: z.string().min(1, "Choose an application"),
  interviewer_name: z.string().trim().min(1, "Interviewer is required").max(120, "Keep it under 120 characters"),
  interview_type: z.enum(INTERVIEW_TYPES),
  scheduled_at: z
    .string()
    .min(1, "Choose a date and time")
    .refine((v) => fromLocalInputValue(v) !== null, "Enter a valid date and time"),
  duration_minutes: z
    .string()
    .refine((v) => /^\d+$/.test(v.trim()) && Number(v) >= 5 && Number(v) <= 480, "Enter 5–480 minutes"),
  meeting_link: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://"),
  notes: z.string().trim().max(5000, "Keep it under 5,000 characters"),
});
type Values = z.infer<typeof schema>;

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInputValue(d.toISOString());
}

function NotesOnlyForm({ interview, onClose }: { interview: Interview; onClose: () => void }) {
  const update = useUpdateInterview();
  const [notes, setNotes] = useState(interview.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: interview.id, changes: { notes: emptyToNull(notes) } },
      {
        onSuccess: () => {
          toast.success("Notes saved");
          onClose();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
        This interview is {INTERVIEW_STATUS_LABEL[interview.status].toLowerCase()}, so only its notes can be edited.
      </p>
      {update.error && <FormAlert message={update.error.message} />}
      <div className="space-y-1.5">
        <label htmlFor="interview-notes" className="text-sm font-medium">
          Notes
        </label>
        <Textarea
          id="interview-notes"
          rows={5}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save notes
        </Button>
      </DialogFooter>
    </form>
  );
}

function InterviewForm({
  interview,
  presetApplicationId,
  onClose,
}: {
  interview?: Interview;
  presetApplicationId?: string;
  onClose: () => void;
}) {
  const user = useCurrentUser();
  const team = useTeam();
  const apps = useActiveApplications(!interview);
  const create = useCreateInterview();
  const update = useUpdateInterview();
  const [formError, setFormError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      application_id: interview?.application_id ?? presetApplicationId ?? "",
      interviewer_name: interview?.interviewer_name ?? user.full_name,
      interview_type: interview?.interview_type ?? "TECHNICAL",
      scheduled_at: interview ? toLocalInputValue(interview.scheduled_at) : defaultStart(),
      duration_minutes: String(interview?.duration_minutes ?? 45),
      meeting_link: interview?.meeting_link ?? "",
      notes: interview?.notes ?? "",
    },
  });

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const when = fromLocalInputValue(v.scheduled_at);
    if (!when) return;
    const timeChanged = !interview || toLocalInputValue(interview.scheduled_at) !== v.scheduled_at;
    if (timeChanged && when.getTime() <= Date.now()) {
      setError("scheduled_at", { message: "Choose a time in the future" });
      return;
    }
    const name = v.interviewer_name.trim();
    const teammate = team.data?.find(
      (u) => u.is_active && u.full_name.toLowerCase() === name.toLowerCase(),
    );
    const common = {
      interviewer_name: name,
      interviewer_id: teammate?.id ?? null,
      interview_type: v.interview_type,
      duration_minutes: Number(v.duration_minutes),
      meeting_link: emptyToNull(v.meeting_link),
      notes: emptyToNull(v.notes),
    };
    const handlers = {
      onSuccess: () => {
        toast.success(interview ? "Interview updated" : "Interview scheduled");
        onClose();
      },
      onError: (err: Error) => setFormError(err.message),
    };
    if (interview) {
      const changes: InterviewChanges = { ...common };
      if (timeChanged) changes.scheduled_at = when.toISOString();
      update.mutate({ id: interview.id, changes }, handlers);
    } else {
      const payload: InterviewPayload = {
        ...common,
        application_id: v.application_id,
        scheduled_at: when.toISOString(),
      };
      create.mutate(payload, handlers);
    }
  });

  const invalid = (name: keyof Values) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <FormAlert message={formError} />}

      <Field id="application_id" label="Candidate and job" error={errors.application_id?.message}>
        {interview ? (
          <p className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
            {interview.candidate_name} · {interview.job_title}
          </p>
        ) : (
          <Controller
            control={control}
            name="application_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="application_id" className="w-full">
                  <SelectValue placeholder={apps.isPending ? "Loading…" : "Choose an active application"} />
                </SelectTrigger>
                <SelectContent>
                  {apps.data?.items.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.candidate_name} · {a.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      {apps.isError && <FormAlert message={apps.error.message} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="interviewer_name" label="Interviewer" error={errors.interviewer_name?.message}>
          <Input
            id="interviewer_name"
            list="interviewer-options"
            autoComplete="off"
            {...invalid("interviewer_name")}
            {...register("interviewer_name")}
          />
          <datalist id="interviewer-options">
            {team.data
              ?.filter((u) => u.is_active)
              .map((u) => (
                <option key={u.id} value={u.full_name} />
              ))}
          </datalist>
        </Field>
        <Field id="interview_type" label="Type" error={errors.interview_type?.message}>
          <Controller
            control={control}
            name="interview_type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="interview_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INTERVIEW_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          id="scheduled_at"
          label="Date and time"
          error={errors.scheduled_at?.message}
          hint="In your local time zone."
        >
          <Input id="scheduled_at" type="datetime-local" {...invalid("scheduled_at")} {...register("scheduled_at")} />
        </Field>
        <Field id="duration_minutes" label="Duration (minutes)" error={errors.duration_minutes?.message}>
          <Input id="duration_minutes" inputMode="numeric" {...invalid("duration_minutes")} {...register("duration_minutes")} />
        </Field>
      </div>
      <Field id="meeting_link" label="Meeting link" error={errors.meeting_link?.message}>
        <Input id="meeting_link" type="url" placeholder="https://" {...invalid("meeting_link")} {...register("meeting_link")} />
      </Field>
      <Field id="notes" label="Notes" error={errors.notes?.message}>
        <Textarea id="notes" rows={3} {...invalid("notes")} {...register("notes")} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {interview ? "Save changes" : "Schedule interview"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function InterviewFormDialog({
  open,
  onOpenChange,
  interview,
  applicationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview?: Interview;
  applicationId?: string;
}) {
  const locked = interview !== undefined && interview.status !== "SCHEDULED";
  const close = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {!interview ? "Schedule interview" : locked ? "Interview notes" : "Edit interview"}
          </DialogTitle>
          <DialogDescription>
            {interview
              ? `${interview.candidate_name} · ${interview.job_title}`
              : "Only applications that are still active can be scheduled."}
          </DialogDescription>
        </DialogHeader>
        {interview && locked ? (
          <NotesOnlyForm interview={interview} onClose={close} />
        ) : (
          <InterviewForm interview={interview} presetApplicationId={applicationId} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}
