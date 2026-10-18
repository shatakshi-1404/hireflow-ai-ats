import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Overview, PipelineStats } from "@/types/api";

export type Granularity = "day" | "week" | "month";

export function useOverview(dateFrom: string, granularity: Granularity) {
  return useQuery({
    queryKey: ["analytics", "overview", dateFrom, granularity],
    queryFn: ({ signal }) =>
      api.get<Overview>("/analytics/overview", { date_from: dateFrom, granularity }, signal),
  });
}

export function usePipelineStats(dateFrom: string) {
  return useQuery({
    queryKey: ["analytics", "pipeline", dateFrom],
    queryFn: ({ signal }) => api.get<PipelineStats>("/analytics/pipeline", { date_from: dateFrom }, signal),
  });
}
