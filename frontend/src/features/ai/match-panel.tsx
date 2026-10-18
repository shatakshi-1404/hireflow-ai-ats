import { LoaderCircle, Target } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/format";
import type { Job } from "@/types/api";
import { useAnalyses, useRunMatch } from "./api";
import { readMatch } from "./helpers";
import { MatchResultView } from "./match-result-view";

export function MatchPanel({ candidateId, jobs, writer }: { candidateId: string; jobs: Job[]; writer: boolean }) {
  const [jobId, setJobId] = useState("");
  const run = useRunMatch();
  const stored = useAnalyses({ candidateId, kind: "JOB_MATCH", jobId, limit: 1, enabled: jobId !== "" });

  const fresh = run.data && run.data.job_id === jobId ? run.data : null;
  const latest = stored.data?.[0];
  const match = fresh ?? (latest ? readMatch(latest.result) : null);
  const when = fresh?.created_at ?? latest?.created_at;

  function onJobChange(value: string) {
    run.reset();
    setJobId(value);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="match-job">Job</Label>
          <Select value={jobId} onValueChange={onJobChange}>
            <SelectTrigger id="match-job" className="w-72">
              <SelectValue placeholder="Choose a job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                  {j.status === "CLOSED" ? " (closed)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {writer && (
          <Button
            disabled={!jobId || run.isPending}
            onClick={() => run.mutate({ candidate_id: candidateId, job_id: jobId })}
          >
            {run.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Target className="h-4 w-4" aria-hidden="true" />
            )}
            {match ? "Re-run match" : "Run match"}
          </Button>
        )}
      </div>

      {run.error && <FormAlert message={run.error.message} />}

      {!jobId ? (
        <EmptyState
          icon={Target}
          title="Choose a job to compare"
          description="You'll see which required skills are evidenced, which are unverified, and exactly how the score is built."
        />
      ) : stored.isPending && !fresh ? (
        <Skeleton className="h-48 w-full" />
      ) : match ? (
        <>
          {when && (
            <p className="text-xs text-muted-foreground">
              Calculated {timeAgo(when)}. The score can be out of date if the profile or job has changed since.
            </p>
          )}
          <MatchResultView match={match} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {writer ? "No match has been run for this job yet." : "No match has been run for this job."}
        </p>
      )}
    </div>
  );
}
