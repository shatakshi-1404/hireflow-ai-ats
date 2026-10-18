import { describeActivity } from "@/lib/activity";
import { timeAgo } from "@/lib/format";
import type { RecentActivity } from "@/types/api";

export function ActivityFeed({ items }: { items: RecentActivity[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="text-slate-900">
              {a.candidate_name && <span className="font-medium">{a.candidate_name} · </span>}
              {describeActivity(a)}
            </p>
            <p className="text-xs text-muted-foreground">by {a.actor_name ?? "System"}</p>
          </div>
          <time dateTime={a.created_at} className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(a.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
