"use client";

import { createContext, ReactNode, useContext, useReducer } from "react";
import {
  type AddApplicationInput,
  type ApplicationDetailsInput,
  applicationReducer,
  createManualApplication,
} from "./application-state";
import {
  Application,
  ApplicationActivity,
  ApplicationChange,
  ApplicationStatus,
  initialApplications,
  statusValue,
  STATUS_OPTIONS,
} from "./data";

type ApplicationContextValue = {
  applications: Application[];
  addApplication: (input: AddApplicationInput) => string;
  completeNextAction: (id: string) => void;
  markReviewed: (id: string) => void;
  saveMemo: (id: string, memo: string) => void;
  updateApplicationDetails: (
    id: string,
    details: ApplicationDetailsInput,
  ) => void;
  updateStatus: (id: string, status: ApplicationStatus) => void;
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

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applications, dispatch] = useReducer(
    applicationReducer,
    initialApplications,
  );

  function addApplication(input: AddApplicationInput) {
    const createdAt = new Date().toISOString();
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

  function completeNextAction(id: string) {
    const application = applications.find((item) => item.id === id);
    if (!application || application.nextActionCompleted) return;
    dispatch({
      type: "complete-next-action",
      id,
      activity: activity(
        "task",
        `${application.nextAction} 완료`,
        "예정된 일정을 완료했습니다.",
      ),
      changes: changes([
        { title: "일정 상태", before: "미완료", after: "완료" },
      ]),
    });
  }

  function markReviewed(id: string) {
    const application = applications.find((item) => item.id === id);
    if (!application?.needsReview) return;
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

  function saveMemo(id: string, memo: string) {
    const application = applications.find((item) => item.id === id);
    if (!application || application.memo === memo) return;
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

  function updateApplicationDetails(
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
    ];
    const changedFields = editableFields.filter(
      ({ key }) => application[key] !== normalizedDetails[key],
    );
    if (!changedFields.length) return;

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

  function updateStatus(id: string, status: ApplicationStatus) {
    const application = applications.find((item) => item.id === id);
    if (!application || statusValue(application) === status) return;
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

  return (
    <ApplicationContext.Provider
      value={{
        applications,
        addApplication,
        completeNextAction,
        markReviewed,
        saveMemo,
        updateApplicationDetails,
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
