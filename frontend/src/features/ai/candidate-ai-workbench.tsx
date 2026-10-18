import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCandidate } from "@/features/candidates/api";
import { useCurrentUser } from "@/features/auth/user-context";
import { useJobOptions } from "@/features/jobs/api";
import { canWrite } from "@/lib/permissions";
import { AiModeBanner } from "./provider-badge";
import { InterviewCopilot } from "./interview-copilot";
import { MatchPanel } from "./match-panel";
import { ResumeSection } from "./resume-section";

export function CandidateAiWorkbench({ candidateId }: { candidateId: string }) {
  const writer = canWrite(useCurrentUser());
  const candidate = useCandidate(candidateId);
  const jobs = useJobOptions();

  if (candidate.isPending) return <Skeleton className="h-64 w-full" />;
  if (candidate.isError)
    return <ErrorState message={candidate.error.message} onRetry={() => void candidate.refetch()} />;

  const jobsGate = (render: (items: NonNullable<typeof jobs.data>["items"]) => React.ReactNode) =>
    jobs.isPending ? (
      <Skeleton className="h-40 w-full" />
    ) : jobs.isError ? (
      <ErrorState message={jobs.error.message} onRetry={() => void jobs.refetch()} />
    ) : (
      render(jobs.data.items)
    );

  return (
    <div>
      <AiModeBanner />
      {!writer && (
        <p className="mb-4 text-sm text-muted-foreground">
          You have read-only access. You can view stored results, but running AI tools needs a recruiter or
          admin role.
        </p>
      )}
      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="match">Job match</TabsTrigger>
          <TabsTrigger value="questions">Interview questions</TabsTrigger>
        </TabsList>
        <TabsContent value="resume" className="mt-4">
          <ResumeSection candidate={candidate.data} writer={writer} />
        </TabsContent>
        <TabsContent value="match" className="mt-4">
          {jobsGate((items) => (
            <MatchPanel candidateId={candidateId} jobs={items} writer={writer} />
          ))}
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          {jobsGate((items) => (
            <InterviewCopilot candidateId={candidateId} jobs={items} writer={writer} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
