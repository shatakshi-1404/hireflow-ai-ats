import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { ErrorState } from "@/components/common/error-state";

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "An unexpected error occurred.";
  return (
    <ErrorState
      title="This page hit a problem"
      message={message}
      retryLabel="Reload page"
      onRetry={() => window.location.reload()}
    />
  );
}
