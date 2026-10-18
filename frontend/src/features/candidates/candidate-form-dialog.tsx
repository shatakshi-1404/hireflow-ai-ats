import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  emptyToNull,
  isValidOptionalNumber,
  isValidSkillList,
  parseList,
  parseOptionalNumber,
} from "@/lib/format";
import type { Candidate } from "@/types/api";
import { type CandidatePayload, useCreateCandidate, useUpdateCandidate } from "./api";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120, "Keep it under 120 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().trim().max(32, "Keep it under 32 characters"),
  current_title: z.string().trim().max(120, "Keep it under 120 characters"),
  skills: z
    .string()
    .refine(isValidSkillList, "Up to 100 skills, each 60 characters or fewer"),
  years_experience: z
    .string()
    .refine((v) => isValidOptionalNumber(v, 0, 60), "Enter a number between 0 and 60"),
  source: z.string().trim().max(60, "Keep it under 60 characters"),
  experience_summary: z.string().trim().max(5000, "Keep it under 5,000 characters"),
});
type Values = z.infer<typeof schema>;

function defaults(c?: Candidate): Values {
  return {
    full_name: c?.full_name ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    current_title: c?.current_title ?? "",
    skills: c?.skills.join(", ") ?? "",
    years_experience: c?.years_experience?.toString() ?? "",
    source: c?.source ?? "",
    experience_summary: c?.experience_summary ?? "",
  };
}

function toPayload(v: Values): CandidatePayload {
  return {
    full_name: v.full_name.trim(),
    email: v.email.trim(),
    phone: emptyToNull(v.phone),
    current_title: emptyToNull(v.current_title),
    skills: parseList(v.skills),
    years_experience: parseOptionalNumber(v.years_experience),
    experience_summary: emptyToNull(v.experience_summary),
    source: emptyToNull(v.source),
  };
}

function CandidateForm({ candidate, onClose }: { candidate?: Candidate; onClose: () => void }) {
  const create = useCreateCandidate();
  const update = useUpdateCandidate();
  const [formError, setFormError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(candidate) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => {
        toast.success(candidate ? "Candidate updated" : "Candidate added");
        onClose();
      },
      onError: (err: Error) => {
        if (err instanceof ApiError && err.status === 409) setError("email", { message: err.message });
        else setFormError(err.message);
      },
    };
    if (candidate) update.mutate({ id: candidate.id, changes: payload }, handlers);
    else create.mutate(payload, handlers);
  });

  const invalid = (name: keyof Values) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <FormAlert message={formError} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Full name" error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="off" {...invalid("full_name")} {...register("full_name")} />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="off" {...invalid("email")} {...register("email")} />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone?.message}>
          <Input id="phone" autoComplete="off" {...invalid("phone")} {...register("phone")} />
        </Field>
        <Field id="current_title" label="Current title" error={errors.current_title?.message}>
          <Input id="current_title" {...invalid("current_title")} {...register("current_title")} />
        </Field>
        <Field
          id="years_experience"
          label="Years of experience"
          error={errors.years_experience?.message}
        >
          <Input
            id="years_experience"
            inputMode="decimal"
            {...invalid("years_experience")}
            {...register("years_experience")}
          />
        </Field>
        <Field id="source" label="Source" error={errors.source?.message} hint="e.g. Referral, LinkedIn">
          <Input id="source" {...invalid("source")} {...register("source")} />
        </Field>
      </div>
      <Field
        id="skills"
        label="Skills"
        error={errors.skills?.message}
        hint="Separate with commas. Stored in lowercase."
      >
        <Input id="skills" {...invalid("skills")} {...register("skills")} />
      </Field>
      <Field id="experience_summary" label="Experience summary" error={errors.experience_summary?.message}>
        <Textarea
          id="experience_summary"
          rows={4}
          {...invalid("experience_summary")}
          {...register("experience_summary")}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {candidate ? "Save changes" : "Add candidate"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CandidateFormDialog({
  open,
  onOpenChange,
  candidate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{candidate ? "Edit candidate" : "Add candidate"}</DialogTitle>
          <DialogDescription>
            {candidate
              ? "Update this candidate's profile."
              : "Create a candidate record. You can attach them to jobs afterwards."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form always starts from fresh values. */}
        <CandidateForm candidate={candidate} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
