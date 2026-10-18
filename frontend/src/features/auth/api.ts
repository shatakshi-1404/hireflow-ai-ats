import { ApiError, api } from "@/lib/api-client";
import type { User } from "@/types/api";

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  workspace_name: string;
}

export const authApi = {
  /** Resolves to null when signed out (401), so "signed out" is a state rather than an error. */
  me: async (): Promise<User | null> => {
    try {
      return await api.get<User>("/auth/me");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  login: (email: string, password: string) => api.post<User>("/auth/login", { email, password }),
  register: (payload: RegisterPayload) => api.post<User>("/auth/register", payload),
  changePassword: (current_password: string, new_password: string) =>
    api.post<void>("/auth/change-password", { current_password, new_password }),
  logout: () => api.post<void>("/auth/logout"),
};
