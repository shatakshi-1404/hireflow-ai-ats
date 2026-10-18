import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Interview, InterviewStatus, InterviewType, Page } from "@/types/api";

export type InterviewView = "upcoming" | "all";

export interface InterviewFilters {
  view: InterviewView;
  status?: InterviewStatus;
  page: number;
}

export interface InterviewPayload {
  application_id: string;
  interviewer_name: string;
  interviewer_id: string | null;
  interview_type: InterviewType;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  notes: string | null;
}

export type InterviewChanges = Partial<Omit<InterviewPayload, "application_id">> & {
  status?: InterviewStatus;
};

export const INTERVIEWS_PAGE_SIZE = 15;

export function useInterviews(f: InterviewFilters) {
  return useQuery({
    queryKey: ["interviews", "list", f],
    queryFn: ({ signal }) =>
      api.get<Page<Interview>>(
        "/interviews",
        {
          upcoming: f.view === "upcoming" ? true : undefined,
          status: f.view === "all" ? f.status : undefined,
          page: f.page,
          page_size: INTERVIEWS_PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCandidateInterviews(candidateId: string) {
  return useQuery({
    queryKey: ["interviews", "candidate", candidateId],
    queryFn: ({ signal }) =>
      api.get<Page<Interview>>(
        "/interviews",
        { candidate_id: candidateId, page_size: 50, order: "desc" },
        signal,
      ),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["interviews", "analytics", "candidates"].map((k) => qc.invalidateQueries({ queryKey: [k] })),
    );
}

export function useCreateInterview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: InterviewPayload) => api.post<Interview>("/interviews", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateInterview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: InterviewChanges }) =>
      api.patch<Interview>(`/interviews/${id}`, changes),
    onSuccess: invalidate,
  });
}
