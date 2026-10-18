import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AiStatus,
  AnalysisKind,
  AnalysisRecord,
  Candidate,
  ConfirmedProfilePayload,
  InterviewQuestion,
  MatchResult,
  QuestionsRequest,
  QuestionsResult,
  ResumeAnalysis,
} from "@/types/api";

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: ({ signal }) => api.get<AiStatus>("/ai/status", undefined, signal),
    staleTime: 5 * 60_000,
  });
}

export function useAnalyses(p: {
  candidateId: string;
  kind: AnalysisKind;
  jobId?: string;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["ai", "analyses", p.candidateId, p.kind, p.jobId ?? "any", p.limit ?? 20],
    queryFn: ({ signal }) =>
      api.get<AnalysisRecord[]>(
        "/ai/analyses",
        { candidate_id: p.candidateId, kind: p.kind, job_id: p.jobId, limit: p.limit ?? 20 },
        signal,
      ),
    enabled: (p.enabled ?? true) && p.candidateId !== "",
  });
}

function useInvalidate(keys: string[]) {
  const qc = useQueryClient();
  return () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useAnalyzeResume() {
  const invalidate = useInvalidate(["ai", "candidates"]);
  return useMutation({
    mutationFn: ({ candidateId, file }: { candidateId: string; file: File }) => {
      const form = new FormData();
      form.append("candidate_id", candidateId);
      form.append("file", file);
      return api.post<ResumeAnalysis>("/ai/resume-analysis", form);
    },
    onSuccess: invalidate,
  });
}

export function useConfirmResume() {
  const invalidate = useInvalidate(["ai", "candidates", "applications", "analytics"]);
  return useMutation({
    mutationFn: ({ analysisId, profile }: { analysisId: string; profile: ConfirmedProfilePayload }) =>
      api.post<Candidate>(`/ai/resume-analysis/${analysisId}/confirm`, profile),
    onSuccess: invalidate,
  });
}

export function useRunMatch() {
  const invalidate = useInvalidate(["ai", "applications", "candidates", "analytics"]);
  return useMutation({
    mutationFn: (v: { candidate_id: string; job_id: string }) => api.post<MatchResult>("/ai/match", v),
    onSuccess: invalidate,
  });
}

export function useGenerateQuestions() {
  return useMutation({
    mutationFn: (req: QuestionsRequest) => api.post<QuestionsResult>("/ai/interview-questions", req),
  });
}

export function useSaveQuestions() {
  const invalidate = useInvalidate(["ai", "candidates"]);
  return useMutation({
    mutationFn: (v: {
      candidate_id: string;
      job_id: string;
      provider: string;
      questions: InterviewQuestion[];
    }) => api.post<AnalysisRecord>("/ai/interview-questions/save", v),
    onSuccess: invalidate,
  });
}
