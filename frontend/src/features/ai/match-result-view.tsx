import { Pill } from "@/components/common/badges";
import type { MatchDetail, SkillEvidence, UnverifiedSkill } from "@/types/api";

function Matched({ title, items }: { title: string; items: SkillEvidence[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="mb-2 text-sm font-medium text-slate-900">{title}</h4>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.skill} className="text-sm">
            <span className="font-medium">{s.skill}</span>{" "}
            {s.source === "resume" ? (
              <Pill className="bg-emerald-50 text-emerald-800 ring-emerald-200">Found in resume</Pill>
            ) : (
              <Pill className="bg-slate-100 text-slate-700 ring-slate-200">From profile, not in resume text</Pill>
            )}
            {s.evidence && <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground">“{s.evidence}”</blockquote>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Unverified({ title, items }: { title: string; items: UnverifiedSkill[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="mb-2 text-sm font-medium text-slate-900">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span key={s.skill} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
            {s.skill}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{items[0]?.note}</p>
    </section>
  );
}

export function MatchResultView({ match }: { match: MatchDetail }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        {match.score === null ? (
          <p className="text-sm text-muted-foreground">Not enough information to calculate a score.</p>
        ) : (
          <p aria-label={`Match score ${Math.round(match.score)} out of 100`}>
            <span className="text-5xl font-semibold tabular-nums text-slate-900">{Math.round(match.score)}</span>
            <span className="ml-1 text-lg text-muted-foreground">/ 100</span>
          </p>
        )}
        <Pill className="mb-1.5 bg-slate-100 text-slate-700 ring-slate-200">Keyword and text-similarity heuristic</Pill>
      </div>

      {match.warnings.length > 0 && (
        <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-sm text-amber-900">
          {match.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby="match-components">
        <h4 id="match-components" className="mb-3 text-sm font-medium text-slate-900">
          How the score is built
        </h4>
        <ul className="space-y-3">
          {match.components.map((c) => (
            <li key={c.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-800">{c.label}</span>
                <span className="tabular-nums text-slate-600">
                  {c.value === null ? "Not assessed" : `${Math.round(c.value * 100)}%`}
                  {c.value !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">weight {Math.round(c.weight * 100)}%</span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.round((c.value ?? 0) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5">
          <Matched title="Required skills with evidence" items={match.matched_required} />
          <Matched title="Preferred skills with evidence" items={match.matched_preferred} />
        </div>
        <div className="space-y-5">
          <Unverified title="Required skills not verified" items={match.unverified_required} />
          <Unverified title="Preferred skills not verified" items={match.unverified_preferred} />
        </div>
      </div>

      <section>
        <h4 className="mb-1 text-sm font-medium text-slate-900">Experience</h4>
        <p className="text-sm text-slate-700">{match.experience.note}</p>
      </section>

      <details className="text-sm">
        <summary className="cursor-pointer text-brand-600">Method</summary>
        <p className="mt-2 text-muted-foreground">{match.method}</p>
      </details>

      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">{match.disclaimer}</p>
    </div>
  );
}
