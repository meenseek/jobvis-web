"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthProviderId = "google" | "kakao" | "email";

export type AuthUser = {
  displayName: string;
  primaryEmail: string;
  provider: AuthProviderId;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isMockMode: boolean;
  user: AuthUser | null;
  signIn: (provider: AuthProviderId, email?: string) => void;
  signOut: () => void;
};

const AUTH_STORAGE_KEY = "jobvis.auth.user";
const isMockMode = process.env.NEXT_PUBLIC_JOBVIS_API_MODE === "mock";
const authBypass = process.env.NEXT_PUBLIC_JOBVIS_AUTH_BYPASS === "1";
const bypassUser: AuthUser = {
  displayName: "데모 사용자",
  primaryEmail: "demo@jobvis.example",
  provider: "google",
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function storeUser(user: AuthUser | null) {
  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function createDemoUser(provider: AuthProviderId, email?: string): AuthUser {
  if (provider === "kakao") {
    return {
      displayName: "카카오 데모 사용자",
      primaryEmail: email?.trim() || "mock.kakao@jobvis.example",
      provider,
    };
  }

  if (provider === "google") {
    return {
      displayName: "구글 데모 사용자",
      primaryEmail: email?.trim() || "mock.google@jobvis.example",
      provider,
    };
  }

  return {
    displayName: "지원자님",
    primaryEmail: email?.trim() || "mock.email@jobvis.example",
    provider,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(
    authBypass ? bypassUser : null,
  );

  useEffect(() => {
    if (authBypass) return;
    const frame = requestAnimationFrame(() => {
      setUser(readStoredUser());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user),
      isMockMode,
      user,
      signIn(provider, email) {
        const nextUser = createDemoUser(provider, email);
        setUser(nextUser);
        storeUser(nextUser);
      },
      signOut() {
        setUser(null);
        storeUser(null);
      },
    }),
    [user],
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
