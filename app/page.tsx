"use client";

import { Button, StatusIndicator } from "@measure-twice/react";
import { CalendarDays, ListTodo, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApplications } from "./application-provider";
import {
  compareOccurredAtDesc,
  filterScheduledApplications,
  fullDate,
  homeGreeting,
  scheduleTypeLabel,
  seoulDateKey,
  stageLabel,
  stageTone,
} from "./data";

export default function HomePage() {
  const router = useRouter();
  const { applications, completeNextAction } = useApplications();
  const today = seoulDateKey();
  const greeting = homeGreeting();
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
  }).format(new Date());
  const scheduledApplications = filterScheduledApplications(
    applications,
    "all",
  );
  const openTasks = scheduledApplications
    .filter(
      (application) =>
        application.nextActionAt &&
        application.nextActionAt <= today &&
        !application.nextActionCompleted,
    )
    .sort((a, b) =>
      (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? ""),
    );
  const statusChanges = applications
    .flatMap((application) =>
      application.activities
        .filter((item) => item.type === "status")
        .map((item) => ({ application, item })),
    )
    .filter(({ item }) => seoulDateKey(item.occurredAt) === today)
    .sort((a, b) => compareOccurredAtDesc(a.item, b.item));
  const recentChanges = statusChanges.slice(0, 4);
  const upcomingSchedules = scheduledApplications
    .filter(
      (application) =>
        application.nextActionAt && application.nextActionAt >= today,
    )
    .sort((a, b) =>
      (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? ""),
    );

  return (
    <main id="main-content" className="main-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>{greeting.heading}</h1>
          <p>{greeting.description}</p>
        </div>
        <Button onClick={() => router.push("/applications")}>
          지원 현황 열기
        </Button>
      </section>

      <section className="stat-grid" aria-label="오늘의 구직 활동 요약">
        <article className="stat-card stat-card-review">
          <span className="stat-icon" aria-hidden="true">
            <ListTodo />
          </span>
          <div>
            <p>오늘 해야 할 일</p>
            <strong>{openTasks.length}</strong>
            <small>기한이 오늘까지인 항목</small>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <RefreshCcw />
          </span>
          <div>
            <p>새 상태 변경</p>
            <strong>{statusChanges.length}</strong>
            <small>오늘 기록된 변경</small>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <CalendarDays />
          </span>
          <div>
            <p>다가오는 일정</p>
            <strong>{upcomingSchedules.length}</strong>
            <small>서류·테스트·면접·회신 등</small>
          </div>
        </article>
      </section>

      <section className="home-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>오늘 해야 할 일</h2>
            <Link className="text-link" href="/calendar">
              캘린더 보기
            </Link>
          </div>
          <div className="review-list">
            {openTasks.map((application) => (
              <div className="review-item" key={application.id}>
                <span className="company-monogram" aria-hidden="true">
                  {application.company.slice(0, 1)}
                </span>
                <div>
                  <strong>{application.nextAction}</strong>
                  <p>
                    {application.company} · {application.position}
                  </p>
                  <small>{fullDate(application.nextActionAt)}</small>
                </div>
                <Button
                  size="sm"
                  tone="neutral"
                  variant="outline"
                  onClick={() => completeNextAction(application.id)}
                >
                  완료
                </Button>
              </div>
            ))}
            {openTasks.length === 0 ? (
              <div className="empty-review">
                <StatusIndicator tone="success">
                  오늘 할 일을 모두 마쳤어요
                </StatusIndicator>
              </div>
            ) : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>새 상태 변경</h2>
            <Link className="text-link" href="/applications">
              전체 보기
            </Link>
          </div>
          <div className="activity-list">
            {recentChanges.map(({ application, item }) => (
              <Link
                className="activity-row"
                href={`/applications/${application.id}`}
                key={item.id}
              >
                <span className="activity-dot" aria-hidden="true" />
                <span>
                  <strong>{application.company}</strong>
                  <small>{item.title}</small>
                </span>
                <StatusIndicator tone={stageTone(application)}>
                  {stageLabel(application)}
                </StatusIndicator>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>다가오는 일정</h2>
          <Link className="text-link" href="/calendar">
            일정 전체 보기
          </Link>
        </div>
        <div className="upcoming-list">
          {upcomingSchedules.map((application) => (
            <Link
              href={`/applications/${application.id}`}
              className="upcoming-card"
              key={application.id}
            >
              <span className="date-block">
                <strong>{application.nextActionAt?.slice(8, 10)}</strong>
                <small>
                  {Number(application.nextActionAt?.slice(5, 7))}월
                </small>
              </span>
              <span>
                <strong>{application.nextAction}</strong>
                <small>
                  {scheduleTypeLabel(application.scheduleType)} · {application.company}
                  {" · "}
                  {application.position}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
