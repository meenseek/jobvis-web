"use client";

import { Button, Select, StatusIndicator } from "@measure-twice/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApplications } from "../application-provider";
import {
  CalendarFilter,
  filterScheduledApplications,
  fullDate,
  scheduleTypeLabel,
  seoulDateKey,
  SCHEDULE_TYPE_OPTIONS,
  stageTone,
} from "../data";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const today = seoulDateKey();
const [todayYear, todayMonth] = today.split("-").map(Number);

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { applications } = useApplications();
  const [visibleMonth, setVisibleMonth] = useState({
    year: todayYear,
    month: todayMonth - 1,
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState<CalendarFilter>("all");

  const days = useMemo(() => {
    const firstWeekday = new Date(
      visibleMonth.year,
      visibleMonth.month,
      1,
    ).getDay();
    const daysInMonth = new Date(
      visibleMonth.year,
      visibleMonth.month + 1,
      0,
    ).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    });
  }, [visibleMonth]);

  const events = filterScheduledApplications(applications, filter);
  const selectedEvents = events.filter(
    (application) => application.nextActionAt === selectedDate,
  );

  function moveMonth(offset: number) {
    const next = new Date(
      visibleMonth.year,
      visibleMonth.month + offset,
      1,
    );
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth();
    setVisibleMonth({ year: nextYear, month: nextMonth });
    setSelectedDate(dateKey(nextYear, nextMonth, 1));
  }

  function goToday() {
    setVisibleMonth({ year: todayYear, month: todayMonth - 1 });
    setSelectedDate(today);
  }

  return (
    <main id="main-content" className="main-content">
      <section className="page-heading calendar-heading">
        <div>
          <h1>캘린더</h1>
          <p>지원·서류, 테스트, 면접, 회신 일정을 날짜별로 확인하세요.</p>
        </div>
        <Select
          label="일정 종류"
          size="sm"
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as CalendarFilter)
          }
          wrapperClassName="calendar-filter"
        >
          <option value="all">모든 일정</option>
          {SCHEDULE_TYPE_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </section>

      <section className="calendar-layout">
        <article className="panel calendar-panel">
          <div className="calendar-toolbar">
            <h2>
              {visibleMonth.year}년 {visibleMonth.month + 1}월
            </h2>
            <div className="calendar-actions">
              <Button
                size="sm"
                tone="neutral"
                variant="outline"
                onClick={() => moveMonth(-1)}
              >
                이전 달
              </Button>
              <Button
                size="sm"
                tone="neutral"
                variant="ghost"
                onClick={goToday}
              >
                오늘
              </Button>
              <Button
                size="sm"
                tone="neutral"
                variant="outline"
                onClick={() => moveMonth(1)}
              >
                다음 달
              </Button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="calendar-grid" aria-label="월간 일정">
            {days.map((day, index) => {
              if (!day) {
                return <span className="calendar-day is-empty" key={index} />;
              }
              const key = dateKey(
                visibleMonth.year,
                visibleMonth.month,
                day,
              );
              const dayEvents = events.filter(
                (application) => application.nextActionAt === key,
              );
              return (
                <button
                  className={[
                    "calendar-day",
                    selectedDate === key ? "is-selected" : "",
                    key === today ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  aria-label={`${fullDate(key)}, 일정 ${dayEvents.length}개`}
                  aria-pressed={selectedDate === key}
                  aria-current={key === today ? "date" : undefined}
                  key={key}
                >
                  <span>{day}</span>
                  <span className="calendar-day-events">
                    {dayEvents.slice(0, 2).map((application) => (
                      <span key={application.id}>{application.company}</span>
                    ))}
                    {dayEvents.length > 2 ? (
                      <small>+{dayEvents.length - 2}개</small>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <aside
          className="panel selected-date-panel"
          aria-labelledby="selected-date-heading"
        >
          <div className="panel-heading">
            <h2
              id="selected-date-heading"
              aria-live="polite"
              aria-atomic="true"
            >
              {fullDate(selectedDate)}
            </h2>
            <span className="panel-count">{selectedEvents.length}개</span>
          </div>
          <div className="selected-event-list">
            {selectedEvents.map((application) => (
              <Link
                className="selected-event-card"
                href={`/applications/${application.id}`}
                key={application.id}
              >
                <span className="company-monogram" aria-hidden="true">
                  {application.company.slice(0, 1)}
                </span>
                <span>
                  <strong>{application.nextAction}</strong>
                  <small>
                    {application.company} · {application.position}
                  </small>
                </span>
                <StatusIndicator tone={stageTone(application)}>
                  {scheduleTypeLabel(application.scheduleType)}
                </StatusIndicator>
              </Link>
            ))}
            {selectedEvents.length === 0 ? (
              <div className="empty-state compact-empty">
                <strong>등록된 일정이 없습니다.</strong>
                <p>다른 날짜를 선택하거나 일정 필터를 바꿔보세요.</p>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
