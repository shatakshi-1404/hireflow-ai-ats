import { Info, Sparkles } from "lucide-react";
import { Pill } from "@/components/common/badges";
import { useAiStatus } from "./api";
import { isAiModel, providerLabel } from "./helpers";

export function ProviderBadge({ provider, model }: { provider: string; model?: string | null }) {
  const ai = isAiModel(provider);
  return (
    <Pill className={ai ? "bg-teal-50 text-teal-800 ring-teal-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
      {providerLabel(provider, model)}
    </Pill>
  );
}

export function AiModeBanner() {
  const status = useAiStatus();
  if (!status.data) return null;
  const s = status.data;
  const Icon = s.configured ? Sparkles : Info;
  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
      {s.configured ? (
        <span>
          A language model ({s.provider}
          {s.model ? ` · ${s.model}` : ""}) is enabled for resume summaries and interview questions. Review
          everything it produces. Match scores are always computed by deterministic rules.
        </span>
      ) : (
        <span>
          No AI provider is configured. Resume analysis uses keyword rules and interview questions come from
          built-in templates. Match scoring is unaffected.
        </span>
      )}
    </p>
  );
}
