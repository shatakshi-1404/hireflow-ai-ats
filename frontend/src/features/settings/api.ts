import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { User, UserRole } from "@/types/api";

export function useTeam() {
  return useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => api.get<User[]>("/users", undefined, signal),
    staleTime: 60_000,
  });
}

export interface NewUser {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: NewUser) => api.post<User>("/users", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { role?: UserRole; is_active?: boolean } }) =>
      api.patch<User>(`/users/${id}`, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
