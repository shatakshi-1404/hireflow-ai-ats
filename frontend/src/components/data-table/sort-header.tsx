import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

export function SortHeader<K extends string>({
  label,
  column,
  sort,
  order,
  onSort,
}: {
  label: string;
  column: K;
  sort: K;
  order: "asc" | "desc";
  onSort: (column: K) => void;
}) {
  const active = sort === column;
  return (
    <TableHead aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded font-medium hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        {active ? (
          order === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
}
