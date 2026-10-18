import { FileUp, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResumeAnalysis } from "@/types/api";
import { useAnalyzeResume } from "./api";

const MAX_BYTES = 5_000_000;

function Body({
  candidateId,
  onClose,
  onAnalyzed,
}: {
  candidateId: string;
  onClose: () => void;
  onAnalyzed: (a: ResumeAnalysis) => void;
}) {
  const analyze = useAnalyzeResume();
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onPick(f: File | null) {
    analyze.reset();
    setFile(null);
    if (!f) return setLocalError(null);
    if (!f.name.toLowerCase().endsWith(".pdf")) return setLocalError("Only PDF files are accepted.");
    if (f.size > MAX_BYTES) return setLocalError("The file is larger than 5 MB.");
    setLocalError(null);
    setFile(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    analyze.mutate(
      { candidateId, file },
      {
        onSuccess: (a) => {
          toast.success("Resume analyzed. Review the details before anything is saved.");
          onAnalyzed(a);
        },
      },
    );
  }

  const error = localError ?? analyze.error?.message ?? null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="resume-file">Resume (PDF)</Label>
        <Input
          id="resume-file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => onPick(e.target.files?.item(0) ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Up to 5 MB and 20 pages, with selectable text. Scanned images need OCR, which isn't supported yet.
          Only upload resumes you are allowed to process.
        </p>
      </div>
      {error && <FormAlert message={error} />}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={analyze.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!file || analyze.isPending}>
          {analyze.isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden="true" />
          )}
          Upload and analyze
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ResumeUploadDialog({
  open,
  onOpenChange,
  candidateId,
  onAnalyzed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  onAnalyzed: (a: ResumeAnalysis) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload resume</DialogTitle>
          <DialogDescription>
            The file is checked and analyzed. The candidate's profile only changes after you confirm.
          </DialogDescription>
        </DialogHeader>
        <Body candidateId={candidateId} onClose={() => onOpenChange(false)} onAnalyzed={onAnalyzed} />
      </DialogContent>
    </Dialog>
  );
}
