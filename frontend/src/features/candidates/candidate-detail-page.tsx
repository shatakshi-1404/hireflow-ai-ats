import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Briefcase,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserSearch,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Pill, StageBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreateApplication } from "@/features/applications/api";
import { useCurrentUser } from "@/features/auth/user-context";
import { useJobOptions } from "@/features/jobs/api";
import { ApiError } from "@/lib/api-client";
import { describeActivity } from "@/lib/activity";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { canWrite } from "@/lib/permissions";
import type { CandidateDetail } from "@/types/api";
import {
  useAddNote,
  useCandidate,
  useCandidateActivity,
  useDeleteCandidate,
  useNotes,
  useUpdateCandidate,
} from "./api";
import { CandidateAiWorkbench } from "@/features/ai/candidate-ai-workbench";
import { InterviewHistory } from "@/features/interviews/interview-history";
import { CandidateFormDialog } from "./candidate-form-dialog";

function ApplyBody({ candidate, onClose }: { candidate: CandidateDetail; onClose: () => void }) {
  const jobs = useJobOptions();
  const create = useCreateApplication();
  const [jobId, setJobId] = useState("");
  const applied = new Set(candidate.applications.map((a) => a.job_id));
  const options = (jobs.data?.items ?? []).filter((j) => j.status === "OPEN" && !applied.has(j.id));

  function submit() {
    create.mutate(
      { candidate_id: candidate.id, job_id: jobId },
      {
        onSuccess: () => {
          toast.success("Application created");
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      {jobs.isPending ? (
        <Skeleton className="h-9 w-full" />
      ) : jobs.isError ? (
        <ErrorState message={jobs.error.message} onRetry={() => void jobs.refetch()} />
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There are no open jobs this candidate hasn't already applied to.
        </p>
      ) : (
        <Select value={jobId} onValueChange={setJobId}>
          <SelectTrigger className="w-full" aria-label="Job">
            <SelectValue placeholder="Choose an open job" />
          </SelectTrigger>
          <SelectContent>
            {options.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!jobId || create.isPending}>
          {create.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Add to job
        </Button>
      </DialogFooter>
    </div>
  );
}

function NotesTab({ id, writer }: { id: string; writer: boolean }) {
  const notes = useNotes(id);
  const add = useAddNote(id);
  const [body, setBody] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    add.mutate(text, {
      onSuccess: () => {
        setBody("");
        toast.success("Note added");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="space-y-4">
      {writer && (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            aria-label="New note"
            placeholder="Add a note about this candidate…"
            rows={3}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>
            {add.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Add note
          </Button>
        </form>
      )}
      {notes.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : notes.isError ? (
        <ErrorState message={notes.error.message} onRetry={() => void notes.refetch()} />
      ) : notes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.data.map((n) => (
            <li key={n.id} className="rounded-lg border bg-white p-3">
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{n.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {n.author_name ?? "Former team member"} · {formatDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityTab({ id }: { id: string }) {
  const activity = useCandidateActivity(id);
  if (activity.isPending) return <Skeleton className="h-24 w-full" />;
  if (activity.isError)
    return <ErrorState message={activity.error.message} onRetry={() => void activity.refetch()} />;
  if (activity.data.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-4 border-l pl-5">
      {activity.data.map((a) => (
        <li key={a.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-brand-500" />
          <p className="text-sm text-slate-900">{describeActivity(a)}</p>
          <p className="text-xs text-muted-foreground">
            {a.actor_name ?? "System"} · <time dateTime={a.created_at}>{timeAgo(a.created_at)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}

function OverviewTab({
  c,
  writer,
  onApply,
}: {
  c: CandidateDetail;
  writer: boolean;
  onApply: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <p className="whitespace-pre-wrap text-slate-700">
              {c.experience_summary ?? <span className="text-muted-foreground">No summary added.</span>}
            </p>
            <div>
              <h3 className="mb-2 font-medium text-slate-900">Skills</h3>
              {c.skills.length === 0 ? (
                <p className="text-muted-foreground">No skills recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {c.skills.map((s) => (
                    <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-medium text-slate-900">Education</h3>
              {c.education && c.education.length > 0 ? (
                <ul className="space-y-1.5">
                  {c.education.map((e, i) => (
                    <li key={`${e.institution}-${i}`} className="text-slate-700">
                      {[e.degree, e.field_of_study].filter(Boolean).join(", ")}
                      {e.degree || e.field_of_study ? " · " : ""}
                      {e.institution}
                      {e.year ? ` (${e.year})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No education recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Applications</CardTitle>
          {writer && !c.is_archived && (
            <Button size="sm" variant="outline" onClick={onApply}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add to job
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {c.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not attached to any job yet.</p>
          ) : (
            <ul className="divide-y">
              {c.applications.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${a.job_id}`}
                      className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900 hover:text-brand-600 hover:underline"
                    >
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{a.job_title}</span>
                    </Link>
                    <p className="text-xs text-muted-foreground">
  Applied {formatDate(a.applied_at)}
  {a.match_score !== null && ` · Match ${Math.round(a.match_score)}`}
</p>
                  </div>
                  <StageBadge stage={a.stage} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CandidateDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const writer = canWrite(useCurrentUser());
  const query = useCandidate(id);
  const update = useUpdateCandidate();
  const remove = useDeleteCandidate();
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          icon={UserSearch}
          title="Candidate not found"
          description="They may have been deleted, or the link is wrong."
          action={
            <Button asChild>
              <Link to="/candidates">Back to candidates</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ErrorState
        title="Couldn't load this candidate"
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const c = query.data;

  function toggleArchive() {
    update.mutate(
      { id: c.id, changes: { is_archived: !c.is_archived } },
      {
        onSuccess: () => toast.success(c.is_archived ? "Candidate restored" : "Candidate archived"),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function confirmDelete() {
    remove.mutate(c.id, {
      onSuccess: () => {
        toast.success("Candidate deleted");
        void navigate("/candidates", { replace: true });
      },
      onError: (e) => {
        toast.error(e.message);
        setDeleting(false);
      },
    });
  }

  return (
    <>
      <Link
        to="/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Candidates
      </Link>

      <Card className="mb-6 py-0">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <InitialsAvatar name={c.full_name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{c.full_name}</h1>
                {c.is_archived && <Pill className="bg-zinc-100 text-zinc-600 ring-zinc-200">Archived</Pill>}
              </div>
              <p className="text-sm text-muted-foreground">
                {[c.current_title, c.years_experience !== null ? `${c.years_experience} yrs` : null, c.source]
                  .filter(Boolean)
                  .join(" · ") || "No title recorded"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {c.email}
                </a>
                {c.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {c.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          {writer && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
              <Button variant="outline" onClick={toggleArchive} disabled={update.isPending}>
                {c.is_archived ? (
                  <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Archive className="h-4 w-4" aria-hidden="true" />
                )}
                {c.is_archived ? "Restore" : "Archive"}
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="ai">AI tools</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab c={c} writer={writer} onApply={() => setApplying(true)} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesTab id={c.id} writer={writer} />
        </TabsContent>
        <TabsContent value="interviews" className="mt-4">
          <InterviewHistory candidateId={c.id} />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <CandidateAiWorkbench candidateId={c.id} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab id={c.id} />
        </TabsContent>
      </Tabs>

      <CandidateFormDialog open={editing} onOpenChange={setEditing} candidate={c} />
      <Dialog open={applying} onOpenChange={setApplying}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {c.full_name} to a job</DialogTitle>
            <DialogDescription>They start in the Applied stage.</DialogDescription>
          </DialogHeader>
          <ApplyBody candidate={c} onClose={() => setApplying(false)} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${c.full_name}?`}
        description="This permanently removes the candidate and their notes. If they have applications the server will refuse, and you should archive them instead."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
