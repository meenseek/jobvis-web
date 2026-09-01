"use client";

import { Button, StatusIndicator } from "@measure-twice/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccountSettings } from "../settings/account-settings-provider";
import { CalloutBanner } from "../ui/callout-banner";
import {
  applicationStatusDisplayLabel,
  applicationStatusTone,
  fullDate,
  scheduleTypeLabel,
} from "../applications/application-data";
import {
  completeScheduleByVersion,
  fetchHomeSummary,
  type HomeSummary,
} from "../applications/jobvis-api-client";
import { invalidateJobvisApplications } from "../api/jobvis-data-events";
import { MutationAttemptRegistry } from "../api/mutation-attempts";
import { cn } from "../ui/class-names";
import styles from "./home.module.scss";

type HomeClientPageProps = {
  todayLabel: string;
};

function briefingMessage(summary: HomeSummary) {
  if (summary.briefing.reason === "needsReview") {
    return `지원자님, 확인 필요한 지원 ${summary.briefing.count}개가 있어요. 오늘은 이 항목부터 보면 좋아요.`;
  }
  if (summary.briefing.reason === "openTask") {
    return `지원자님, 오늘 먼저 처리할 항목 ${summary.briefing.count}개가 있어요.`;
  }
  if (summary.briefing.reason === "upcomingSchedule") {
    return "지원자님, 급한 할 일은 없어요. 이번 주 일정만 가볍게 확인해볼까요?";
  }
  return "지원자님, 오늘은 급한 일정 없이 지원 흐름만 가볍게 보면 돼요.";
}

export default function HomeClientPage({
  todayLabel,
}: HomeClientPageProps) {
  const { mailConnection } = useAccountSettings();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mutationAttempts] = useState(() => new MutationAttemptRegistry());
  const showMailConnectionBanner = !mailConnection;

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchHomeSummary(signal);
      setSummary(response);
      setErrorMessage(null);
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      setErrorMessage(
        error instanceof Error ? error.message : "홈 요약을 불러오지 못했습니다.",
      );
      return null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => void loadSummary(controller.signal));
    return () => {
      cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [loadSummary]);

  async function completePriority(applicationId: string, version: number) {
    const key = `${applicationId}:complete-schedule`;
    const mutationId = mutationAttempts.idFor(key, [version]);
    try {
      await completeScheduleByVersion(applicationId, version, mutationId);
      mutationAttempts.clear(key, mutationId);
      invalidateJobvisApplications();
      await loadSummary();
    } catch (error) {
      const recoveredSummary = await loadSummary();
      const recoveredItem = recoveredSummary?.priorityItems.find(
        (item) => item.applicationId === applicationId,
      );
      if (
        recoveredSummary !== null &&
        (!recoveredItem || recoveredItem.applicationVersion !== version)
      ) {
        mutationAttempts.clear(key, mutationId);
      }
      setErrorMessage(
        error instanceof Error ? error.message : "일정을 완료하지 못했습니다.",
      );
    }
  }

  if (!summary) {
    return (
      <main id="main-content" className={cn("main-content", styles["home-page"])}>
        <section className="panel" aria-busy={!errorMessage}>
          <h1>{errorMessage ? "홈 요약을 불러오지 못했습니다." : "홈 요약을 불러오는 중입니다."}</h1>
          {errorMessage ? <p>{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

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
            <span>{briefingMessage(summary)}</span>
          </p>
        </div>
      </section>

      {showMailConnectionBanner ? (
        <CalloutBanner
          className={styles["home-mail-setup-banner"]}
          title="채용 메일을 연결하면 지원 내역을 자동으로 정리할 수 있어요"
          action={
            <Link
              className={cn("primary-action-link")}
              href="/settings?connect=mail"
            >
              채용 메일 연결하기
            </Link>
          }
        >
          Gmail 또는 Naver에서 지원 관련 메일만 찾아 회사, 포지션, 상태와
          일정을 정리합니다. 연결은 언제든 해제할 수 있어요.
        </CalloutBanner>
      ) : null}

      <section
        className={cn(styles["home-section"], styles["home-priority-section"])}
      >
        <div className={styles["home-section-heading"]}>
          <h2>오늘의 우선순위</h2>
        </div>
        <div className={styles["priority-list"]}>
          {summary.priorityItems.map(
            (item) => {
              const label = item.reason === "needsReview" ? "확인 필요" : item.reason === "overdue" ? "기한 경과" : "오늘";
              const detail = item.reason === "needsReview" ? "자동 분류와 상태를 확인해 주세요." : `${item.scheduleType ? scheduleTypeLabel(item.scheduleType) : "지원"} 일정`;
              return (
              <div
                className={styles["priority-item"]}
                key={`${label}-${item.applicationId}`}
              >
                <span
                  className="company-monogram"
                  aria-hidden="true"
                >
                  {item.company.slice(0, 1)}
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
                  <strong>{item.company}</strong>
                  <p>
                    {item.position} · {detail}
                  </p>
                  {item.nextActionAt ? (
                    <small>{fullDate(item.nextActionAt)}</small>
                  ) : null}
                </div>
                {item.canComplete ? (
                  <Button
                    size="sm"
                    tone="neutral"
                    variant="outline"
                    onClick={() => completePriority(item.applicationId, item.applicationVersion)}
                  >
                    일정 완료
                  </Button>
                ) : (
                  <Link
                    className={styles["priority-link"]}
                    href={`/applications/${item.applicationId}`}
                    aria-label={`${item.company} 지원 상세 보기`}
                    title="지원 상세 보기"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Link>
                )}
              </div>
              );
            },
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
          {summary.upcomingSchedules.map((schedule) => (
            <Link
              href={`/applications/${schedule.applicationId}`}
              className={styles["agenda-row"]}
              key={schedule.applicationId}
            >
              <span className={styles["date-block"]}>
                <strong>{schedule.date.slice(8, 10)}</strong>
                <small>
                  {Number(schedule.date.slice(5, 7))}월
                </small>
              </span>
              <span>
                <strong>{scheduleTypeLabel(schedule.scheduleType)}</strong>
                <small>
                  {schedule.company} · {schedule.position}
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
          {summary.activeApplications.map((application) => {
            const hasOpenSchedule = Boolean(application.nextActionAt);
            return (
              <Link
                className={styles["support-row"]}
                href={`/applications/${application.applicationId}`}
                key={application.applicationId}
              >
                <span>
                  <strong>{application.company}</strong>
                  <small>{application.position}</small>
                </span>
                <span
                  className={cn(
                    "status-badge",
                    styles["support-status"],
                    `status-badge--${applicationStatusTone(application.status, application.needsReview)}`,
                  )}
                >
                  {applicationStatusDisplayLabel(application.status, application.needsReview)}
                </span>
                <span className={styles["support-activity"]}>
                  <small>최근 변화</small>
                  <strong>{application.latestActivityTitle}</strong>
                </span>
                <span
                  className={cn(
                    styles["support-date"],
                    !hasOpenSchedule && styles["is-empty-schedule"],
                  )}
                >
                  <small>예정</small>
                  <strong>
                    {hasOpenSchedule
                      ? fullDate(application.nextActionAt)
                      : "예정 없음"}
                  </strong>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
