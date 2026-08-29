"use client";

import { SkipLink } from "@measure-twice/react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  House,
  LogOut,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "../auth/auth-provider";
import { useAccountSettings } from "../settings/account-settings-provider";
import {
  applicationDetailPath,
  safeApplicationListPath,
} from "../applications/application-navigation";
import { useApplications } from "../applications/application-provider";
import {
  closeOpenApplicationTab,
  type OpenApplicationTab,
  upsertOpenApplicationTab,
} from "../applications/application-tabs";
import {
  formatMailSyncTime,
  mailProviderLabel,
} from "../settings/settings-state";
import { cn } from "../ui/class-names";
import styles from "./shell.module.scss";

const primaryNavItems = [
  { icon: House, label: "홈", href: "/", match: "home" },
  {
    icon: BriefcaseBusiness,
    label: "지원 현황",
    href: "/applications",
    match: "applications",
  },
  {
    icon: CalendarDays,
    label: "캘린더",
    href: "/calendar",
    match: "calendar",
  },
  {
    icon: ChartNoAxesCombined,
    label: "통계",
    href: "/analytics",
    match: "analytics",
  },
  {
    icon: Settings2,
    label: "설정",
    href: "/settings",
    match: "settings",
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { applications } = useApplications();
  const { mailConnection } = useAccountSettings();
  const lastMailSyncTime = mailConnection
    ? formatMailSyncTime(mailConnection.lastSyncedAt)
    : null;
  const mailProviderName = mailConnection
    ? mailProviderLabel(mailConnection.provider)
    : null;
  const currentApplication = applications.find(
    (application) => pathname === `/applications/${application.id}`,
  );
  const currentApplicationId = currentApplication?.id;
  const [currentReturnPath, setCurrentReturnPath] = useState("/applications");
  const [openApplicationTabs, setOpenApplicationTabs] = useState<
    OpenApplicationTab[]
  >(() =>
    currentApplicationId
      ? [{ id: currentApplicationId, returnPath: currentReturnPath }]
      : [],
  );
  const openApplications = openApplicationTabs.flatMap((tab) => {
    const application = applications.find((item) => item.id === tab.id);
    return application ? [{ ...tab, application }] : [];
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCurrentReturnPath(
        safeApplicationListPath(
          new URLSearchParams(window.location.search).get("from"),
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!currentApplicationId) return;
    const frame = requestAnimationFrame(() => {
      setOpenApplicationTabs((current) =>
        upsertOpenApplicationTab(current, {
          id: currentApplicationId,
          returnPath: currentReturnPath,
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [currentApplicationId, currentReturnPath]);

  function isActive(match: (typeof primaryNavItems)[number]["match"]) {
    if (match === "home") return pathname === "/";
    if (match === "applications") return pathname === "/applications";
    return pathname.startsWith(`/${match}`);
  }

  function closeApplicationTab(id: string) {
    const result = closeOpenApplicationTab(openApplicationTabs, id);
    setOpenApplicationTabs(result.tabs);

    if (currentApplicationId !== id) return;
    router.push(
      result.nextTab
        ? applicationDetailPath(
            result.nextTab.id,
            result.nextTab.returnPath,
          )
        : (result.closedTab?.returnPath ?? "/applications"),
    );
  }

  return (
    <>
      <SkipLink href="#main-content">본문으로 건너뛰기</SkipLink>
      <div className={styles["app-shell"]}>
        <aside className={styles.sidebar}>
          <Link className={styles.brand} href="/" aria-label="Jobvis 홈">
            <span className="brand-mark" aria-hidden="true">
              J
            </span>
            <span>Jobvis</span>
          </Link>

          <nav className={styles["primary-nav"]} aria-label="주요 메뉴">
            {primaryNavItems.map((item) => {
              const NavIcon = item.icon;
              const active = isActive(item.match);
              const current = pathname === item.href;
              return (
                <Link
                  className={cn(
                    styles["nav-item"],
                    active && styles["is-active"],
                  )}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  key={item.label}
                >
                  <NavIcon className={styles["nav-icon"]} aria-hidden="true" />
                  <span className={styles["nav-item-label"]}>
                    {item.label}
                  </span>
                  {item.match === "applications" ? (
                    <span className={styles["nav-count"]}>
                      {applications.length}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {openApplications.length ? (
              <div
                className={styles["open-detail-tabs"]}
                role="group"
                aria-label="열린 지원 상세"
              >
                {openApplications.map(({ application, returnPath }) => {
                  const active = currentApplicationId === application.id;
                  return (
                    <div
                      className={cn(
                        styles["open-detail-tab"],
                        active && styles["is-active"],
                      )}
                      key={application.id}
                    >
                      <Link
                        className={styles["open-detail-tab-link"]}
                        href={applicationDetailPath(
                          application.id,
                          returnPath,
                        )}
                        aria-current={active ? "page" : undefined}
                        title={`${application.company} ${application.position}`}
                      >
                        <FileText
                          className={styles["nav-icon"]}
                          aria-hidden="true"
                        />
                        <span className={styles["nav-item-label"]}>
                          {application.company}
                        </span>
                      </Link>
                      <button
                        className={styles["open-detail-tab-close"]}
                        type="button"
                        onClick={() => closeApplicationTab(application.id)}
                        aria-label={`${application.company} 지원 상세 닫기`}
                        title="닫기"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </nav>

          <Link
            className={cn(
              styles["connection-card"],
              styles["connection-card-link"],
            )}
            href="/settings"
          >
            <div className={styles["connection-heading"]}>
              <span
                className={cn(
                  styles["connection-dot"],
                  !mailConnection && styles["is-pending"],
                )}
                aria-hidden="true"
              />
              <strong>
                {mailConnection
                  ? `${mailProviderName} 연결됨`
                  : "채용 메일 연결"}
              </strong>
            </div>
            <p>
              {mailConnection
                ? `마지막 동기화 ${lastMailSyncTime}`
                : "자동 정리를 시작해보세요"}
            </p>
          </Link>

          <div
            className={cn(
              styles["profile-card"],
              styles["profile-card-static"],
            )}
          >
            <span className={styles.avatar} aria-hidden="true">
              {user?.displayName.slice(0, 1) ?? "J"}
            </span>
            <span>
              <strong>{user?.displayName ?? "지원자님"}</strong>
              <small>{user?.primaryEmail ?? "개인 계정"}</small>
            </span>
            <button
              className={styles["profile-logout-button"]}
              type="button"
              onClick={signOut}
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </aside>

        <section className={styles.workspace}>
          <header className={styles.topbar}>
            <div className={styles["topbar-actions"]}>
              <span className={styles["sync-copy"]}>
                {mailConnection
                  ? `마지막 동기화 ${lastMailSyncTime}`
                  : "채용 메일 연결 안 됨"}
              </span>
            </div>
          </header>
          {children}
        </section>
      </div>
    </>
  );
}
