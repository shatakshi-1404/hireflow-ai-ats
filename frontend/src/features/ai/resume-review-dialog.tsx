import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { emptyToNull, isValidOptionalNumber, isValidSkillList, parseList, parseOptionalNumber } from "@/lib/format";
import type { Candidate, ResumeAnalysis } from "@/types/api";
import { useConfirmResume } from "./api";
import { mergeSkills } from "./helpers";
import { ProviderBadge } from "./provider-badge";

const yearOk = (v: string) =>
  v.trim() === "" || (/^\d{4}$/.test(v.trim()) && Number(v) >= 1950 && Number(v) <= 2100);

const schema = z.object({
  skills: z.string().refine(isValidSkillList, "Up to 100 skills, each 60 characters or fewer"),
  years_experience: z.string().refine((v) => isValidOptionalNumber(v, 0, 60), "Enter a number between 0 and 60"),
  summary: z.string().trim().max(5000, "Keep it under 5,000 characters"),
  education: z
    .array(
      z.object({
        institution: z.string().trim().min(1, "Institution is required").max(160, "Keep it under 160 characters"),
        degree: z.string().trim().max(120, "Keep it under 120 characters"),
        field_of_study: z.string().trim().max(120, "Keep it under 120 characters"),
        year: z.string().refine(yearOk, "Enter a 4-digit year"),
      }),
    )
    .max(20),
});
type Values = z.infer<typeof schema>;

export type ReviewCandidate = Pick<Candidate, "skills" | "years_experience" | "experience_summary">;

