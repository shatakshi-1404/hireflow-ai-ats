import type { User, UserRole } from "@/types/api";

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Admin",
  RECRUITER: "Recruiter",
  VIEWER: "Viewer",
};

export const canWrite = (user: User): boolean => user.role === "ADMIN" || user.role === "RECRUITER";
export const isAdmin = (user: User): boolean => user.role === "ADMIN";
