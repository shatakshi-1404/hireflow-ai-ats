import { useState } from "react";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/user-context";
import { type Granularity, useOverview, usePipelineStats } from "./api";
import { ActivityFeed } from "./activity-feed";
import { ApplicationsChart } from "./applications-chart";
import { Funnel } from "./funnel-card";
import { KpiGrid } from "./kpi-grid";

const RANGES: Record<string, { label: string; days: number; granularity: Granularity }> = {
  "30": { label: "Last 30 days", days: 30, granularity: "day" },
  "90": { label: "Last 90 days", days: 90, granularity: "week" },
  "365": { label: "Last 12 months", days: 365, granularity: "month" },
};

/** The backend buckets by UTC day, so the range start is computed in UTC too. */
function utcDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const user = useCurrentUser();
  const [range, setRange] = useState("90");
  const config = RANGES[range] ?? RANGES["90"];
  const dateFrom = utcDaysAgo(config.days - 1);

  const overview = useOverview(dateFrom, config.granularity);
  const pipeline = usePipelineStats(dateFrom);
  const firstName = user.full_name.split(/\s+/)[0] ?? user.full_name;
  const total = overview.data?.applications_over_time.reduce((sum, p) => sum + p.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="A snapshot of your recruitment pipeline. The cards show current totals. The chart and funnel follow the selected range."
        actions={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-44" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGES).map(([value, r]) => (
                <SelectItem key={value} value={value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {overview.isError ? (
        <ErrorState
          title="Couldn't load your metrics"
          message={overview.error.message}
          onRetry={() => void overview.refetch()}
        />
      ) : (
        <>
          <KpiGrid kpis={overview.data?.kpis} definitions={overview.data?.definitions} />

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Applications over time</CardTitle>
                <CardDescription>
                  {overview.data ? `${total} applications · grouped by ${config.granularity} (UTC)` : "Loading…"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.data ? (
                  <ApplicationsChart points={overview.data.applications_over_time} granularity={config.granularity} />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hiring funnel</CardTitle>
                <CardDescription>
                  {pipeline.data ? `${pipeline.data.cohort_size} applications in range` : "Loading…"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pipeline.isError ? (
                  <ErrorState message={pipeline.error.message} onRetry={() => void pipeline.refetch()} />
                ) : pipeline.data ? (
                  pipeline.data.cohort_size === 0 ? (
                    <p className="text-sm text-muted-foreground">No applications in this period.</p>
                  ) : (
                    <Funnel stats={pipeline.data} />
                  )
                ) : (
                  <Skeleton className="h-56 w-full" />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.data ? <ActivityFeed items={overview.data.recent_activity} /> : <Skeleton className="h-40 w-full" />}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
