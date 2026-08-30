"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
} from "react";
import {
  type AddApplicationInput,
  type ApplicationDetailsInput,
  type ApplicationScheduleInput,
  applicationReducer,
  createManualApplication,
} from "./application-state";
import {
  Application,
  ApplicationActivity,
  ApplicationChange,
  ApplicationProgressStatus,
  ApplicationStatus,
  applicationProgressStatusLabel,
  fullDate,
  getApplicationProgressStatus,
  initialApplications,
  progressStatusToApplicationStatus,
  scheduleTypeLabel,
  STATUS_OPTIONS,
  statusValue,
  transitionProgressStatus,
} from "./application-data";
import {
  completeApplicationReview,
  completeApplicationSchedule,
  createApplication,
  deleteApplicationActivity,
  fetchApplications,
  JobvisApiUnavailableError,
  updateApplicationDetails as updateApiApplicationDetails,
  updateApplicationMemo,
  updateApplicationSchedule,
  updateApplicationStatus,
} from "./jobvis-api-client";

type ApplicationContextValue = {
  applications: Application[];
  addApplication: (input: AddApplicationInput) => Promise<string>;
  completeNextAction: (id: string) => Promise<void>;
  deleteActivity: (id: string, activityId: string) => Promise<void>;
  markReviewed: (id: string) => Promise<void>;
  saveSchedule: (id: string, schedule: ApplicationScheduleInput) => Promise<void>;
  saveMemo: (id: string, memo: string) => Promise<void>;
  updateApplicationDetails: (
    id: string,
    details: ApplicationDetailsInput,
  ) => Promise<void>;
  updateProgressStatus: (
    id: string,
    progressStatus: ApplicationProgressStatus,
  ) => Promise<void>;
  updateStatus: (id: string, status: ApplicationStatus) => Promise<void>;
};

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

