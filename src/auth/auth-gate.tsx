"use client";

import { Button } from "@measure-twice/react";
import { ReactNode } from "react";
import { AuthScreen } from "./auth-screen";
import { useAuth } from "./auth-provider";
import styles from "./auth.module.scss";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, retrySession, status } = useAuth();
  if (status === "loading") {
    return (
      <main
        className={styles["auth-loading"]}
        id="main-content"
        aria-busy="true"
      >
        로그인 상태를 확인하고 있습니다.
      </main>
    );
  }
  if (status === "unavailable") {
    return (
      <main className={styles["auth-loading"]} id="main-content">
        <div className={styles["auth-loading-content"]} role="alert">
          <p>로그인 상태를 확인하지 못했습니다.</p>
          <Button tone="neutral" variant="outline" onClick={retrySession}>
            다시 시도
          </Button>
        </div>
      </main>
    );
  }
  return isAuthenticated ? children : <AuthScreen />;
}
