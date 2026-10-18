import { Copy, LoaderCircle, RefreshCw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import type { Difficulty, InterviewQuestion, Job, QuestionsRequest } from "@/types/api";
import { useAnalyses, useGenerateQuestions, useSaveQuestions } from "./api";
import { formatQuestions, readQuestions } from "./helpers";
import { ProviderBadge } from "./provider-badge";

const DURATIONS = ["15", "30", "45", "60", "90"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const CATEGORIES = ["mixed", "technical", "behavioral"] as const;

function pick<T extends string>(options: readonly T[], value: string, fallback: T): T {
  return options.find((o) => o === value) ?? fallback;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy automatically. Select the text and copy it manually.");
  }
}

function QuestionCard({ q, index }: { q: InterviewQuestion; index: number }) {
  return (
    <li className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">
          {index + 1}. {q.question}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Copy question ${index + 1}`}
          onClick={() => void copy(formatQuestions([q]).replace(/^1\./, `${index + 1}.`))}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill className="bg-slate-100 text-slate-700 ring-slate-200 capitalize">{q.category}</Pill>
        <Pill className="bg-slate-100 text-slate-700 ring-slate-200 capitalize">{q.difficulty}</Pill>
        {q.competencies.map((c) => (
          <span key={c} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs text-teal-800">
            {c}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-slate-700">Look for</p>
      <ul className="list-disc pl-5 text-sm text-slate-700">
        {q.evaluation_criteria.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {q.follow_up && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Follow-up:</span> {q.follow_up}
        </p>
      )}
    </li>
  );
}

function SavedSets({ candidateId, jobId }: { candidateId: string; jobId: string }) {
  const saved = useAnalyses({ candidateId, kind: "INTERVIEW_QUESTIONS", jobId, limit: 10, enabled: jobId !== "" });
  if (!jobId || !saved.data || saved.data.length === 0) return null;
  return (
    <section aria-labelledby="saved-questions" className="border-t pt-5">
      <h4 id="saved-questions" className="mb-2 text-sm font-medium text-slate-900">
        Saved sets for this job
      </h4>
      <ul className="space-y-2">
        {saved.data.map((a) => {
          const qs = readQuestions(a.result);
          return (
            <li key={a.id} className="rounded-lg border bg-white p-3 text-sm">
              <details>
                <summary className="cursor-pointer">
                  {formatDateTime(a.created_at)} · {qs.length} questions
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <ProviderBadge provider={a.provider} model={a.model} />
                    <Button variant="outline" size="sm" onClick={() => void copy(formatQuestions(qs))}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copy all
                    </Button>
                  </div>
                  <ul className="space-y-3">
                    {qs.map((q, i) => (
                      <QuestionCard key={q.question} q={q} index={i} />
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function InterviewCopilot({
  candidateId,
  jobs,
  writer,
}: {
  candidateId: string;
  jobs: Job[];
  writer: boolean;
}) {
  const [jobId, setJobId] = useState("");
  const [duration, setDuration] = useState("45");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [category, setCategory] = useState<QuestionsRequest["category"]>("mixed");
  const [variant, setVariant] = useState(0);
  const gen = useGenerateQuestions();
  const save = useSaveQuestions();

  const result = gen.data && gen.data.job_id === jobId ? gen.data : null;
  const saved = result !== null && save.isSuccess && save.variables.questions === result.questions;

  function generate(nextVariant: number) {
    save.reset();
    gen.mutate({
      candidate_id: candidateId,
      job_id: jobId,
      duration_minutes: Number(duration),
      difficulty,
      category,
      variant: nextVariant,
    });
  }

  function regenerate() {
    const next = variant + 1;
    setVariant(next);
    generate(next);
  }

  return (
    <div className="space-y-5">
      {writer ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="iq-job">Job</Label>
            <Select
              value={jobId}
              onValueChange={(v) => {
                gen.reset();
                save.reset();
                setJobId(v);
              }}
            >
              <SelectTrigger id="iq-job" className="w-full sm:w-72">
                <SelectValue placeholder="Choose a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iq-duration">Interview length</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="iq-duration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iq-difficulty">Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(pick(DIFFICULTIES, v, "medium"))}>
              <SelectTrigger id="iq-difficulty" className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iq-category">Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(pick(CATEGORIES, v, "mixed"))}>
              <SelectTrigger id="iq-category" className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!jobId || gen.isPending} onClick={() => generate(variant)}>
              {gen.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              Generate questions
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="iq-job-ro">Job (saved sets)</Label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger id="iq-job-ro" className="w-full sm:w-72">
              <SelectValue placeholder="Choose a job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {gen.error && <FormAlert message={gen.error.message} />}

      {result ? (
        <section aria-label="Generated questions" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ProviderBadge provider={result.provider} model={result.model} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={gen.isPending} onClick={regenerate}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copy(formatQuestions(result.questions))}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy all
              </Button>
              <Button
                size="sm"
                disabled={saved || save.isPending}
                onClick={() =>
                  save.mutate(
                    {
                      candidate_id: candidateId,
                      job_id: jobId,
                      provider: result.provider,
                      questions: result.questions,
                    },
                    { onSuccess: () => toast.success("Questions saved to this candidate") },
                  )
                }
              >
                {save.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saved ? "Saved" : "Save set"}
              </Button>
            </div>
          </div>
          {save.error && <FormAlert message={save.error.message} />}
          {result.warnings.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-sm text-amber-900">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <ul className="space-y-3">
            {result.questions.map((q, i) => (
              <QuestionCard key={`${variant}-${q.question}`} q={q} index={i} />
            ))}
          </ul>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">{result.disclaimer}</p>
        </section>
      ) : (
        !gen.isPending &&
        writer && (
          <EmptyState
            icon={Sparkles}
            title="Generate role-specific questions"
            description="Questions come from the job's required skills. Pick a job and settings, then generate."
          />
        )
      )}

      <SavedSets candidateId={candidateId} jobId={jobId} />
    </div>
  );
}
