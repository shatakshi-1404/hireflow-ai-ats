import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { meQueryKey } from "@/features/auth/keys";
import { ApiError, setUnauthorizedHandler } from "@/lib/api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Never retry 4xx (they won't change); retry network/5xx twice.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
    mutations: { retry: false },
  },
});

// A 401 on any non-auth request means the session ended: drop it so route guards redirect to login.
setUnauthorizedHandler(() => {
  if (queryClient.getQueryData(meQueryKey)) {
    queryClient.setQueryData(meQueryKey, null);
    toast.info("Your session has expired. Please sign in again.", { id: "session-expired" });
  }
});
