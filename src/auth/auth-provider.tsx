"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { components } from "../contracts/jobvis-api.generated";

export type AuthProviderId = components["schemas"]["LoginProvider"];

export type AuthUser = {
  id: string;
  displayName: string;
  primaryEmail: string;
};

export type LoginChallenge = components["schemas"]["LoginChallenge"];
type CreateLoginChallengeRequest =
  components["schemas"]["CreateLoginChallengeRequest"];
type ExchangeIdentityTokenRequest =
  components["schemas"]["ExchangeIdentityTokenRequest"];

type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

type AuthContextValue = {
  canSignOut: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  status: AuthStatus;
  user: AuthUser | null;
  createChallenge: (provider: AuthProviderId) => Promise<LoginChallenge>;
  expireSession: () => void;
  exchangeIdentityToken: (
    provider: AuthProviderId,
    idToken: string,
    challenge: LoginChallenge,
  ) => Promise<void>;
  signInDemo: (provider: AuthProviderId) => void;
  retrySession: () => void;
  signOut: () => Promise<void>;
};

type ApiAuthUser = components["schemas"]["AuthUser"];

const MOCK_AUTH_STORAGE_KEY = "jobvis.mock-auth.user";
const isMockMode = process.env.NEXT_PUBLIC_JOBVIS_API_MODE === "mock";
const isLocalMode = process.env.NEXT_PUBLIC_JOBVIS_API_MODE === "local";
const isSitesMode = process.env.NEXT_PUBLIC_JOBVIS_API_MODE === "sites";
const isDemoMode = isMockMode || isLocalMode;
const authBypass = process.env.NEXT_PUBLIC_JOBVIS_AUTH_BYPASS === "1";
const bypassUser: AuthUser = {
  id: "demo-user",
  displayName: "데모 사용자",
  primaryEmail: "demo@jobvis.example",
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(user: ApiAuthUser): AuthUser {
  return {
    id: user.id,
    displayName: user.displayName?.trim() || "지원자님",
    primaryEmail: user.primaryEmail?.trim() || "개인 계정",
  };
}

function readStoredDemoUser() {
  try {
    const raw = window.localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function storeDemoUser(user: AuthUser | null) {
  if (!user) {
    window.localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(user));
}

function createDemoUser(provider: AuthProviderId): AuthUser {
  return provider === "kakao"
    ? {
        id: "mock-kakao-user",
        displayName: "카카오 데모 사용자",
        primaryEmail: "mock.kakao@jobvis.example",
      }
    : {
        id: "mock-google-user",
        displayName: "구글 데모 사용자",
        primaryEmail: "mock.google@jobvis.example",
      };
}

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    detail?: string;
    message?: string;
  } | null;
  return (
    body?.detail ||
    body?.message ||
    `인증 요청에 실패했습니다. (${response.status})`
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    authBypass ? "authenticated" : "loading",
  );
  const [user, setUser] = useState<AuthUser | null>(
    authBypass ? bypassUser : null,
  );
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    if (authBypass) return;

    let cancelled = false;
    async function restoreSession() {
      if (isDemoMode) {
        const storedUser = readStoredDemoUser();
        if (cancelled) return;
        setUser(storedUser);
        setStatus(storedUser ? "authenticated" : "unauthenticated");
        return;
      }

      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) {
          setUser(null);
          setStatus(isSitesMode ? "unavailable" : "unauthenticated");
          return;
        }
        if (!response.ok) {
          setUser(null);
          setStatus("unavailable");
          return;
        }

        const restoredUser = normalizeUser(
          (await response.json()) as ApiAuthUser,
        );
        if (cancelled) return;
        setUser(restoredUser);
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        setUser(null);
        setStatus("unavailable");
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  const expireSession = useCallback(() => {
    setUser(null);
    setStatus(isSitesMode ? "unavailable" : "unauthenticated");
  }, []);

  const retrySession = useCallback(() => {
    setUser(null);
    setStatus("loading");
    setRestoreAttempt((attempt) => attempt + 1);
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode) {
      storeDemoUser(null);
    } else {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        keepalive: true,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
    }
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      canSignOut: !isSitesMode,
      isAuthenticated: status === "authenticated",
      isDemoMode,
      status,
      user,
      expireSession,
      async createChallenge(provider) {
        const response = await fetch("/api/auth/challenges", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            { provider } satisfies CreateLoginChallengeRequest,
          ),
        });
        if (!response.ok) throw new Error(await responseMessage(response));
        return (await response.json()) as LoginChallenge;
      },
      async exchangeIdentityToken(provider, idToken, challenge) {
        const response = await fetch("/api/auth/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            {
              provider,
              idToken,
              challengeToken: challenge.challengeToken,
              nonce: challenge.nonce,
            } satisfies ExchangeIdentityTokenRequest,
          ),
        });
        if (!response.ok) throw new Error(await responseMessage(response));

        const session = (await response.json()) as { user: ApiAuthUser };
        setUser(normalizeUser(session.user));
        setStatus("authenticated");
      },
      signInDemo(provider) {
        if (!isDemoMode) return;
        const nextUser = createDemoUser(provider);
        setUser(nextUser);
        setStatus("authenticated");
        storeDemoUser(nextUser);
      },
      retrySession,
      signOut,
    }),
    [expireSession, retrySession, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
