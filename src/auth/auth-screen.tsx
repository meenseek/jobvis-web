"use client";

import { Button } from "@measure-twice/react";
import { useAuth } from "./auth-provider";
import styles from "./auth.module.scss";

export function AuthScreen() {
  const { signIn } = useAuth();

  return (
    <main className={styles["auth-page"]} id="main-content">
      <section className={styles["auth-panel"]} aria-labelledby="auth-title">
        <div className={styles["auth-brand"]}>
          <span className="brand-mark" aria-hidden="true">
            J
          </span>
          <span>Jobvis</span>
        </div>

        <div className={styles["auth-copy"]}>
          <p className="eyebrow">개인 구직 비서</p>
          <h1 id="auth-title">
            지원 메일, 진행 상태와 일정을 한곳에서 정리하세요.
          </h1>
          <p>
            로그인 계정은 Jobvis 데이터 저장에만 사용하고,
            <br />
            채용 메일 연결은
            별도 동의 후 시작합니다.
          </p>
        </div>

        <div className={styles["auth-social-actions"]}>
          <Button
            tone="neutral"
            variant="outline"
            onClick={() => signIn("google")}
          >
            Google로 시작하기
          </Button>
          <Button
            tone="neutral"
            variant="outline"
            onClick={() => signIn("kakao")}
          >
            Kakao로 시작하기
          </Button>
        </div>

        <p className={styles["auth-consent-copy"]}>
          계속하면 Jobvis 계정이 생성되거나 기존 계정으로 로그인됩니다.
        </p>
      </section>
    </main>
  );
}
