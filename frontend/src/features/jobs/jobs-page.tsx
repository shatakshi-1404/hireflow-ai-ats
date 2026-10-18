import { Briefcase, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { JobStatusBadge, SkillChips } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/data-table/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/features/auth/user-context";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { formatDate } from "@/lib/format";
import { canWrite } from "@/lib/permissions";
import { EMPLOYMENT_LABEL, JOB_STATUS_LABEL, JOB_STATUSES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { JOBS_PAGE_SIZE, type JobFilters, useJobs } from "./api";
import { JobFormDialog } from "./job-form-dialog";

export function JobsPage() {
  const writer = canWrite(useCurrentUser());
  const [sp, setSearchParams] = useSearchParams();
  const rawPage = Number(sp.get("page"));
  const filters: JobFilters = {
    q: sp.get("q") ?? undefined,
    status: JOB_STATUSES.find((s) => s === sp.get("status")),
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1,
  };
  const list = useJobs(filters);
  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [creating, setCreating] = useState(false);

  function setParams(patch: Record<string, string | undefined>, keepPage = false) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!keepPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }
  const applySearch = useDebouncedCallback((v: string) => setParams({ q: v.trim() || undefined }));
  const hasFilters = Boolean(filters.q || filters.status);

  function clearFilters() {
    applySearch.cancel();
    setSearch("");
    setSearchParams({}, { replace: true });
  }

  const data = list.data;

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Open roles and the candidates applying to them."
        actions={
          writer && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create job
            </Button>
          )
        }
      />
      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input
              aria-label="Search jobs"
              placeholder="Search title, department or location"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applySearch.call(e.target.value);
              }}
            />
          </div>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) => setParams({ status: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-full" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {JOB_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {list.isError ? (
          <div className="p-6">
            <ErrorState title="Couldn't load jobs" message={list.error.message} onRetry={() => void list.refetch()} />
          </div>
        ) : list.isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading jobs">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-6">
            {hasFilters || filters.page > 1 ? (
              <EmptyState
                icon={Search}
                title="No jobs match"
                description="Try a different search or clear the filters."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={Briefcase}
                title="No jobs yet"
                description={writer ? "Create your first job to start collecting applications." : "No jobs have been created."}
                action={writer && <Button onClick={() => setCreating(true)}>Create job</Button>}
              />
            )}
          </div>
        ) : (
          data && (
            <div className={cn(list.isPlaceholderData && "opacity-60 transition-opacity")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applicants</TableHead>
                    <TableHead className="hidden lg:table-cell">Required skills</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell>
                        <Link
                          to={`/jobs/${j.id}`}
                          className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                        >
                          {j.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {[j.department, j.location, EMPLOYMENT_LABEL[j.employment_type]].filter(Boolean).join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={j.status} />
                      </TableCell>
                      <TableCell className="tabular-nums">{j.applicant_count}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <SkillChips skills={j.required_skills} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(j.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={data.page}
                pages={data.pages}
                total={data.total}
                pageSize={JOBS_PAGE_SIZE}
                onPageChange={(p) => setParams({ page: String(p) }, true)}
              />
            </div>
          )
        )}
      </Card>
      <JobFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
