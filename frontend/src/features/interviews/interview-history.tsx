import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { INTERVIEW_TYPE_LABEL } from "@/lib/interviews";
import { useCandidateInterviews } from "./api";
import { InterviewStatusBadge } from "./interviews-page";

export function InterviewHistory({ candidateId }: { candidateId: string }) {
  const q = useCandidateInterviews(candidateId);
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  if (q.data.items.length === 0) return <p className="text-sm text-muted-foreground">No interviews yet.</p>;
  return (
    <ul className="space-y-3">
      {q.data.items.map((i) => (
        <li key={i.id} className="rounded-lg border bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">
              {INTERVIEW_TYPE_LABEL[i.interview_type]} · {i.job_title}
            </p>
            <InterviewStatusBadge interview={i} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            <time dateTime={i.scheduled_at}>{formatDateTime(i.scheduled_at)}</time> · {i.duration_minutes} min · with{" "}
            {i.interviewer_name}
          </p>
          {i.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{i.notes}</p>}
        </li>
      ))}
    </ul>
  );
}
