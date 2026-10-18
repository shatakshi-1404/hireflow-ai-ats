import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi, type RegisterPayload } from "./api";
import { meQueryKey } from "./keys";

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Drop everything cached for the previous user. Only the session entry survives. */
function purgeUserData(qc: QueryClient): void {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) => authApi.login(v.email, v.password),
    onSuccess: (user) => {
      purgeUserData(qc);
      qc.setQueryData(meQueryKey, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (user) => {
      purgeUserData(qc);
      qc.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      purgeUserData(qc);
      qc.setQueryData(meQueryKey, null);
    },
    onError: () => toast.error("Could not sign out. Please try again."),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (v: { current_password: string; new_password: string }) =>
      authApi.changePassword(v.current_password, v.new_password),
  });
}
