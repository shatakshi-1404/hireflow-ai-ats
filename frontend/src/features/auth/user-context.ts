import { createContext, useContext } from "react";
import type { User } from "@/types/api";

export const UserContext = createContext<User | null>(null);

/** Only valid inside protected routes, where RequireAuth provides the user. */
export function useCurrentUser(): User {
  const user = useContext(UserContext);
  if (!user) throw new Error("useCurrentUser must be used inside a protected route");
  return user;
}
