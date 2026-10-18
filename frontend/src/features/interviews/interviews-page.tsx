import { CalendarClock, ExternalLink, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Pill } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/data-table/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/features/auth/user-context";
import { formatDateTime, safeHttpUrl } from "@/lib/format";
import {
  INTERVIEW_STATUSES,
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_STATUS_STYLE,
  INTERVIEW_TYPE_LABEL,
} from "@/lib/interviews";
import { canWrite } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Interview, InterviewStatus } from "@/types/api";
import { INTERVIEWS_PAGE_SIZE, type InterviewView, useInterviews, useUpdateInterview } from "./api";
import { InterviewFormDialog } from "./interview-form-dialog";

export function InterviewStatusBadge({ interview }: { interview: Interview }) {
  const overdue = interview.status === "SCHEDULED" && new Date(interview.scheduled_at).getTime() <= Date.now();
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Pill className={INTERVIEW_STATUS_STYLE[interview.status]}>{INTERVIEW_STATUS_LABEL[interview.status]}</Pill>
      {overdue && <Pill className="bg-amber-50 text-amber-800 ring-amber-200">Needs update</Pill>}
    </span>
  );
}

export function InterviewsPage() {
  const writer = canWrite(useCurrentUser());
  const [sp, setSearchParams] = useSearchParams();
  const view: InterviewView = sp.get("view") === "all" ? "all" : "upcoming";
  const status = INTERVIEW_STATUSES.find((s) => s === sp.get("status"));
  const rawPage = Number(sp.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const list = useInterviews({ view, status, page });
  const update = useUpdateInterview();
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [cancelling, setCancelling] = useState<Interview | null>(null);

  function setParams(patch: Record<string, string | undefined>, keepPage = false) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!keepPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  function setStatus(i: Interview, next: InterviewStatus, done?: () => void) {
    update.mutate(
      { id: i.id, changes: { status: next } },
      {
        onSuccess: () => {
          toast.success(`Interview marked ${INTERVIEW_STATUS_LABEL[next].toLowerCase()}`);
          done?.();
        },
        onError: (e) => {
          toast.error(e.message);
          done?.();
        },
      },
    );
  }

  const data = list.data;

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Schedule interviews and keep their outcomes up to date."
        actions={
          writer && (
            <Button onClick={() => setScheduling(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Schedule interview
            </Button>
          )
        }
      />

      <Tabs value={view} onValueChange={(v) => setParams({ view: v === "all" ? "all" : undefined, status: undefined })}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="all">All interviews</TabsTrigger>
          </TabsList>
          {view === "all" && (
            <Select value={status ?? "all"} onValueChange={(v) => setParams({ status: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {INTERVIEW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {INTERVIEW_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value={view} className="mt-4">
          <Card className="gap-0 py-0">
            {list.isError ? (
              <div className="p-6">
                <ErrorState title="Couldn't load interviews" message={list.error.message} onRetry={() => void list.refetch()} />
              </div>
            ) : list.isPending ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading interviews">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data && data.items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarClock}
                  title={view === "upcoming" ? "No upcoming interviews" : "No interviews found"}
                  description={writer ? "Schedule one for a candidate who is in your pipeline." : "Nothing is scheduled."}
                  action={writer && <Button onClick={() => setScheduling(true)}>Schedule interview</Button>}
                />
              </div>
            ) : (
              data && (
                <div className={cn(list.isPlaceholderData && "opacity-60 transition-opacity")}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead className="hidden md:table-cell">Type</TableHead>
                        <TableHead className="hidden lg:table-cell">Interviewer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((i) => {
                        const link = safeHttpUrl(i.meeting_link);
                        const scheduled = i.status === "SCHEDULED";
                        const past = new Date(i.scheduled_at).getTime() <= Date.now();
                        return (
                          <TableRow key={i.id}>
                            <TableCell>
                              <time dateTime={i.scheduled_at} className="font-medium text-slate-900">
                                {formatDateTime(i.scheduled_at)}
                              </time>
                              <p className="text-xs text-muted-foreground">{i.duration_minutes} min</p>
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/candidates/${i.candidate_id}`}
                                className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                              >
                                {i.candidate_name}
                              </Link>
                              <p className="text-xs text-muted-foreground">{i.job_title}</p>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{INTERVIEW_TYPE_LABEL[i.interview_type]}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {i.interviewer_name}
                              {link && (
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                                >
                                  Join <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                  <span className="sr-only">(opens in a new tab)</span>
                                </a>
                              )}
                            </TableCell>
                            <TableCell>
                              <InterviewStatusBadge interview={i} />
                            </TableCell>
                            <TableCell className="text-right">
                              {writer && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label={`Actions for ${i.candidate_name}'s interview`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => setEditing(i)}>
                                      {scheduled ? "Edit or reschedule" : "Edit notes"}
                                    </DropdownMenuItem>
                                    {scheduled && past && (
                                      <>
                                        <DropdownMenuItem onSelect={() => setStatus(i, "COMPLETED")}>Mark completed</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setStatus(i, "NO_SHOW")}>Mark no-show</DropdownMenuItem>
                                      </>
                                    )}
                                    {scheduled && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCancelling(i)}>
                                          Cancel interview
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination
                    page={data.page}
                    pages={data.pages}
                    total={data.total}
                    pageSize={INTERVIEWS_PAGE_SIZE}
                    onPageChange={(p) => setParams({ page: String(p) }, true)}
                  />
                </div>
              )
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <InterviewFormDialog open={scheduling} onOpenChange={setScheduling} />
      <InterviewFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        interview={editing ?? undefined}
      />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this interview?"
        description={`${cancelling?.candidate_name ?? "The candidate"} will not be notified automatically. You can still edit the notes afterwards.`}
        confirmLabel="Cancel interview"
        destructive
        pending={update.isPending}
        onConfirm={() => cancelling && setStatus(cancelling, "CANCELLED", () => setCancelling(null))}
      />
    </>
  );
}
