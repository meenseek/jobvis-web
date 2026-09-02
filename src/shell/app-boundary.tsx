"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ApplicationProvider } from "../applications/application-provider";
import { AuthGate } from "../auth/auth-gate";
import { AuthProvider } from "../auth/auth-provider";
import { AccountSettingsProvider } from "../settings/account-settings-provider";
import { AppShell } from "./app-shell";

const publicPaths = new Set(["/about", "/privacy", "/terms"]);

export function AppBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (publicPaths.has(pathname)) return children;

  return (
    <AuthProvider>
      <AuthGate>
        <AccountSettingsProvider>
          <ApplicationProvider>
            <AppShell>{children}</AppShell>
          </ApplicationProvider>
        </AccountSettingsProvider>
      </AuthGate>
    </AuthProvider>
  );
}
