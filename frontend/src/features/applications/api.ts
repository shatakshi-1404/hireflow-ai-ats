import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ApplicationRow, ApplicationStage, Page } from "@/types/api";

export interface ApplicationFilters {
  job_id?: string;
  page: number;
  page_size: number;
}

export function useApplications(f: ApplicationFilters) {
  return useQuery({
    queryKey: ["applications", "list", f],
    queryFn: ({ signal }) =>
      api.get<Page<ApplicationRow>>(
        "/applications",
        { ...f, sort: "applied_at", order: "desc" },
        signal,
      ),
    placeholderData: keepPreviousData,
    enabled: f.job_id !== "",
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["candidates", "jobs", "applications", "analytics"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}

export function useCreateApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { candidate_id: string; job_id: string }) =>
      api.post<ApplicationRow>("/applications", v),
    onSuccess: invalidate,
  });
}

export const BOARD_LIMIT = 200; // the API's maximum page size
export const boardKey = (jobId?: string) => ["applications", "board", jobId ?? "all"] as const;

export function useBoard(jobId?: string) {
  return useQuery({
    queryKey: boardKey(jobId),
    queryFn: ({ signal }) =>
      api.get<Page<ApplicationRow>>(
        "/applications",
        { job_id: jobId, page_size: BOARD_LIMIT, sort: "applied_at", order: "desc" },
        signal,
      ),
  });
}

/** Active applications, for the "schedule interview" picker. */
export function useActiveApplications(enabled: boolean) {
  return useQuery({
    queryKey: ["applications", "active-options"],
    queryFn: ({ signal }) =>
      api.get<Page<ApplicationRow>>(
        "/applications",
        { active_only: true, page_size: BOARD_LIMIT, sort: "candidate_name", order: "asc" },
        signal,
      ),
    enabled,
    staleTime: 30_000,
  });
}

export interface StageChangeVars {
  id: string;
  to_stage: ApplicationStage;
  reason?: string | null;
}

/**
 * Optimistic stage change. The card moves immediately; if the server refuses
 * (invalid transition, permissions, network) the previous board is restored.
 * The board disables dragging while this is pending, so one snapshot is enough.
 */
export function useChangeStage(jobId?: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateAll();
  const key = boardKey(jobId);

  return useMutation({
    mutationFn: (v: StageChangeVars) =>
      api.patch<ApplicationRow>(`/applications/${v.id}/stage`, {
        to_stage: v.to_stage,
        reason: v.reason ?? null,
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Page<ApplicationRow>>(key);
      qc.setQueryData<Page<ApplicationRow>>(
        key,
        (old) =>
          old && {
            ...old,
            items: old.items.map((a) =>
              a.id === v.id ? { ...a, stage: v.to_stage, allowed_next_stages: [] } : a,
            ),
          },
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (updated) => {
      qc.setQueryData<Page<ApplicationRow>>(
        key,
        (old) =>
          old && { ...old, items: old.items.map((a) => (a.id === updated.id ? updated : a)) },
      );
    },
    // Returning the promise keeps the mutation "pending" until fresh data is in,
    // so the board stays locked and cards can't flicker back and forth.
    onSettled: () => invalidate(),
  });
}
