import { Sparkles, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/common/logo";

const POINTS = [
  { icon: Users, text: "Track every candidate across a clear hiring pipeline." },
  { icon: Sparkles, text: "Understand candidate-to-job relevance with explainable matching." },
  { icon: TrendingUp, text: "Monitor recruitment performance with live metrics." },
];

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
        <Wordmark onDark />
        <div className="max-w-md space-y-8">
          <h2 className="text-3xl font-semibold leading-tight">Smarter hiring. Clearer decisions.</h2>
          <ul className="space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-slate-300">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10 text-brand-500">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">Demo project. Please don't enter real candidate data.</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  );
}
