"use client";

import { ReactNode } from "react";
import { AuthScreen } from "./auth-screen";
import { useAuth } from "./auth-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <AuthScreen />;
}