function activity(
  type: ApplicationActivity["type"],
  title: string,
  description: string,
): ApplicationActivity {
  const occurredAt = new Date().toISOString();
  return {
    id: `${occurredAt}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    description,
    occurredAt,
  };
}

function changes(
  entries: Array<{ title: string; before: string; after: string }>,
): ApplicationChange[] {
  const occurredAt = new Date().toISOString();
  return entries.map(({ title, before, after }, index) => ({
    id: `${occurredAt}-${index}-${Math.random().toString(36).slice(2)}`,
    title,
    description: `${before} → ${after}`,
    occurredAt,
  }));
}

function logApiError(error: unknown) {
  if (error instanceof JobvisApiUnavailableError) return;
  console.error(error);
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applications, dispatch] = useReducer(
    applicationReducer,
    initialApplications,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchApplications(controller.signal)
      .then((items) => dispatch({ type: "replace-all", applications: items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        logApiError(error);
      });
    return () => controller.abort();
  }, []);

  async function addApplication(input: AddApplicationInput) {
    const createdAt = new Date().toISOString();
    try {
      const application = await createApplication(input);
      dispatch({ type: "add", application });
      return application.id;
    } catch (error) {
      logApiError(error);
      const id = `application-${Date.now()}`;
      dispatch({
        type: "add",
        application: createManualApplication(
          input,
          id,
          createdAt,
          activity(
            "status",
            "지원 이력을 추가했습니다",
            "메일 원문 없이 직접 추가했습니다.",
          ),
        ),
      });
      return id;
    }
  }

  async function completeNextAction(id: string) {
    const application = applications.find((item) => item.id === id);
    if (!application || application.nextActionCompleted) return;
    try {
      const updated = await completeApplicationSchedule(application);
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }
    dispatch({
      type: "complete-next-action",
      id,
      activity: activity(
        "task",
        "일정을 완료했습니다",
        "예정된 지원 일정을 완료했습니다.",
      ),
      changes: changes([
        { title: "일정 상태", before: "미완료", after: "완료" },
      ]),
    });
  }

  async function deleteActivity(id: string, activityId: string) {
    const application = applications.find((item) => item.id === id);
    if (!application) return;
    const targetActivity = application.activities.find(
      (item) => item.id === activityId,
    );
    if (!targetActivity) return;
    try {
      const updated = await deleteApplicationActivity(application, activityId);
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }
    dispatch({
      type: "delete-activity",
      id,
      activityId,
      changes: changes([
        {
          title: "진행 타임라인",
          before: targetActivity.title,
          after: "삭제됨",
        },
      ]),
    });
  }

  async function markReviewed(id: string) {
    const application = applications.find((item) => item.id === id);
    if (!application?.needsReview) return;
    try {
      const updated = await completeApplicationReview(application);
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }
    dispatch({
      type: "mark-reviewed",
      id,
      changes: changes([
        {
          title: "검토 상태",
          before: "확인 필요",
          after: "확인 완료",
        },
      ]),
    });
  }

  async function saveMemo(id: string, memo: string) {
    const application = applications.find((item) => item.id === id);
    if (!application || application.memo === memo) return;
    try {
      const updated = await updateApplicationMemo(application, memo);
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }
    dispatch({
      type: "save-memo",
      id,
      memo,
      changes: changes([
        {
          title: "메모",
          before: application.memo || "내용 없음",
          after: memo || "내용 없음",
        },
      ]),
    });
  }

  async function saveSchedule(id: string, schedule: ApplicationScheduleInput) {
    const application = applications.find((item) => item.id === id);
    if (!application || !schedule.nextActionAt) return;
    const normalizedSchedule: ApplicationScheduleInput = {
      nextActionAt: schedule.nextActionAt,
      nextActionTitle: schedule.nextActionTitle?.trim() || null,
      scheduleType: schedule.scheduleType,
    };
    if (
      application.nextActionAt === normalizedSchedule.nextActionAt &&
      (application.nextActionTitle ?? null) ===
        normalizedSchedule.nextActionTitle &&
      application.scheduleType === normalizedSchedule.scheduleType &&
      !application.nextActionCompleted
    ) {
      return;
    }

    try {
      const updated = await updateApplicationSchedule(
        application,
        normalizedSchedule,
      );
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }

    const wasScheduled = Boolean(application.nextActionAt);
    const title =
      normalizedSchedule.nextActionTitle ??
      `${scheduleTypeLabel(normalizedSchedule.scheduleType)} 일정`;
    const changedFields = [
      (application.nextActionTitle ?? null) !==
      normalizedSchedule.nextActionTitle
        ? {
            title: "일정명",
            before: application.nextActionTitle ?? "내용 없음",
            after: normalizedSchedule.nextActionTitle ?? "내용 없음",
          }
        : null,
      application.nextActionAt !== normalizedSchedule.nextActionAt
        ? {
            title: "일정일",
            before: application.nextActionAt
              ? fullDate(application.nextActionAt)
              : "일정 없음",
            after: fullDate(normalizedSchedule.nextActionAt),
          }
        : null,
      application.scheduleType !== normalizedSchedule.scheduleType
        ? {
            title: "일정 구분",
            before: scheduleTypeLabel(application.scheduleType),
            after: scheduleTypeLabel(normalizedSchedule.scheduleType),
          }
        : null,
      application.nextActionCompleted
        ? {
            title: "일정 상태",
            before: "완료",
            after: "미완료",
          }
        : null,
    ].filter((entry): entry is { title: string; before: string; after: string } =>
      Boolean(entry),
    );

    dispatch({
      type: "save-schedule",
      id,
      schedule: normalizedSchedule,
      activity: activity(
        "task",
        wasScheduled ? "일정을 수정했습니다" : "일정을 등록했습니다",
        `${title} · ${fullDate(normalizedSchedule.nextActionAt)}`,
      ),
      changes: changes(changedFields),
    });
  }

  async function updateApplicationDetails(
    id: string,
    details: ApplicationDetailsInput,
  ) {
    const application = applications.find((item) => item.id === id);
    if (!application) return;
    const normalizedDetails: ApplicationDetailsInput = {
      company: details.company.trim(),
      position: details.position.trim(),
      location: details.location.trim() || "근무지 미입력",
      employmentType: details.employmentType.trim() || "고용 형태 미입력",
      appliedAt: details.appliedAt.trim() || application.appliedAt,
    };
    if (!normalizedDetails.company || !normalizedDetails.position) return;

    const editableFields: Array<{
      key: keyof ApplicationDetailsInput;
      label: string;
    }> = [
      { key: "company", label: "회사" },
      { key: "position", label: "포지션" },
      { key: "location", label: "근무지" },
      { key: "employmentType", label: "고용 형태" },
      { key: "appliedAt", label: "지원일" },
    ];
    const changedFields = editableFields.filter(
      ({ key }) => application[key] !== normalizedDetails[key],
    );
    if (!changedFields.length) return;

    try {
      const updated = await updateApiApplicationDetails(
        application,
        normalizedDetails,
      );
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }

    dispatch({
      type: "update-details",
      id,
      details: normalizedDetails,
      changes: changes(
        changedFields.map(({ key, label }) => ({
          title: label,
          before: application[key],
          after: normalizedDetails[key],
        })),
      ),
    });
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    const application = applications.find((item) => item.id === id);
    if (!application || statusValue(application) === status) return;
    try {
      const updated = await updateApplicationStatus(application, status);
      dispatch({ type: "replace-one", application: updated });
      return;
    } catch (error) {
      logApiError(error);
    }

    const previousLabel =
      STATUS_OPTIONS.find(
        (option) => option.value === statusValue(application),
      )?.label ?? "지원 완료";
    const label =
      STATUS_OPTIONS.find((option) => option.value === status)?.label ??
      "지원 완료";
    dispatch({
      type: "update-status",
      id,
      status,
      activity: activity(
        "status",
        `${label} 상태가 되었습니다`,
        "현재 지원 진행 상황에 반영했습니다.",
      ),
      changes: changes(
        [
          {
            title: "진행 상태",
            before: previousLabel,
            after: label,
          },
          application.needsReview
            ? {
                title: "검토 상태",
                before: "확인 필요",
                after: "확인 완료",
              }
            : null,
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      ),
    });
  }

  async function updateProgressStatus(
    id: string,
    progressStatus: ApplicationProgressStatus,
  ) {
    const application = applications.find((item) => item.id === id);
    if (!application || getApplicationProgressStatus(application) === progressStatus) {
      return;
    }

    try {
      const updated = await updateApplicationStatus(
        application,
        progressStatusToApplicationStatus(progressStatus),
        progressStatus,
      );
      dispatch({
        type: "replace-one",
        application: transitionProgressStatus(updated, progressStatus),
      });
      return;
    } catch (error) {
      logApiError(error);
    }

    const previousLabel = applicationProgressStatusLabel(application);
    const label = applicationProgressStatusLabel(
      transitionProgressStatus(application, progressStatus),
    );
    dispatch({
      type: "update-progress-status",
      id,
      progressStatus,
      activity: activity(
        "status",
        `${label} 상태가 되었습니다`,
        "현재 지원 진행 상황에 반영했습니다.",
      ),
      changes: changes(
        [
          {
            title: "진행 상태",
            before: previousLabel,
            after: label,
          },
          application.needsReview
            ? {
                title: "검토 상태",
                before: "확인 필요",
                after: "확인 완료",
              }
            : null,
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      ),
    });
  }

  return (
    <ApplicationContext.Provider
      value={{
        applications,
        addApplication,
        completeNextAction,
        deleteActivity,
        markReviewed,
        saveSchedule,
        saveMemo,
        updateApplicationDetails,
        updateProgressStatus,
        updateStatus,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplications() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error("useApplications must be used within ApplicationProvider");
  }
  return context;
}
