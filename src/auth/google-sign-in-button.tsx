"use client";

import { Button } from "@measure-twice/react";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import styles from "./auth.module.scss";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "rectangular";
      width: number;
      locale: "ko";
    },
  ): void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityApi;
      };
    };
  }
}

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_JOBVIS_GOOGLE_CLIENT_ID?.trim() ?? "";

export function GoogleSignInButton() {
  const {
    createChallenge,
    exchangeIdentityToken,
    isDemoMode,
    signInDemo,
  } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<
    "loading" | "ready" | "signing-in" | "error"
  >("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isDemoMode || !sdkReady || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    async function renderGoogleButton() {
      setStatus("loading");
      try {
        const challenge = await createChallenge("google");
        if (cancelled || !buttonRef.current || !window.google) return;

        buttonRef.current.replaceChildren();
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: challenge.nonce,
          callback(response) {
            if (!response.credential) {
              setMessage("Google 인증 정보를 받지 못했습니다.");
              setStatus("error");
              return;
            }

            setStatus("signing-in");
            setMessage("");
            void exchangeIdentityToken(
              "google",
              response.credential,
              challenge,
            ).catch((error: unknown) => {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Google 로그인에 실패했습니다.",
              );
              setStatus("error");
              setRetryKey((current) => current + 1);
            });
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 320,
          locale: "ko",
        });
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Google 로그인을 준비하지 못했습니다.",
        );
        setStatus("error");
      }
    }

    void renderGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [createChallenge, exchangeIdentityToken, isDemoMode, retryKey, sdkReady]);

  if (isDemoMode) {
    return (
      <Button
        tone="neutral"
        variant="outline"
        onClick={signInDemo}
      >
        Google로 시작하기
      </Button>
    );
  }

  if (!GOOGLE_CLIENT_ID) {
    return (
      <>
        <Button tone="neutral" variant="outline" disabled>
          Google 로그인 설정 필요
        </Button>
        <p className={styles["auth-provider-message"]} role="status">
          Google Client ID가 설정되지 않았습니다.
        </p>
      </>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => {
          setMessage("Google 로그인 모듈을 불러오지 못했습니다.");
          setStatus("error");
        }}
      />
      <div
        className={styles["auth-google-button"]}
        ref={buttonRef}
        aria-busy={status === "loading" || status === "signing-in"}
      />
      {status === "loading" ? (
        <p className={styles["auth-provider-message"]} role="status">
          Google 로그인을 준비하고 있습니다.
        </p>
      ) : null}
      {status === "signing-in" ? (
        <p className={styles["auth-provider-message"]} role="status">
          로그인 정보를 확인하고 있습니다.
        </p>
      ) : null}
      {message ? (
        <p className={styles["auth-provider-error"]} role="alert">
          {message}
        </p>
      ) : null}
    </>
  );
}
