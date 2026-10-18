import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { EmploymentType, Job, JobDetail, JobStatus, Page } from "@/types/api";

export interface JobFilters {
  q?: string;
  status?: JobStatus;
  page: number;
}

export interface JobPayload {
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  status: JobStatus;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience: number | null;
  max_experience: number | null;
}

export const JOBS_PAGE_SIZE = 12;

export function useJobs(f: JobFilters) {
  return useQuery({
    queryKey: ["jobs", "list", f],
    queryFn: ({ signal }) =>
      api.get<Page<Job>>(
        "/jobs",
        { q: f.q, status: f.status, page: f.page, page_size: JOBS_PAGE_SIZE },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

/** Up to 100 jobs for dropdowns (filters, apply dialog). */
export function useJobOptions() {
  return useQuery({
    queryKey: ["jobs", "options"],
    queryFn: ({ signal }) =>
      api.get<Page<Job>>("/jobs", { page_size: 100, sort: "title", order: "asc" }, signal),
    staleTime: 60_000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["jobs", "detail", id],
    queryFn: ({ signal }) => api.get<JobDetail>(`/jobs/${id}`, undefined, signal),
    enabled: id !== "",
  });
}

function useInvalidateJobs() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["jobs"] }),
      qc.invalidateQueries({ queryKey: ["analytics"] }),
    ]);
}

export function useCreateJob() {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: (payload: JobPayload) => api.post<Job>("/jobs", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateJob() {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<JobPayload> }) =>
      api.patch<JobDetail>(`/jobs/${id}`, changes),
    onSuccess: invalidate,
  });
}
