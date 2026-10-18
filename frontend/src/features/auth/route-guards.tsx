import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ErrorState } from "@/components/common/error-state";
import { PageSpinner } from "@/components/common/page-spinner";
import { useMe } from "./hooks";
import { UserContext } from "./user-context";

/** Only same-origin app paths are accepted as post-login destinations. */
function safeRedirect(from: unknown): string {
  if (from && typeof from === "object") {
    const { pathname, search, hash } = from as { pathname?: unknown; search?: unknown; hash?: unknown };
    if (
      typeof pathname === "string" &&
      pathname.startsWith("/") &&
      !pathname.startsWith("//") &&
      pathname !== "/login" &&
      pathname !== "/register"
    ) {
      return `${pathname}${typeof search === "string" ? search : ""}${typeof hash === "string" ? hash : ""}`;
    }
  }
  return "/";
}

export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.data) {
    return (
      <UserContext.Provider value={me.data}>
        <Outlet />
      </UserContext.Provider>
    );
  }
  if (me.isPending) return <PageSpinner label="Loading your workspace…" />;
  if (me.isError) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <ErrorState
          title="Can't reach HireFlow"
          message={me.error.message}
          onRetry={() => void me.refetch()}
        />
      </div>
    );
  }
  return <Navigate to="/login" replace state={{ from: location }} />;
}

export function PublicOnly() {
  const me = useMe();
  const location = useLocation();

  if (me.data) {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeRedirect(from)} replace />;
  }
  if (me.isPending) return <PageSpinner label="Loading…" />;
  return <Outlet />;
}
