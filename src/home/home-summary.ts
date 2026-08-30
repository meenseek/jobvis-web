import {
  type Application,
  filterScheduledApplications,
  getApplicationDisplayStatus,
  scheduleTypeLabel,
  seoulDateKey,
} from "../applications/application-data";

export type HomePriorityItem = {
  application: Application;
  label: "확인 필요" | "기한 경과" | "오늘";
  detail: string;
  canComplete: boolean;
};

export type HomeSummary = {
  briefing: {
    source: "rule";
    message: string;
  };
  priorityItems: HomePriorityItem[];
  upcomingSchedules: Application[];
  activeApplications: Application[];
  weeklySchedules: Application[];
};

function canCompleteScheduleFromHome(application: Application) {
  const displayStatus = getApplicationDisplayStatus(application);
  return displayStatus === "test" || displayStatus === "interview";
}

function openScheduleDate(application: Application) {
  return application.nextActionCompleted ? null : application.nextActionAt;
}

export function buildRuleBasedHomeSummary(
  applications: Application[],
  today: string,
): HomeSummary {
  const weekEnd = seoulDateKey(
    new Date(new Date(`${today}T00:00:00+09:00`).getTime() + 6 * 86400000),
  );
  const scheduledApplications = filterScheduledApplications(
    applications,
    "all",
  );
  const activeApplications = applications.filter(
    (application) => application.result === "active",
  );
  const reviewApplications = applications.filter(
    (application) => application.needsReview,
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
  const upcomingSchedules = scheduledApplications
    .filter(
      (application) =>
        application.nextActionAt && application.nextActionAt >= today,
    )
    .sort((a, b) =>
      (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? ""),
    );
  const weeklySchedules = upcomingSchedules.filter(
    (application) =>
      application.nextActionAt && application.nextActionAt <= weekEnd,
  );
  const reviewIds = new Set(
    reviewApplications.map((application) => application.id),
  );
  const priorityItems = [
    ...reviewApplications.map((application) => ({
      application,
      label: "확인 필요" as const,
      detail: "자동 분류와 상태를 확인해 주세요.",
      canComplete: false,
    })),
    ...openTasks
      .filter((application) => !reviewIds.has(application.id))
      .map((application) => ({
        application,
        label:
          application.nextActionAt && application.nextActionAt < today
            ? ("기한 경과" as const)
            : ("오늘" as const),
        detail: `${scheduleTypeLabel(application.scheduleType)} 일정`,
        canComplete: canCompleteScheduleFromHome(application),
      })),
  ]
    .sort((a, b) => {
      const aDate = a.application.nextActionAt ?? "9999-12-31";
      const bDate = b.application.nextActionAt ?? "9999-12-31";
      const aUrgency = aDate <= today ? 0 : 1;
      const bUrgency = bDate <= today ? 0 : 1;
      return (
        aUrgency - bUrgency ||
        aDate.localeCompare(bDate) ||
        a.application.company.localeCompare(b.application.company, "ko-KR")
      );
    })
    .slice(0, 5);
  const activeSupportItems = [...activeApplications]
    .sort((a, b) => {
      const scheduleComparison = (
        openScheduleDate(a) ?? "9999-12-31"
      ).localeCompare(openScheduleDate(b) ?? "9999-12-31");
      return scheduleComparison || b.appliedAt.localeCompare(a.appliedAt);
    })
    .slice(0, 5);

  let message =
    "지원자님, 오늘은 급한 일정 없이 지원 흐름만 가볍게 보면 돼요.";
  if (reviewApplications.length > 0) {
    message = `지원자님, 확인 필요한 지원 ${reviewApplications.length}개가 있어요. 오늘은 이 항목부터 보면 좋아요.`;
  } else if (openTasks.length > 0) {
    message = `지원자님, 오늘 먼저 처리할 항목 ${openTasks.length}개가 있어요.`;
  } else if (weeklySchedules.length > 0) {
    message =
      "지원자님, 급한 할 일은 없어요. 이번 주 일정만 가볍게 확인해볼까요?";
  }

  return {
    briefing: {
      source: "rule",
      message,
    },
    priorityItems,
    upcomingSchedules,
    activeApplications: activeSupportItems,
    weeklySchedules,
  };
}
