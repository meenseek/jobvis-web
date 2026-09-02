import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./public-page.module.scss";

type PublicPageProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

export function PublicPage({
  children,
  description,
  eyebrow,
  title,
}: PublicPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/about" aria-label="Jobvis 소개">
          <span className="brand-mark" aria-hidden="true">
            J
          </span>
          <span>Jobvis</span>
        </Link>
        <nav className={styles.nav} aria-label="공개 메뉴">
          <Link href="/about">서비스 소개</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">서비스 약관</Link>
          <Link className={styles.login} href="/">
            로그인
          </Link>
        </nav>
      </header>

      <main className={styles.main} id="main-content">
        <article className={styles.article}>
          <div className={styles.hero}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>
          <div className={styles.content}>{children}</div>
        </article>
      </main>

      <footer className={styles.footer}>
        <span>© 2026 Jobvis</span>
        <a href="mailto:taeydev59@gmail.com">taeydev59@gmail.com</a>
      </footer>
    </div>
  );
}
