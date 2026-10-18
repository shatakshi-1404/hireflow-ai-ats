import { Search } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/common/error-state";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidates } from "@/features/candidates/api";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { Candidate } from "@/types/api";

export function CandidatePicker({ onSelect }: { onSelect: (c: Candidate) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const apply = useDebouncedCallback((v: string) => setQ(v.trim()));
  const list = useCandidates({
    q: q || undefined,
    skills: [],
    include_archived: false,
    sort: "full_name",
    order: "asc",
    page: 1,
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <Input
          aria-label="Search for a candidate"
          placeholder="Search by name, email or title"
          className="pl-9"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            apply.call(e.target.value);
          }}
        />
      </div>
      {list.isPending ? (
        <Skeleton className="h-40 w-full max-w-md" />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No candidates match.</p>
      ) : (
        <ul className="max-w-md divide-y rounded-lg border bg-white">
          {list.data.items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <InitialsAvatar name={c.full_name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{c.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.current_title ?? c.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.data && list.data.total > list.data.items.length && (
        <p className="text-xs text-muted-foreground">Showing the first {list.data.items.length}. Refine your search to find others.</p>
      )}
    </div>
  );
}
