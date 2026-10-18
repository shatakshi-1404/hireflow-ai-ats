import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-8 w-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-brand-500" />
      <path
        d="M10 22V10m12 12V10M10 16h12"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({ collapsed = false, onDark = false }: { collapsed?: boolean; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className={cn("text-lg font-semibold tracking-tight", onDark ? "text-white" : "text-navy-900")}>
          HireFlow <span className="text-brand-500">AI</span>
        </span>
      )}
      {collapsed && <span className="sr-only">HireFlow AI</span>}
    </div>
  );
}
