import { LoaderCircle } from "lucide-react";

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="h-5 w-5 animate-spin text-brand-500" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}
