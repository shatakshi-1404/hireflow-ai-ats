import { Archive, ArchiveRestore, FileUp, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Pill, SkillChips } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/data-table/pagination";
import { SortHeader } from "@/components/data-table/sort-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/features/auth/user-context";
import { useJobOptions } from "@/features/jobs/api";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { formatDate, parseList } from "@/lib/format";
import { canWrite } from "@/lib/permissions";
import { STAGE_LABEL, STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/types/api";
import {
  CANDIDATES_PAGE_SIZE,
  type CandidateFilters,
  type CandidateSort,
  useCandidates,
  useDeleteCandidate,
  useUpdateCandidate,
} from "./api";
import { CandidateFormDialog } from "./candidate-form-dialog";
import { ImportDialog } from "./import-dialog";

const SORTS = ["created_at", "full_name", "years_experience"] as const;

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => a === value);
}

function readFilters(sp: URLSearchParams): CandidateFilters {
  const minRaw = sp.get("min_experience");
  const minNum = minRaw !== null && minRaw !== "" ? Number(minRaw) : NaN;
  const page = Number(sp.get("page"));
  return {
    q: sp.get("q") ?? undefined,
    stage: parseEnum(sp.get("stage"), STAGES),
    job_id: sp.get("job_id") ?? undefined,
    skills: parseList(sp.get("skills") ?? ""),
    min_experience: Number.isFinite(minNum) && minNum >= 0 ? minNum : undefined,
    include_archived: sp.get("archived") === "1",
    sort: parseEnum(sp.get("sort"), SORTS) ?? "created_at",
    order: sp.get("order") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export function CandidatesPage() {
  const user = useCurrentUser();
  const writer = canWrite(user);
  const [sp, setSearchParams] = useSearchParams();
  const filters = readFilters(sp);
  const list = useCandidates(filters);
  const jobs = useJobOptions();
  const update = useUpdateCandidate();
  const remove = useDeleteCandidate();

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [skillsText, setSkillsText] = useState(sp.get("skills") ?? "");
  const [minExp, setMinExp] = useState(sp.get("min_experience") ?? "");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);

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
  const applySkills = useDebouncedCallback((v: string) =>
    setParams({ skills: parseList(v).join(",") || undefined }),
  );
  const applyMin = useDebouncedCallback((v: string) => setParams({ min_experience: v.trim() || undefined }));

  const hasFilters = Boolean(
    filters.q ||
      filters.stage ||
      filters.job_id ||
      filters.skills.length ||
      filters.min_experience !== undefined ||
      filters.include_archived,
  );

  function clearFilters() {
    applySearch.cancel();
    applySkills.cancel();
    applyMin.cancel();
    setSearch("");
    setSkillsText("");
    setMinExp("");
    setSearchParams({}, { replace: true });
  }

  function onSort(column: CandidateSort) {
    if (filters.sort === column) setParams({ order: filters.order === "asc" ? "desc" : "asc" });
    else setParams({ sort: column, order: column === "full_name" ? "asc" : "desc" });
  }

  function toggleArchive(c: Candidate) {
    update.mutate(
      { id: c.id, changes: { is_archived: !c.is_archived } },
      {
        onSuccess: () => toast.success(c.is_archived ? "Candidate restored" : "Candidate archived"),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Candidate deleted");
        setDeleting(null);
      },
      onError: (e) => {
        toast.error(e.message);
        setDeleting(null);
      },
    });
  }

  const data = list.data;

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Search, filter and manage everyone in your talent pool."
        actions={
          writer && (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}>
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Import CSV
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add candidate
              </Button>
            </>
          )
        }
      />

      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input
              aria-label="Search candidates"
              placeholder="Search name, email, title or an exact skill"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applySearch.call(e.target.value);
              }}
            />
          </div>
          <Select
            value={filters.stage ?? "all"}
            onValueChange={(v) => setParams({ stage: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-full" aria-label="Filter by stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.job_id ?? "all"}
            onValueChange={(v) => setParams({ job_id: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-full" aria-label="Filter by job">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.data?.items.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Required skills (candidate must have all)"
            placeholder="Skills, e.g. python, sql"
            value={skillsText}
            onChange={(e) => {
              setSkillsText(e.target.value);
              applySkills.call(e.target.value);
            }}
          />
          <Input
            aria-label="Minimum years of experience"
            type="number"
            min={0}
            max={60}
            step="0.5"
            placeholder="Min. years"
            value={minExp}
            onChange={(e) => {
              setMinExp(e.target.value);
              applyMin.call(e.target.value);
            }}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-teal-700"
              checked={filters.include_archived}
              onChange={(e) => setParams({ archived: e.target.checked ? "1" : undefined })}
            />
            Include archived
          </label>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="justify-self-start">
              Clear filters
            </Button>
          )}
        </div>

        {list.isError ? (
          <div className="p-6">
            <ErrorState
              title="Couldn't load candidates"
              message={list.error.message}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : list.isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading candidates">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-6">
            {hasFilters || filters.page > 1 ? (
              <EmptyState
                icon={Search}
                title="No candidates match"
                description="Try different search terms or clear the filters."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No candidates yet"
                description={
                  writer
                    ? "Add your first candidate, or import a CSV to get started."
                    : "Ask a recruiter or admin to add candidates."
                }
                action={
                  writer && (
                    <div className="flex gap-2">
                      <Button onClick={() => setCreating(true)}>Add candidate</Button>
                      <Button variant="outline" onClick={() => setImporting(true)}>
                        Import CSV
                      </Button>
                    </div>
                  )
                }
              />
            )}
          </div>
        ) : (
          data && (
            <div className={cn(list.isPlaceholderData && "opacity-60 transition-opacity")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Candidate" column="full_name" sort={filters.sort} order={filters.order} onSort={onSort} />
                    <TableHead className="hidden md:table-cell">Title</TableHead>
                    <TableHead className="hidden lg:table-cell">Skills</TableHead>
                    <SortHeader label="Experience" column="years_experience" sort={filters.sort} order={filters.order} onSort={onSort} />
                    <SortHeader label="Added" column="created_at" sort={filters.sort} order={filters.order} onSort={onSort} />
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={c.full_name} size="sm" />
                          <div className="min-w-0">
                            <Link
                              to={`/candidates/${c.id}`}
                              className="block truncate font-medium text-slate-900 hover:text-brand-600 hover:underline"
                            >
                              {c.full_name}
                            </Link>
                            <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                          </div>
                          {c.is_archived && <Pill className="bg-zinc-100 text-zinc-600 ring-zinc-200">Archived</Pill>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{c.current_title ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <SkillChips skills={c.skills} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {c.years_experience !== null ? `${c.years_experience} yrs` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${c.full_name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/candidates/${c.id}`}>View profile</Link>
                            </DropdownMenuItem>
                            {writer && (
                              <>
                                <DropdownMenuItem onSelect={() => setEditing(c)}>
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => toggleArchive(c)}>
                                  {c.is_archived ? (
                                    <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <Archive className="h-4 w-4" aria-hidden="true" />
                                  )}
                                  {c.is_archived ? "Restore" : "Archive"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => setDeleting(c)}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={data.page}
                pages={data.pages}
                total={data.total}
                pageSize={CANDIDATES_PAGE_SIZE}
                onPageChange={(p) => setParams({ page: String(p) }, true)}
              />
            </div>
          )
        )}
      </Card>

      <CandidateFormDialog open={creating} onOpenChange={setCreating} />
      <CandidateFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        candidate={editing ?? undefined}
      />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.full_name ?? "candidate"}?`}
        description="This permanently removes the candidate, their notes and AI analyses. Candidates with applications can't be deleted. Archive them instead."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
