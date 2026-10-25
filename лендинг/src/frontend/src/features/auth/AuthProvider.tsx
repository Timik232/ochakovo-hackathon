import {
  useQuery,
  useQueryClient,
  type MutationCacheNotifyEvent,
  type QueryCacheNotifyEvent,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  AuthApiError,
  clearCsrfToken,
  fetchMe,
  loginRequest,
  logoutRequest,
  type LoginOutcome,
} from "./api";
import { AuthContext, ME_QUERY_KEY } from "./AuthContext";
import type { EmployeeView } from "./types";

function isUnauthorized(error: unknown): boolean {
  return error instanceof AuthApiError && error.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [logoutInFlight, setLogoutInFlight] = useState(false);

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    retry: false,
    enabled: !logoutInFlight,
  });

  /*
   * 401 в ЛЮБОМ запросе (кроме /me — он легитимно 401 у анонима) означает
   * отозванную/истёкшую сессию: чистим CSRF, весь Query-кэш (там PII
   * кандидатов) и уходим на /login. Защита от цикла: после clear() /me
   * перезапросится, но исключён по ключу.
   */
  useEffect(() => {
    const onQueryEvent = (event: QueryCacheNotifyEvent) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (event.query.queryKey[0] === "me") return;
      if (!isUnauthorized(event.action.error)) return;
      clearCsrfToken();
      void queryClient.clear();
      navigate("/login", { replace: true });
    };
    const onMutationEvent = (event: MutationCacheNotifyEvent) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (!isUnauthorized(event.action.error)) return;
      clearCsrfToken();
      void queryClient.clear();
      navigate("/login", { replace: true });
    };
    const unsubscribeQueries = queryClient.getQueryCache().subscribe(onQueryEvent);
    const unsubscribeMutations = queryClient.getMutationCache().subscribe(onMutationEvent);
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, navigate]);

  const refreshMe = useCallback(
    async (): Promise<EmployeeView | null> => {
      try {
        return await queryClient.fetchQuery({
          queryKey: ME_QUERY_KEY,
          queryFn: fetchMe,
          staleTime: 0,
        });
      } catch {
        return null;
      }
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const outcome = await loginRequest(email, password);
      if (outcome.ok) {
        await queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
      }
      return outcome;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    setLogoutInFlight(true);
    await logoutRequest();
    clearCsrfToken();
    await queryClient.clear();
    navigate("/login", { replace: true });
    setLogoutInFlight(false);
  }, [navigate, queryClient]);

  const value = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      isLoading: meQuery.isPending || logoutInFlight,
      isUnavailable: meQuery.isError && !isUnauthorized(meQuery.error),
      login,
      logout,
      refreshMe,
    };
  }, [meQuery.data, meQuery.isPending, meQuery.isError, meQuery.error, logoutInFlight, login, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
