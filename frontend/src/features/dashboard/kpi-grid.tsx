import { Briefcase, CalendarClock, Columns3, FileText, Info, type LucideIcon, UserCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Kpis } from "@/types/api";

const KPI_CARDS: { key: keyof Kpis; label: string; icon: LucideIcon }[] = [
  { key: "total_candidates", label: "Total candidates", icon: Users },
  { key: "active_jobs", label: "Active jobs", icon: Briefcase },
  { key: "active_applications", label: "Active applications", icon: Columns3 },
  { key: "upcoming_interviews", label: "Upcoming interviews", icon: CalendarClock },
  { key: "offers", label: "Open offers", icon: FileText },
  { key: "hires", label: "Hires", icon: UserCheck },
];

export function KpiGrid({
  kpis,
  definitions,
}: {
  kpis?: Kpis;
  definitions?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {KPI_CARDS.map(({ key, label, icon: Icon }) => {
        const definition = definitions?.[key];
        return (
          <Card key={key} className="gap-0 py-0">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {label}
                  {definition && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`How "${label}" is calculated`}
                          className="rounded text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{definition}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {kpis ? (
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{kpis[key]}</p>
                ) : (
                  <Skeleton className="mt-3 h-8 w-16" />
                )}
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
