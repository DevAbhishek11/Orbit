import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, setAccessToken, setSessionHooks } from "../api/client";
import { authApi, usersApi, workspacesApi } from "../api/endpoints";
import type { Role, User, Workspace } from "../api/types";

const WORKSPACE_KEY = "orbit.workspaceId";

type Status = "loading" | "anonymous" | "authenticated";

interface AuthContextValue {
  status: Status;
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  workspace: Workspace | null;
  role: Role | null;
  bootError: string | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    name: string;
    handle?: string;
  }) => Promise<void>;
  signOut: (allDevices: boolean) => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<Workspace[]>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(() =>
    localStorage.getItem(WORKSPACE_KEY),
  );
  const [role, setRole] = useState<Role | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const booted = useRef(false);

  const loadWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    const { workspaces: list } = await workspacesApi.list();
    setWorkspaces(list);
    return list;
  }, []);

  const applyAuth = useCallback(
    async (next: {
      user: User;
      accessToken: string;
      workspaceId: string | null;
      role: Role | null;
    }) => {
      setAccessToken(next.accessToken);
      setUser(next.user);
      if (next.workspaceId) {
        setWorkspaceId(next.workspaceId);
        localStorage.setItem(WORKSPACE_KEY, next.workspaceId);
      }
      setRole(next.role ?? null);
      setStatus("authenticated");
    },
    [],
  );

  const clearSession = useCallback(() => {
    queryClient.clear();
    setAccessToken(null);
    setUser(null);
    setWorkspaces([]);
    setWorkspaceId(null);
    setRole(null);
    localStorage.removeItem(WORKSPACE_KEY);
    setStatus("anonymous");
  }, [queryClient]);

  useEffect(() => {
    setSessionHooks({
      onRefreshed: (auth) => {
        setUser(auth.user as User);
        if (auth.workspaceId) {
          setWorkspaceId(auth.workspaceId);
          localStorage.setItem(WORKSPACE_KEY, auth.workspaceId);
        }
        setRole((auth.role as Role | null) ?? null);
        setStatus("authenticated");
      },
      onLost: () => {
        setStatus((current) =>
          current === "authenticated" ? "anonymous" : current,
        );
        setUser(null);
      },
    });
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    (async () => {
      try {
        const me = await usersApi.me();
        setUser(me);
        const list = await loadWorkspaces();

        const remembered = localStorage.getItem(WORKSPACE_KEY);
        const tokenWorkspace = list.find((w) => w.id === remembered)
          ? remembered
          : null;
        const target = tokenWorkspace ?? list[0]?.id ?? null;

        if (!target) {
          setWorkspaceId(null);
          setRole(null);
          setStatus("authenticated");
          return;
        }

        const scope = await authApi.switchWorkspace(target);
        setAccessToken(scope.accessToken);
        setWorkspaceId(scope.workspaceId);
        setRole(scope.role);
        localStorage.setItem(WORKSPACE_KEY, scope.workspaceId);
        setStatus("authenticated");
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.code === "UNAUTHENTICATED")
        ) {
          setStatus("anonymous");
          return;
        }
        setBootError(
          err instanceof Error ? err.message : "Could not reach the Orbit API",
        );
        setStatus("anonymous");
      }
    })();
  }, [loadWorkspaces]);

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const result = await authApi.login({ email, password, remember });
      await applyAuth(result);
      await loadWorkspaces();
    },
    [applyAuth, loadWorkspaces],
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      handle?: string;
    }) => {
      const result = await authApi.register(input);
      await applyAuth(result);
      await loadWorkspaces();
    },
    [applyAuth, loadWorkspaces],
  );

  const signOut = useCallback(
    async (allDevices: boolean) => {
      try {
        await authApi.logout(allDevices);
      } finally {
        clearSession();
      }
    },
    [clearSession],
  );

  const selectWorkspace = useCallback(async (nextWorkspaceId: string) => {
    const scope = await authApi.switchWorkspace(nextWorkspaceId);
    setAccessToken(scope.accessToken);
    setWorkspaceId(scope.workspaceId);
    setRole(scope.role);
    localStorage.setItem(WORKSPACE_KEY, scope.workspaceId);
  }, []);

  const workspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) ?? null,
    [workspaces, workspaceId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      workspaces,
      workspaceId,
      workspace,
      role,
      bootError,
      signIn,
      signUp,
      signOut,
      selectWorkspace,
      refreshWorkspaces: loadWorkspaces,
      setUser,
    }),
    [
      status,
      user,
      workspaces,
      workspaceId,
      workspace,
      role,
      bootError,
      signIn,
      signUp,
      signOut,
      selectWorkspace,
      loadWorkspaces,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
