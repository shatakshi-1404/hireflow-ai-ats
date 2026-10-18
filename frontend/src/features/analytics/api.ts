import { useQuery } from "@tanstack/react-query";
import type { Granularity } from "@/features/dashboard/api";
import { api } from "@/lib/api-client";
import type { Overview, PipelineStats } from "@/types/api";

export interface AnalyticsRange {
  from: string;
  to: string;
  granularity: Granularity;
}

export const isValidRange = (r: AnalyticsRange): boolean => r.from !== "" && r.to !== "" && r.from <= r.to;

export function useRangeOverview(r: AnalyticsRange) {
  return useQuery({
    queryKey: ["analytics", "overview", "range", r],
    queryFn: ({ signal }) =>
      api.get<Overview>(
        "/analytics/overview",
        { date_from: r.from, date_to: r.to, granularity: r.granularity },
        signal,
      ),
    enabled: isValidRange(r),
  });
}

export function useRangePipeline(r: AnalyticsRange) {
  return useQuery({
    queryKey: ["analytics", "pipeline", "range", r.from, r.to],
    queryFn: ({ signal }) =>
      api.get<PipelineStats>("/analytics/pipeline", { date_from: r.from, date_to: r.to }, signal),
    enabled: isValidRange(r),
  });
}