function Body({
  analysis,
  candidate,
  onClose,
}: {
  analysis: ResumeAnalysis;
  candidate: ReviewCandidate;
  onClose: () => void;
}) {
  const confirm = useConfirmResume();
  const ext = analysis.extraction;
  const [work, setWork] = useState(ext.work_experience);
  const [projects, setProjects] = useState(ext.projects);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      skills: mergeSkills(candidate.skills, ext.skills).join(", "),
      years_experience: (ext.years_experience ?? candidate.years_experience)?.toString() ?? "",
      summary: ext.summary ?? candidate.experience_summary ?? "",
      education: ext.education.map((e) => ({
        institution: e.institution ?? "",
        degree: e.degree ?? "",
        field_of_study: e.field_of_study ?? "",
        year: e.year?.toString() ?? "",
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "education" });

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    confirm.mutate(
      {
        analysisId: analysis.analysis_id,
        profile: {
          skills: parseList(v.skills),
          years_experience: parseOptionalNumber(v.years_experience),
          summary: emptyToNull(v.summary),
          education: v.education.map((e) => ({
            institution: e.institution.trim(),
            degree: emptyToNull(e.degree),
            field_of_study: emptyToNull(e.field_of_study),
            year: e.year.trim() ? Number(e.year) : null,
          })),
          work_experience: work,
          projects,
        },
      },
      {
        onSuccess: () => {
          toast.success("Candidate profile updated from the resume");
          onClose();
        },
        onError: (err) => setFormError(err.message),
      },
    );
  });

  const notes = [...analysis.warnings, ...ext.uncertainties];
  const evidence = Object.entries(ext.skill_evidence);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {analysis.filename} · {analysis.pages} page{analysis.pages === 1 ? "" : "s"}
        </span>
        <ProviderBadge provider={analysis.provider} model={analysis.model} />
      </div>

      {notes.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            Check before confirming
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {formError && <FormAlert message={formError} />}

      <Field
        id="review_skills"
        label="Skills"
        error={errors.skills?.message}
        hint="Your current skills plus those found in the resume. This list replaces the candidate's skills."
      >
        <Input
          id="review_skills"
          aria-invalid={!!errors.skills}
          aria-describedby={errors.skills ? "review_skills-error" : undefined}
          {...register("skills")}
        />
      </Field>
      {evidence.length > 0 && (
        <details className="-mt-2 text-sm">
          <summary className="cursor-pointer text-brand-600">Where each skill was found</summary>
          <ul className="mt-2 space-y-1.5">
            {evidence.map(([skill, snippet]) => (
              <li key={skill}>
                <span className="font-medium">{skill}</span>
                <span className="text-muted-foreground"> · “{snippet}”</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Field
        id="review_years"
        label="Years of experience"
        error={errors.years_experience?.message}
        hint={
          ext.years_experience_evidence
            ? `Evidence: “${ext.years_experience_evidence}”`
            : "Leave blank to keep the current value."
        }
      >
        <Input
          id="review_years"
          inputMode="decimal"
          aria-invalid={!!errors.years_experience}
          aria-describedby={errors.years_experience ? "review_years-error" : undefined}
          {...register("years_experience")}
        />
      </Field>

      <Field
        id="review_summary"
        label="Summary"
        error={errors.summary?.message}
        hint="Leave blank to keep the current summary."
      >
        <Textarea id="review_summary" rows={3} {...register("summary")} />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Education</legend>
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            None found. Existing education is kept unless you add entries.
          </p>
        )}
        {fields.map((field, i) => {
          const rowErrors = errors.education?.[i];
          return (
            <div key={field.id} className="space-y-1.5 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={`Institution ${i + 1}`}
                  placeholder="Institution"
                  aria-invalid={!!rowErrors?.institution}
                  {...register(`education.${i}.institution`)}
                />
                <Input aria-label={`Degree ${i + 1}`} placeholder="Degree" {...register(`education.${i}.degree`)} />
                <Input
                  aria-label={`Field of study ${i + 1}`}
                  placeholder="Field of study"
                  {...register(`education.${i}.field_of_study`)}
                />
                <Input
                  aria-label={`Year ${i + 1}`}
                  placeholder="Year"
                  inputMode="numeric"
                  aria-invalid={!!rowErrors?.year}
                  {...register(`education.${i}.year`)}
                />
              </div>
              {(rowErrors?.institution || rowErrors?.year || rowErrors?.degree || rowErrors?.field_of_study) && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {rowErrors.institution?.message ??
                    rowErrors.year?.message ??
                    rowErrors.degree?.message ??
                    rowErrors.field_of_study?.message}
                </p>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                Remove entry {i + 1}
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ institution: "", degree: "", field_of_study: "", year: "" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add education
        </Button>
      </fieldset>

      {work.length > 0 && (
        <section aria-labelledby="review-work">
          <h3 id="review-work" className="mb-2 text-sm font-medium">
            Work experience
          </h3>
          <ul className="space-y-2">
            {work.map((w, i) => (
              <li key={`${w.title}-${w.company}-${i}`} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {[w.title, w.company].filter(Boolean).join(" · ") || "Entry"}
                    {w.period && <span className="font-normal text-muted-foreground"> · {w.period}</span>}
                  </p>
                  {w.description && <p className="break-words text-slate-700">{w.description}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Remove work entry ${i + 1}`}
                  onClick={() => setWork(work.filter((_, k) => k !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projects.length > 0 && (
        <section aria-labelledby="review-projects">
          <h3 id="review-projects" className="mb-2 text-sm font-medium">
            Projects
          </h3>
          <ul className="space-y-2">
            {projects.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{p.name ?? "Project"}</p>
                  {p.description && <p className="break-words text-slate-700">{p.description}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Remove project ${i + 1}`}
                  onClick={() => setProjects(projects.filter((_, k) => k !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={confirm.isPending}>
          Not now
        </Button>
        <Button type="submit" disabled={confirm.isPending}>
          {confirm.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Confirm and save profile
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ResumeReviewDialog({
  analysis,
  candidate,
  onOpenChange,
}: {
  analysis: ResumeAnalysis | null;
  candidate: ReviewCandidate;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={analysis !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review resume details</DialogTitle>
          <DialogDescription>
            Nothing is saved to the candidate until you confirm. Correct anything that looks wrong.
          </DialogDescription>
        </DialogHeader>
        {analysis && (
          <Body
            key={analysis.analysis_id}
            analysis={analysis}
            candidate={candidate}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
