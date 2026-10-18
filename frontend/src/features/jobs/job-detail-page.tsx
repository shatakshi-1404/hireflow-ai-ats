import { ArrowLeft, Lock, LockOpen, Pencil, SearchX, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { JobStatusBadge, SkillChips, StageBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Pagination } from "@/components/data-table/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApplications } from "@/features/applications/api";
import { useCurrentUser } from "@/features/auth/user-context";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { canWrite } from "@/lib/permissions";
import { EMPLOYMENT_LABEL, STAGE_LABEL, STAGES } from "@/lib/stages";
import { useJob, useUpdateJob } from "./api";
import { JobFormDialog } from "./job-form-dialog";

const PAGE_SIZE = 15;

function Applicants({ jobId }: { jobId: string }) {
  const [page, setPage] = useState(1);
  const apps = useApplications({ job_id: jobId, page, page_size: PAGE_SIZE });

  if (apps.isPending) return <Skeleton className="h-40 w-full" />;
  if (apps.isError)
    return <ErrorState message={apps.error.message} onRetry={() => void apps.refetch()} />;
  if (apps.data.total === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No applicants yet"
        description="Add candidates to this job from their profile page."
      />
    );
  }
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="hidden md:table-cell">Match</TableHead>
            <TableHead className="hidden sm:table-cell">Experience</TableHead>
            <TableHead className="hidden md:table-cell">Applied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.data.items.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={a.candidate_name} size="sm" />
                  <Link
                    to={`/candidates/${a.candidate_id}`}
                    className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                  >
                    {a.candidate_name}
                  </Link>
                </div>
              </TableCell>
              <TableCell>
                <StageBadge stage={a.stage} />
              </TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">
                {a.match_score !== null ? Math.round(a.match_score) : "—"}
              </TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">
                {a.candidate_years_experience !== null ? `${a.candidate_years_experience} yrs` : "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDate(a.applied_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={apps.data.page}
        pages={apps.data.pages}
        total={apps.data.total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}

export function JobDetailPage() {
  const { id = "" } = useParams();
  const writer = canWrite(useCurrentUser());
  const query = useJob(id);
  const update = useUpdateJob();
  const [editing, setEditing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          icon={SearchX}
          title="Job not found"
          description="It may have been removed, or the link is wrong."
          action={
            <Button asChild>
              <Link to="/jobs">Back to jobs</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ErrorState title="Couldn't load this job" message={query.error.message} onRetry={() => void query.refetch()} />
    );
  }

  const job = query.data;
  const closed = job.status === "CLOSED";

  function setStatus(status: "OPEN" | "CLOSED") {
    update.mutate(
      { id: job.id, changes: { status } },
      {
        onSuccess: () => {
          toast.success(status === "CLOSED" ? "Job closed" : "Job reopened");
          setConfirmClose(false);
        },
        onError: (e) => {
          toast.error(e.message);
          setConfirmClose(false);
        },
      },
    );
  }

  const range =
    job.min_experience !== null || job.max_experience !== null
      ? `${job.min_experience ?? 0}–${job.max_experience ?? "+"} yrs`
      : null;

  return (
    <>
      <Link
        to="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Jobs
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{job.title}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[job.department, job.location, EMPLOYMENT_LABEL[job.employment_type], range]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {writer && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
            {closed ? (
              <Button variant="outline" onClick={() => setStatus("OPEN")} disabled={update.isPending}>
                <LockOpen className="h-4 w-4" aria-hidden="true" />
                Reopen
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmClose(true)}>
                <Lock className="h-4 w-4" aria-hidden="true" />
                Close job
              </Button>
            )}
          </div>
        )}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {STAGES.map((s) => (
          <div key={s} className="rounded-lg border bg-white px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{STAGE_LABEL[s]}</dt>
            <dd className="text-xl font-semibold tabular-nums text-slate-900">{job.stage_counts[s] ?? 0}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit lg:order-2">
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="mb-1.5 font-medium text-slate-900">Required skills</h3>
              <SkillChips skills={job.required_skills} max={20} />
            </div>
            <div>
              <h3 className="mb-1.5 font-medium text-slate-900">Preferred skills</h3>
              <SkillChips skills={job.preferred_skills} max={20} />
            </div>
            <p className="text-xs text-muted-foreground">Created {formatDate(job.created_at)}</p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:order-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Applicants ({job.applicant_count})</CardTitle>
            </CardHeader>
            <Applicants jobId={job.id} />
          </Card>
        </div>
      </div>

      <JobFormDialog open={editing} onOpenChange={setEditing} job={job} />
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this job?"
        description="Closed jobs stop accepting new applications. Existing applicants stay in their stages, and you can reopen the job later."
        confirmLabel="Close job"
        pending={update.isPending}
        onConfirm={() => setStatus("CLOSED")}
      />
    </>
  );
}
