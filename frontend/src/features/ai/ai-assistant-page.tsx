import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { CandidateAiWorkbench } from "./candidate-ai-workbench";
import { CandidatePicker } from "./candidate-picker";
import { AiModeBanner } from "./provider-badge";

export function AiAssistantPage() {
  const [sp, setSp] = useSearchParams();
  const candidateId = sp.get("candidate") ?? "";

  function select(id: string) {
    const next = new URLSearchParams(sp);
    if (id) next.set("candidate", id);
    else next.delete("candidate");
    setSp(next, { replace: false });
  }

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Analyze resumes, compare candidates with jobs, and prepare interview questions. You stay in charge of every decision."
        actions={
          candidateId && (
            <Button variant="outline" onClick={() => select("")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Choose another candidate
            </Button>
          )
        }
      />
      {candidateId ? (
        <CandidateAiWorkbench key={candidateId} candidateId={candidateId} />
      ) : (
        <>
          <AiModeBanner />
          <h2 className="mb-3 text-sm font-medium text-slate-900">Choose a candidate</h2>
          <CandidatePicker onSelect={(c) => select(c.id)} />
        </>
      )}
    </>
  );
}
