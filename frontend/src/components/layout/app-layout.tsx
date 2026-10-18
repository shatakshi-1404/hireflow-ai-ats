import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Wordmark } from "@/components/common/logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { titleForPath } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

export function AppLayout() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${titleForPath(pathname)} · HireFlow AI`;
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy-900 text-white transition-[width] duration-200 lg:flex",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center" : "px-5")}>
            <Wordmark collapsed={collapsed} onDark />
          </div>
          <SidebarNav collapsed={collapsed} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-72 gap-0 border-0 bg-navy-900 p-0 text-white [&>button]:text-white"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Main navigation</SheetTitle>
              <SheetDescription>Navigate between sections of HireFlow AI</SheetDescription>
            </SheetHeader>
            <div className="flex h-16 items-center border-b border-white/10 px-5">
              <Wordmark onDark />
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
          <Topbar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
