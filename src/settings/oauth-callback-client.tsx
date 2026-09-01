"use client";

import { StatusIndicator } from "@measure-twice/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  storedMailOAuthProvider,
  useAccountSettings,
} from "./account-settings-provider";

export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOAuth } = useAccountSettings();
  const completeOAuthRef = useRef(completeOAuth);
  const started = useRef(false);
  const [message, setMessage] = useState("메일 연결 승인을 확인하고 있습니다.");
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");

  useEffect(() => {
    completeOAuthRef.current = completeOAuth;
  }, [completeOAuth]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;
    const provider = storedMailOAuthProvider();
    if (!provider || !state || !code || providerError) {
      const frame = window.requestAnimationFrame(() => {
        if (active) setMessage("메일 연결 승인 정보가 없거나 취소되었습니다.");
      });
      return () => window.cancelAnimationFrame(frame);
    }
    void completeOAuthRef.current(provider, state, code).then((completed) => {
      if (!active) return;
      if (completed) {
        router.replace("/settings?connected=mail");
      } else {
        setMessage("메일 연결을 완료하지 못했습니다. 설정에서 다시 시작해 주세요.");
      }
    });
    return () => {
      active = false;
    };
  }, [code, providerError, router, state]);

  return (
    <main id="main-content" className="main-content">
      <section className="page-heading">
        <div>
          <h1>채용 메일 연결</h1>
          <StatusIndicator tone="neutral">{message}</StatusIndicator>
        </div>
      </section>
    </main>
  );
}
