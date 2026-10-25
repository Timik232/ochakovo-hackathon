import { createContext, useContext } from "react";
import type { EmployeeView } from "./types";
import type { LoginOutcome } from "./api";

export const ME_QUERY_KEY = ["me"] as const;

export interface AuthContextValue {
  user: EmployeeView | null;
  isLoading: boolean;
  /** true — /me упал не из-за 401 (нет связи): экран с повтором вместо редиректа. */
  isUnavailable: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<EmployeeView | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth вызван вне AuthProvider");
  }
  return context;
}
