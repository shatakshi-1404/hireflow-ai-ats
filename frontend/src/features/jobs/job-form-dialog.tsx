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
import {
  emptyToNull,
  isValidOptionalNumber,
  isValidSkillList,
  parseList,
  parseOptionalNumber,
} from "@/lib/format";
import {
  EMPLOYMENT_LABEL,
  EMPLOYMENT_TYPES,
  JOB_STATUS_LABEL,
  JOB_STATUSES,
} from "@/lib/stages";
import type { Job } from "@/types/api";
import { type JobPayload, useCreateJob, useUpdateJob } from "./api";

const skills = z.string().refine(isValidSkillList, "Up to 100 skills, each 60 characters or fewer");
const years = z.string().refine((v) => isValidOptionalNumber(v, 0, 60), "Enter a number between 0 and 60");

const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160, "Keep it under 160 characters"),
    department: z.string().trim().max(80, "Keep it under 80 characters"),
    location: z.string().trim().max(120, "Keep it under 120 characters"),
    employment_type: z.enum(EMPLOYMENT_TYPES),
    status: z.enum(JOB_STATUSES),
    description: z.string().trim().min(1, "Description is required").max(10000, "Keep it under 10,000 characters"),
    required_skills: skills,
    preferred_skills: skills,
    min_experience: years,
    max_experience: years,
  })
  .refine(
    (v) => {
      const lo = parseOptionalNumber(v.min_experience);
      const hi = parseOptionalNumber(v.max_experience);
      return lo === null || hi === null || hi >= lo;
    },
    { path: ["max_experience"], message: "Must be at least the minimum" },
  );
type Values = z.infer<typeof schema>;

function defaults(j?: Job): Values {
  return {
    title: j?.title ?? "",
    department: j?.department ?? "",
    location: j?.location ?? "",
    employment_type: j?.employment_type ?? "FULL_TIME",
    status: j?.status ?? "OPEN",
    description: j?.description ?? "",
    required_skills: j?.required_skills.join(", ") ?? "",
    preferred_skills: j?.preferred_skills.join(", ") ?? "",
    min_experience: j?.min_experience?.toString() ?? "",
    max_experience: j?.max_experience?.toString() ?? "",
  };
}

function toPayload(v: Values): JobPayload {
  return {
    title: v.title.trim(),
    department: emptyToNull(v.department),
    location: emptyToNull(v.location),
    employment_type: v.employment_type,
    status: v.status,
    description: v.description.trim(),
    required_skills: parseList(v.required_skills),
    preferred_skills: parseList(v.preferred_skills),
    min_experience: parseOptionalNumber(v.min_experience),
    max_experience: parseOptionalNumber(v.max_experience),
  };
}

function JobForm({ job, onClose }: { job?: Job; onClose: () => void }) {
  const create = useCreateJob();
  const update = useUpdateJob();
  const [formError, setFormError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(job) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => {
        toast.success(job ? "Job updated" : "Job created");
        onClose();
      },
      onError: (err: Error) => setFormError(err.message),
    };
    if (job) update.mutate({ id: job.id, changes: payload }, handlers);
    else create.mutate(payload, handlers);
  });

  const invalid = (name: keyof Values) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <FormAlert message={formError} />}
      <Field id="title" label="Job title" error={errors.title?.message}>
        <Input id="title" {...invalid("title")} {...register("title")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="department" label="Department" error={errors.department?.message}>
          <Input id="department" {...invalid("department")} {...register("department")} />
        </Field>
        <Field id="location" label="Location" error={errors.location?.message}>
          <Input id="location" {...invalid("location")} {...register("location")} />
        </Field>
        <Field id="employment_type" label="Employment type" error={errors.employment_type?.message}>
          <Controller
            control={control}
            name="employment_type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="employment_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EMPLOYMENT_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="status" label="Status" error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {JOB_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="min_experience" label="Min. experience (years)" error={errors.min_experience?.message}>
          <Input id="min_experience" inputMode="decimal" {...invalid("min_experience")} {...register("min_experience")} />
        </Field>
        <Field id="max_experience" label="Max. experience (years)" error={errors.max_experience?.message}>
          <Input id="max_experience" inputMode="decimal" {...invalid("max_experience")} {...register("max_experience")} />
        </Field>
      </div>
      <Field
        id="required_skills"
        label="Required skills"
        error={errors.required_skills?.message}
        hint="Separate with commas."
      >
        <Input id="required_skills" {...invalid("required_skills")} {...register("required_skills")} />
      </Field>
      <Field id="preferred_skills" label="Preferred skills" error={errors.preferred_skills?.message}>
        <Input id="preferred_skills" {...invalid("preferred_skills")} {...register("preferred_skills")} />
      </Field>
      <Field id="description" label="Description" error={errors.description?.message}>
        <Textarea id="description" rows={6} {...invalid("description")} {...register("description")} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {job ? "Save changes" : "Create job"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function JobFormDialog({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Job;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit job" : "Create job"}</DialogTitle>
          <DialogDescription>
            Only open jobs accept new applications. Skills drive candidate matching later.
          </DialogDescription>
        </DialogHeader>
        <JobForm job={job} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
