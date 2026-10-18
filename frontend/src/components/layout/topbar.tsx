import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { titleForPath } from "./nav-items";
import { UserMenu } from "./user-menu";

export function Topbar({
  collapsed,
  onToggleCollapsed,
  onOpenMobileNav,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobileNav: () => void;
}) {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>
      <p className="text-sm font-medium text-slate-500">{titleForPath(pathname)}</p>
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}
