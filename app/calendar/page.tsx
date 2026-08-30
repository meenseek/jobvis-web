"use client";

import {
  Button,
  Dialog,
  DialogActions,
  Select,
  TextField,
} from "@measure-twice/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useApplications } from "@/src/applications/application-provider";
import {
  applicationDisplayStatusLabel,
  applicationStatusBadgeTone,
  filterScheduledApplications,
  fullDate,
  seoulDateKey,
} from "@/src/applications/application-data";
import { cn } from "@/src/ui/class-names";
import styles from "./calendar.module.scss";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const today = seoulDateKey();
const [todayYear, todayMonth] = today.split("-").map(Number);

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { applications, saveSchedule } = useApplications();
  const [visibleMonth, setVisibleMonth] = useState({
    year: todayYear,
    month: todayMonth - 1,
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleApplicationId, setScheduleApplicationId] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState(selectedDate);

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

  const events = filterScheduledApplications(applications, "all");
  const selectedEvents = events.filter(
    (application) => application.nextActionAt === selectedDate,
  );
  const schedulableApplications = applications.filter(
    (application) => application.result !== "rejected",
  );
  const selectedScheduleApplication = schedulableApplications.find(
    (application) => application.id === scheduleApplicationId,
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

  function openScheduleDialog(date = selectedDate) {
    const firstApplication = schedulableApplications[0];
    setScheduleApplicationId(firstApplication?.id ?? "");
    setScheduleTitle("");
    setScheduleDate(date);
    setScheduleDialogOpen(true);
  }

  function closeScheduleDialog() {
    setScheduleDialogOpen(false);
    setScheduleApplicationId("");
    setScheduleTitle("");
    setScheduleDate(selectedDate);
  }

  async function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedScheduleApplication) return;
    await saveSchedule(selectedScheduleApplication.id, {
      nextActionAt: scheduleDate,
      nextActionTitle: scheduleTitle,
      scheduleType: selectedScheduleApplication.scheduleType,
    });
    closeScheduleDialog();
  }

  return (
    <main id="main-content" className="main-content">
      <section
        className={cn(
          "page-heading",
          styles["calendar-heading"],
        )}
      >
        <div>
          <h1>캘린더</h1>
          <p>지원·서류, 테스트, 면접, 회신 일정을 날짜별로 확인하세요.</p>
        </div>
        <Button
          type="button"
          onClick={() => openScheduleDialog(today)}
          disabled={!schedulableApplications.length}
        >
          일정 등록
        </Button>
      </section>

      <div className={styles["calendar-layout"]}>
        <article className={styles["calendar-panel"]}>
          <div className={styles["calendar-toolbar"]}>
            <h2>
              {visibleMonth.year}년 {visibleMonth.month + 1}월
            </h2>
            <div className={styles["calendar-actions"]}>
              <button
                className={styles["calendar-icon-button"]}
                type="button"
                aria-label="이전 달"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <Button
                size="sm"
                tone="neutral"
                variant="ghost"
                onClick={goToday}
              >
                오늘
              </Button>
              <button
                className={styles["calendar-icon-button"]}
                type="button"
                aria-label="다음 달"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={styles["calendar-weekdays"]} aria-hidden="true">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className={styles["calendar-grid"]} aria-label="월간 일정">
            {days.map((day, index) => {
              if (!day) {
                return (
                  <span
                    className={cn(
                      styles["calendar-day"],
                      styles["is-empty"],
                    )}
                    key={index}
                  />
                );
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
                  className={cn(
                    styles["calendar-day"],
                    selectedDate === key && styles["is-selected"],
                    key === today && styles["is-today"],
                  )}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  aria-label={`${fullDate(key)}, 일정 ${dayEvents.length}개`}
                  aria-pressed={selectedDate === key}
                  aria-current={key === today ? "date" : undefined}
                  key={key}
                >
                  <span>{day}</span>
                  <span className={styles["calendar-day-events"]}>
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
          className={cn("panel", styles["selected-date-panel"])}
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
            <div className={styles["selected-date-actions"]}>
              <span className="panel-count">
                {selectedEvents.length}개
              </span>
              <Button
                type="button"
                size="sm"
                tone="neutral"
                variant="ghost"
                onClick={() => openScheduleDialog(selectedDate)}
                disabled={!schedulableApplications.length}
              >
                일정 등록
              </Button>
            </div>
          </div>
          <div className={styles["selected-event-list"]}>
            {selectedEvents.map((application) => (
              <Link
                className={styles["selected-event-card"]}
                href={`/applications/${application.id}`}
                key={application.id}
              >
                <span
                  className="company-monogram"
                  aria-hidden="true"
                >
                  {application.company.slice(0, 1)}
                </span>
                <span>
                  <strong>{application.company}</strong>
                  <small>
                    {application.nextActionTitle
                      ? `${application.nextActionTitle} · ${application.position}`
                      : application.position}
                  </small>
                </span>
                <span
                  className={cn(
                    "status-badge",
                    styles["calendar-status-badge"],
                    `status-badge--${applicationStatusBadgeTone(
                      application,
                    )}`,
                  )}
                >
                  {applicationDisplayStatusLabel(application)}
                </span>
              </Link>
            ))}
            {selectedEvents.length === 0 ? (
              <div
                className={cn(
                  "empty-state",
                  "compact-empty",
                )}
              >
                <strong>등록된 일정이 없습니다.</strong>
                <p>다른 날짜를 선택하거나 새 일정을 등록해 보세요.</p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog
        title="일정 등록"
        description="일정을 연결할 지원건과 날짜를 선택하세요."
        closeLabel="일정 등록 창 닫기"
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeScheduleDialog();
        }}
      >
        <form className="application-form" onSubmit={handleScheduleSubmit}>
          <Select
            label="지원건"
            value={scheduleApplicationId}
            onChange={(event) => setScheduleApplicationId(event.target.value)}
            required
          >
            {schedulableApplications.map((application) => (
              <option value={application.id} key={application.id}>
                {application.company} · {application.position}
              </option>
            ))}
          </Select>
          <TextField
            label="일정 이름"
            placeholder="예: 포트폴리오 점검, 1차 면접, 과제 제출"
            value={scheduleTitle}
            onChange={(event) => setScheduleTitle(event.target.value)}
          />
          <label className={styles["calendar-date-field"]}>
            <span>일정 날짜</span>
            <input
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              required
            />
          </label>
          <DialogActions>
            <Button
              type="button"
              tone="neutral"
              variant="ghost"
              onClick={closeScheduleDialog}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!selectedScheduleApplication || !scheduleDate.trim()}
            >
              일정 저장
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </main>
  );
}
