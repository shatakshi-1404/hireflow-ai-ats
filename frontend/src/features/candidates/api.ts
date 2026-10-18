import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  Activity,
  ApplicationStage,
  Candidate,
  CandidateDetail,
  ImportResult,
  Note,
  Page,
} from "@/types/api";

export type CandidateSort = "created_at" | "full_name" | "years_experience";

export interface CandidateFilters {
  q?: string;
  stage?: ApplicationStage;
  job_id?: string;
  skills: string[];
  min_experience?: number;
  include_archived: boolean;
  sort: CandidateSort;
  order: "asc" | "desc";
  page: number;
}

export interface CandidatePayload {
  full_name: string;
  email: string;
  phone: string | null;
  current_title: string | null;
  skills: string[];
  years_experience: number | null;
  experience_summary: string | null;
  source: string | null;
}

export type CandidateChanges = Partial<CandidatePayload> & { is_archived?: boolean };

export const CANDIDATES_PAGE_SIZE = 15;

export function useCandidates(f: CandidateFilters) {
  return useQuery({
    queryKey: ["candidates", "list", f],
    queryFn: ({ signal }) =>
      api.get<Page<Candidate>>(
        "/candidates",
        {
          q: f.q,
          stage: f.stage,
          job_id: f.job_id,
          skills: f.skills.length ? f.skills : undefined,
          min_experience: f.min_experience,
          include_archived: f.include_archived ? true : undefined,
          sort: f.sort,
          order: f.order,
          page: f.page,
          page_size: CANDIDATES_PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ["candidates", "detail", id],
    queryFn: ({ signal }) => api.get<CandidateDetail>(`/candidates/${id}`, undefined, signal),
    enabled: id !== "",
  });
}

export function useNotes(id: string) {
  return useQuery({
    queryKey: ["candidates", "notes", id],
    queryFn: ({ signal }) => api.get<Note[]>(`/candidates/${id}/notes`, undefined, signal),
  });
}

export function useCandidateActivity(id: string) {
  return useQuery({
    queryKey: ["candidates", "activity", id],
    queryFn: ({ signal }) => api.get<Activity[]>(`/candidates/${id}/activity`, undefined, signal),
  });
}

function useInvalidateCandidates() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["candidates", "analytics", "applications"].map((k) => qc.invalidateQueries({ queryKey: [k] })),
    );
}

export function useCreateCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (payload: CandidatePayload) => api.post<Candidate>("/candidates", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: CandidateChanges }) =>
      api.patch<Candidate>(`/candidates/${id}`, changes),
    onSuccess: invalidate,
  });
}

export function useDeleteCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/${id}`),
    onSuccess: invalidate,
  });
}

export function useAddNote(candidateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<Note>(`/candidates/${candidateId}/notes`, { body }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["candidates", "notes", candidateId] }),
        qc.invalidateQueries({ queryKey: ["candidates", "activity", candidateId] }),
        qc.invalidateQueries({ queryKey: ["analytics"] }),
      ]),
  });
}

export function useImportCandidates() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<ImportResult>("/candidates/import", form, { dry_run: dryRun });
    },
    onSuccess: (result) => (result.dry_run ? undefined : invalidate()),
  });
}
