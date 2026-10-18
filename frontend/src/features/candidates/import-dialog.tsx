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
import type { ImportResult } from "@/types/api";
import { useImportCandidates } from "./api";

const MAX_BYTES = 1_000_000;

function ImportBody({ onClose }: { onClose: () => void }) {
  const importer = useImportCandidates();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const valid = preview ? preview.total_rows - preview.skipped : 0;

  function onPick(f: File | null) {
    importer.reset();
    setPreview(null);
    if (f && f.size > MAX_BYTES) {
      setFile(null);
      setLocalError("File is larger than 1 MB.");
      return;
    }
    setLocalError(null);
    setFile(f);
  }

  function validate() {
    if (!file) return;
    importer.mutate({ file, dryRun: true }, { onSuccess: setPreview });
  }

  function run() {
    if (!file) return;
    importer.mutate(
      { file, dryRun: false },
      {
        onSuccess: (r) => {
          toast.success(`Imported ${r.created} candidate${r.created === 1 ? "" : "s"}`);
          onClose();
        },
      },
    );
  }

  const error = localError ?? importer.error?.message ?? null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="csv-file">CSV file</Label>
        <Input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onPick(e.target.files?.item(0) ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Required columns: <code>full_name</code>, <code>email</code>. Optional: <code>phone</code>,{" "}
          <code>current_title</code>, <code>skills</code> (separated by ; or |), <code>years_experience</code>,{" "}
          <code>experience_summary</code>, <code>source</code>. Max 500 rows, 1 MB, UTF-8.
        </p>
      </div>

      {error && <FormAlert message={error} />}

      {preview && (
        <div className="space-y-3 rounded-lg border p-3 text-sm" aria-live="polite">
          <p>
            <strong>{valid}</strong> of {preview.total_rows} rows are ready to import
            {preview.skipped > 0 && <>, {preview.skipped} will be skipped</>}.
          </p>
          {preview.errors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Email</th>
                    <th className="px-2 py-1.5 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((e) => (
                    <tr key={`${e.row}-${e.error}`} className="border-t">
                      <td className="px-2 py-1.5 tabular-nums">{e.row}</td>
                      <td className="px-2 py-1.5">{e.email ?? "—"}</td>
                      <td className="px-2 py-1.5 text-red-700">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={importer.isPending}>
          Cancel
        </Button>
        {preview ? (
          <Button type="button" onClick={run} disabled={importer.isPending || valid === 0}>
            {importer.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Import {valid} candidate{valid === 1 ? "" : "s"}
          </Button>
        ) : (
          <Button type="button" onClick={validate} disabled={!file || importer.isPending}>
            {importer.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-4 w-4" aria-hidden="true" />
            )}
            Validate file
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import candidates from CSV</DialogTitle>
          <DialogDescription>
            Your file is checked first. Nothing is saved until you confirm the import.
          </DialogDescription>
        </DialogHeader>
        <ImportBody onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
