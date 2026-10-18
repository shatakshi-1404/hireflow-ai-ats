import { ChevronDown, LoaderCircle, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/features/auth/hooks";
import { useCurrentUser } from "@/features/auth/user-context";
import { ROLE_LABEL } from "@/lib/permissions";

export function UserMenu() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-2" aria-label="Open user menu">
          <InitialsAvatar name={user.full_name} size="sm" />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-slate-900">{user.full_name}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{user.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings")}>
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={(e) => {
            e.preventDefault(); // keep the menu mounted until the request finishes
            logout.mutate();
          }}
        >
          {logout.isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
