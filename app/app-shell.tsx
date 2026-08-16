"use client";

import { SkipLink } from "@measure-twice/react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  House,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useAccountSettings } from "./account-settings-provider";
import {
  applicationDetailPath,
  applicationListPath,
  safeApplicationListPath,
} from "./application-navigation";
import { useApplications } from "./application-provider";
import {
  closeOpenApplicationTab,
  type OpenApplicationTab,
  upsertOpenApplicationTab,
} from "./application-tabs";
import { formatMailSyncTime } from "./settings-state";

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
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { applications } = useApplications();
  const { mailConnection } = useAccountSettings();
  const lastMailSyncTime = mailConnection
    ? formatMailSyncTime(mailConnection.lastSyncedAt)
    : null;
  const currentApplication = applications.find(
    (application) => pathname === `/applications/${application.id}`,
  );
  const currentApplicationId = currentApplication?.id;
  const currentReturnPath = safeApplicationListPath(searchParams.get("from"));
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(applicationListPath(query, "all"));
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
      <div className="app-shell">
        <aside className="sidebar">
          <Link className="brand" href="/" aria-label="Jobvis 홈">
            <span className="brand-mark" aria-hidden="true">
              J
            </span>
            <span>Jobvis</span>
          </Link>

          <nav className="primary-nav" aria-label="주요 메뉴">
            {primaryNavItems.map((item) => {
              const NavIcon = item.icon;
              const active = isActive(item.match);
              const current = pathname === item.href;
              return (
                <Link
                  className={active ? "nav-item is-active" : "nav-item"}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  key={item.label}
                >
                  <NavIcon className="nav-icon" aria-hidden="true" />
                  <span className="nav-item-label">{item.label}</span>
                  {item.match === "applications" ? (
                    <span className="nav-count">{applications.length}</span>
                  ) : null}
                </Link>
              );
            })}

            {openApplications.length ? (
              <div
                className="open-detail-tabs"
                role="group"
                aria-label="열린 지원 상세"
              >
                {openApplications.map(({ application, returnPath }) => {
                  const active = currentApplicationId === application.id;
                  return (
                    <div
                      className={
                        active
                          ? "open-detail-tab is-active"
                          : "open-detail-tab"
                      }
                      key={application.id}
                    >
                      <Link
                        className="open-detail-tab-link"
                        href={applicationDetailPath(
                          application.id,
                          returnPath,
                        )}
                        aria-current={active ? "page" : undefined}
                        title={`${application.company} ${application.position}`}
                      >
                        <FileText className="nav-icon" aria-hidden="true" />
                        <span className="nav-item-label">
                          {application.company}
                        </span>
                      </Link>
                      <button
                        className="open-detail-tab-close"
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

          <Link className="connection-card connection-card-link" href="/settings">
            <div className="connection-heading">
              <span
                className={
                  mailConnection
                    ? "connection-dot"
                    : "connection-dot is-pending"
                }
                aria-hidden="true"
              />
              <strong>
                {mailConnection ? "Gmail 연결됨" : "채용 메일 연결"}
              </strong>
            </div>
            <p>
              {mailConnection
                ? `마지막 동기화 ${lastMailSyncTime}`
                : "자동 정리를 시작해보세요"}
            </p>
          </Link>

          <div className="profile-card profile-card-static">
            <span className="avatar" aria-hidden="true">
              J
            </span>
            <span>
              <strong>데모 사용자</strong>
              <small>개인 계정</small>
            </span>
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <form className="global-search" onSubmit={submitSearch}>
              <span aria-hidden="true">⌕</span>
              <label className="visually-hidden" htmlFor="global-search-input">
                회사 또는 포지션 검색
              </label>
              <input
                id="global-search-input"
                name="q"
                type="search"
                placeholder="회사 또는 포지션 검색"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit">검색</button>
            </form>
            <div className="topbar-actions">
              <span className="sync-copy">
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
