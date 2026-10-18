import { Download, FileText, Upload } from "lucide-react";
import { useState } from "react";
import { Pill } from "@/components/common/badges";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/format";
import type { CandidateDetail, ResumeAnalysis } from "@/types/api";
import { useAnalyses } from "./api";
import { analysisToResume } from "./helpers";
import { ProviderBadge } from "./provider-badge";
import { ResumeReviewDialog } from "./resume-review-dialog";
import { ResumeUploadDialog } from "./resume-upload-dialog";

export function ResumeSection({ candidate, writer }: { candidate: CandidateDetail; writer: boolean }) {
  const analyses = useAnalyses({ candidateId: candidate.id, kind: "RESUME_ANALYSIS", limit: 10 });
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState<ResumeAnalysis | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
          {candidate.resume_filename ? (
            <div>
              <p className="text-sm font-medium text-slate-900">{candidate.resume_filename}</p>
              <a
                href={`/api/v1/candidates/${candidate.id}/resume`}
                download
                className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No resume on file.</p>
          )}
        </div>
        {writer && (
          <Button onClick={() => setUploading(true)}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload and analyze
          </Button>
        )}
      </div>

      <section aria-labelledby="analysis-history">
        <h3 id="analysis-history" className="mb-2 text-sm font-medium text-slate-900">
          Analyses
        </h3>
        {analyses.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : analyses.isError ? (
          <ErrorState message={analyses.error.message} onRetry={() => void analyses.refetch()} />
        ) : analyses.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resume has been analyzed yet.</p>
        ) : (
          <ul className="space-y-2">
            {analyses.data.map((a) => {
              const resume = analysisToResume(a);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">{resume?.filename ?? "Resume"}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{timeAgo(a.created_at)}</span>
                      <ProviderBadge provider={a.provider} model={a.model} />
                      <Pill
                        className={
                          a.is_confirmed
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-amber-50 text-amber-800 ring-amber-200"
                        }
                      >
                        {a.is_confirmed ? "Confirmed" : "Awaiting review"}
                      </Pill>
                    </div>
                  </div>
                  {writer && !a.is_confirmed && resume && (
                    <Button size="sm" variant="outline" onClick={() => setReviewing(resume)}>
                      Review
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ResumeUploadDialog
        open={uploading}
        onOpenChange={setUploading}
        candidateId={candidate.id}
        onAnalyzed={(a) => {
          setUploading(false);
          setReviewing(a);
        }}
      />
      <ResumeReviewDialog
        analysis={reviewing}
        candidate={candidate}
        onOpenChange={(open) => !open && setReviewing(null)}
      />
    </div>
  );
}
