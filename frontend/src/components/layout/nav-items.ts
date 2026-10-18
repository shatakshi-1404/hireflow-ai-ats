import {
  Briefcase,
  CalendarClock,
  Columns3,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/interviews", label: "Interviews", icon: CalendarClock },
  { to: "/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/ai", label: "AI Assistant", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function titleForPath(pathname: string): string {
  const matches = NAV_ITEMS.filter((i) =>
    i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`),
  ).sort((a, b) => b.to.length - a.to.length);
  return matches.at(0)?.label ?? "HireFlow AI";
}
