"use client";

import { Button, StatusIndicator } from "@measure-twice/react";
import Link from "next/link";
import { useAccountSettings } from "../settings/account-settings-provider";
import { useApplications } from "../applications/application-provider";
import {
  type Application,
  applicationDisplayStatusLabel,
  applicationStatusBadgeTone,
  compareOccurredAtDesc,
  fullDate,
  scheduleTypeLabel,
} from "../applications/application-data";
import { cn } from "../ui/class-names";
import styles from "./home.module.scss";
import { buildRuleBasedHomeSummary } from "./home-summary";

type HomeClientPageProps = {
  today: string;
  todayLabel: string;
};

function latestActivityTitle(application: Application) {
  return [...application.activities].sort(compareOccurredAtDesc)[0]?.title ??
    application.source;
}

export default function HomeClientPage({
  today,
  todayLabel,
}: HomeClientPageProps) {
  const { applications, completeNextAction } = useApplications();
  const { mailConnection } = useAccountSettings();
  const summary = buildRuleBasedHomeSummary(applications, today);
  const showMailConnectionBanner = !mailConnection;

  return (
    <main
      id="main-content"
      className={cn("main-content", styles["home-page"])}
    >
      <section
        className={cn(
          "page-heading",
          styles["home-page-heading"],
        )}
      >
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1 className="visually-hidden">홈</h1>
          <p className={styles["home-assistant-note"]}>
            <span>{summary.briefing.message}</span>
          </p>
        </div>
      </section>

      {showMailConnectionBanner ? (
        <section
          className={styles["home-mail-setup-banner"]}
          aria-labelledby="home-mail-setup-title"
        >
          <div className={styles["home-mail-setup-copy"]}>
            <h2 id="home-mail-setup-title">
              채용 메일을 연결하면 지원 내역을 자동으로 정리할 수 있어요
            </h2>
            <p>
              Gmail 또는 Naver에서 지원 관련 메일만 찾아 회사, 포지션, 상태와
              일정을 정리합니다. 연결은 언제든 해제할 수 있어요.
            </p>
          </div>
          <div className={styles["home-mail-setup-actions"]}>
            <Link
              className={cn(
                styles["home-mail-setup-link"],
                styles["home-mail-setup-link--primary"],
              )}
              href="/settings?connect=mail"
            >
              채용 메일 연결하기
            </Link>
          </div>
        </section>
      ) : null}

      <section
        className={cn(styles["home-section"], styles["home-priority-section"])}
      >
        <div className={styles["home-section-heading"]}>
          <h2>오늘의 우선순위</h2>
        </div>
        <div className={styles["priority-list"]}>
          {summary.priorityItems.map(
            ({ application, label, detail, canComplete }) => (
              <div
                className={styles["priority-item"]}
                key={`${label}-${application.id}`}
              >
                <span
                  className="company-monogram"
                  aria-hidden="true"
                >
                  {application.company.slice(0, 1)}
                </span>
                <div>
                  <span
                    className={cn(
                      styles["priority-label"],
                      styles[
                        `priority-label--${
                          label === "확인 필요"
                            ? "review"
                            : label === "기한 경과"
                              ? "overdue"
                              : "today"
                        }`
                      ],
                    )}
                  >
                    {label}
                  </span>
                  <strong>{application.company}</strong>
                  <p>
                    {application.position} · {detail}
                  </p>
                  {application.nextActionAt ? (
                    <small>{fullDate(application.nextActionAt)}</small>
                  ) : null}
                </div>
                {canComplete ? (
                  <Button
                    size="sm"
                    tone="neutral"
                    variant="outline"
                    onClick={() => completeNextAction(application.id)}
                  >
                    완료
                  </Button>
                ) : (
                  <Link
                    className={styles["priority-link"]}
                    href={`/applications/${application.id}`}
                  >
                    확인
                  </Link>
                )}
              </div>
            ),
          )}
          {summary.priorityItems.length === 0 ? (
            <div className={styles["empty-review"]}>
              <StatusIndicator tone="success">
                오늘 먼저 볼 항목은 없어요
              </StatusIndicator>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className={cn(styles["home-section"], styles["home-upcoming-section"])}
      >
        <div className={styles["home-section-heading"]}>
          <h2>다가오는 일정</h2>
          <Link className="text-link" href="/calendar">
            일정 전체 보기
          </Link>
        </div>
        <div className={styles["agenda-list"]}>
          {summary.upcomingSchedules.slice(0, 5).map((application) => (
            <Link
              href={`/applications/${application.id}`}
              className={styles["agenda-row"]}
              key={application.id}
            >
              <span className={styles["date-block"]}>
                <strong>{application.nextActionAt?.slice(8, 10)}</strong>
                <small>
                  {Number(application.nextActionAt?.slice(5, 7))}월
                </small>
              </span>
              <span>
                <strong>{scheduleTypeLabel(application.scheduleType)}</strong>
                <small>
                  {application.company} · {application.position}
                </small>
              </span>
            </Link>
          ))}
          {summary.upcomingSchedules.length === 0 ? (
            <div className={styles["empty-review"]}>
              <StatusIndicator tone="neutral">
                예정된 일정이 없습니다
              </StatusIndicator>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles["home-support-section"]}>
        <div className={styles["home-section-heading"]}>
          <h2>진행 중인 지원</h2>
          <Link className="text-link" href="/applications">
            전체 보기
          </Link>
        </div>
        <div className={styles["home-support-list"]}>
          {summary.activeApplications.map((application) => (
            <Link
              className={styles["support-row"]}
              href={`/applications/${application.id}`}
              key={application.id}
            >
              <span>
                <strong>{application.company}</strong>
                <small>{application.position}</small>
              </span>
              <span
                className={cn(
                  "status-badge",
                  styles["support-status"],
                  `status-badge--${applicationStatusBadgeTone(application)}`,
                )}
              >
                {applicationDisplayStatusLabel(application)}
              </span>
              <span className={styles["support-activity"]}>
                <small>최근 변화</small>
                <strong>{latestActivityTitle(application)}</strong>
              </span>
              <span
                className={cn(
                  styles["support-date"],
                  !application.nextActionAt && styles["is-empty-schedule"],
                )}
              >
                <small>예정</small>
                <strong>
                  {application.nextActionAt
                    ? fullDate(application.nextActionAt)
                    : "예정 없음"}
                </strong>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
