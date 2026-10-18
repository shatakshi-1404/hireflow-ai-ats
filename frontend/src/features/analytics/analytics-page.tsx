import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApplicationsChart } from "@/features/dashboard/applications-chart";
import type { Granularity } from "@/features/dashboard/api";
import { utcDaysAgo } from "@/lib/format";
import { STAGE_COLOR, STAGE_LABEL } from "@/lib/stages";
import type { PipelineStats } from "@/types/api";
import { type AnalyticsRange, isValidRange, useRangeOverview, useRangePipeline } from "./api";

const PRESETS: { label: string; days: number; granularity: Granularity }[] = [
  { label: "Last 30 days", days: 30, granularity: "day" },
  { label: "Last 90 days", days: 90, granularity: "week" },
  { label: "Last 12 months", days: 365, granularity: "month" },
];

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function DistributionChart({ stats }: { stats: PipelineStats }) {
  const data = stats.stage_distribution.map((d) => ({ ...d, label: STAGE_LABEL[d.stage] }));
  return (
    <>
      <div role="img" aria-label="Current stage of applications in this range. A table with the same numbers follows." className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 12, fill: "#475569" }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="count" name="Applications" radius={[0, 4, 4, 0]}>
              {data.map((d) => (
                <Cell key={d.stage} fill={STAGE_COLOR[d.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Applications by current stage</caption>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Applications</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.stage}>
              <td>{d.label}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>({
    from: utcDaysAgo(89),
    to: utcDaysAgo(0),
    granularity: "week",
  });
  const valid = isValidRange(range);
  const overview = useRangeOverview(range);
  const pipeline = useRangePipeline(range);

  const funnel = pipeline.data?.funnel ?? [];
  const reached = (stage: string) => funnel.find((f) => f.stage === stage)?.reached ?? 0;
  const hiredStep = funnel.find((f) => f.stage === "HIRED");
  const total = overview.data?.applications_over_time.reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Funnel and conversion metrics for applications created in the selected range."
      />

      <Card className="mb-6 gap-0 py-0">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="range-from">From</Label>
            <Input
              id="range-from"
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to">To</Label>
            <Input
              id="range-to"
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-granularity">Group by</Label>
            <Select value={range.granularity} onValueChange={(v) => setRange({ ...range, granularity: v as Granularity })}>
              <SelectTrigger id="range-granularity" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => setRange({ from: utcDaysAgo(p.days - 1), to: utcDaysAgo(0), granularity: p.granularity })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!valid ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Choose a start date that is on or before the end date.
        </p>
      ) : overview.isError || pipeline.isError ? (
        <ErrorState
          title="Couldn't load analytics"
          message={(overview.error ?? pipeline.error)?.message}
          onRetry={() => {
            void overview.refetch();
            void pipeline.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pipeline.data ? (
              <>
                <Stat label="Applications in range" value={String(pipeline.data.cohort_size)} />
                <Stat label="Reached offer" value={String(reached("OFFER"))} />
                <Stat label="Hired" value={String(reached("HIRED"))} />
                <Stat label="Applied → hired" value={pct(hiredStep?.conversion_from_start ?? null)} />
              </>
            ) : (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)
            )}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Applications over time</CardTitle>
                <CardDescription>
                  {overview.data ? `${total} applications · grouped by ${range.granularity} (UTC)` : "Loading…"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.data ? (
                  <ApplicationsChart points={overview.data.applications_over_time} granularity={range.granularity} />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Where applications are now</CardTitle>
                <CardDescription>Current stage of applications created in this range.</CardDescription>
              </CardHeader>
              <CardContent>
                {pipeline.data ? <DistributionChart stats={pipeline.data} /> : <Skeleton className="h-72 w-full" />}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6 gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Conversion funnel</CardTitle>
              <CardDescription>
                Applications that ever reached each stage, so later rejections still count where they got to.
              </CardDescription>
            </CardHeader>
            {pipeline.data ? (
              pipeline.data.cohort_size === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No applications in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Reached</TableHead>
                      <TableHead className="text-right">From previous</TableHead>
                      <TableHead className="text-right">From applied</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipeline.data.funnel.map((f) => (
                      <TableRow key={f.stage}>
                        <TableCell className="font-medium">{STAGE_LABEL[f.stage]}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.reached}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(f.conversion_from_previous)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(f.conversion_from_start)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : (
              <div className="p-4">
                <Skeleton className="h-40 w-full" />
              </div>
            )}
          </Card>

          {overview.data && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>How these numbers are calculated</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {Object.entries(overview.data.definitions).map(([key, text]) => (
                    <div key={key}>
                      <dt className="font-medium capitalize text-slate-900">{key.replace(/_/g, " ")}</dt>
                      <dd className="text-muted-foreground">{text}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}
