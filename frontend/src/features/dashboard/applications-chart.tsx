import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimePoint } from "@/types/api";
import type { Granularity } from "./api";

function formatPeriod(period: string, granularity: Granularity, long = false): string {
  const d = new Date(`${period}T00:00:00Z`);
  if (granularity === "month") {
    return d.toLocaleDateString("en", { month: "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

export function ApplicationsChart({
  points,
  granularity,
}: {
  points: TimePoint[];
  granularity: Granularity;
}) {
  const total = points.reduce((sum, p) => sum + p.count, 0);
  return (
    <div
      role="img"
      aria-label={`Applications per ${granularity}: ${total} in this period`}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="appsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="period"
            tickFormatter={(v: string) => formatPeriod(v, granularity)}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip labelFormatter={(label) => formatPeriod(String(label), granularity, true)} />
          <Area
            type="monotone"
            dataKey="count"
            name="Applications"
            stroke="#0f766e"
            strokeWidth={2}
            fill="url(#appsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
