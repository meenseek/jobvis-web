import {
  seoulDateKey,
  statusValue,
  transitionStatus,
} from "./application-data.ts";
import type {
  Application,
  ApplicationActivity,
  ApplicationChange,
  ApplicationStatus,
} from "./application-data.ts";

export type AddApplicationInput = Pick<
  Application,
  "company" | "position" | "stage"
>;

export type ApplicationDetailsInput = Pick<
  Application,
  "company" | "position" | "location" | "employmentType"
>;

export type ApplicationAction =
  | { type: "replace-all"; applications: Application[] }
  | { type: "replace-one"; application: Application }
  | { type: "add"; application: Application }
  | {
      type: "complete-next-action";
      id: string;
      activity: ApplicationActivity;
      changes: ApplicationChange[];
    }
  | { type: "mark-reviewed"; id: string; changes: ApplicationChange[] }
  | {
      type: "update-details";
      id: string;
      details: ApplicationDetailsInput;
      changes: ApplicationChange[];
    }
  | {
      type: "save-memo";
      id: string;
      memo: string;
      changes: ApplicationChange[];
    }
  | {
      type: "update-status";
      id: string;
      status: ApplicationStatus;
      activity: ApplicationActivity;
      changes: ApplicationChange[];
    };

export function createManualApplication(
  input: AddApplicationInput,
  id: string,
  createdAt: string,
  createdActivity: ApplicationActivity,
): Application {
  return {
    id,
    version: 0,
    company: input.company.trim(),
    position: input.position.trim(),
    location: "근무지 미입력",
    employmentType: "고용 형태 미입력",
    appliedAt: seoulDateKey(createdAt),
    stage: input.stage,
    highestStageReached: input.stage,
    screeningPassed: input.stage === "interview" || input.stage === "offer",
    result: "active",
    needsReview: false,
    source: "직접 추가",
    scheduleType: "application",
    nextActionAt: seoulDateKey(createdAt),
    nextActionCompleted: false,
    memo: "",
    emails: [],
    activities: [createdActivity],
    changes: [],
  };
}

export function applicationReducer(
  applications: Application[],
  action: ApplicationAction,
): Application[] {
  if (action.type === "replace-all") {
    return action.applications;
  }

  if (action.type === "replace-one") {
    return applications.map((application) =>
      application.id === action.application.id ? action.application : application,
    );
  }

  if (action.type === "add") {
    return [action.application, ...applications];
  }

  return applications.map((application) => {
    if (application.id !== action.id) return application;

    switch (action.type) {
      case "complete-next-action":
        if (application.nextActionCompleted) return application;
        return {
          ...application,
          nextActionCompleted: true,
          activities: [action.activity, ...application.activities],
          changes: [...action.changes, ...(application.changes ?? [])],
        };
      case "mark-reviewed":
        if (!application.needsReview) return application;
        return {
          ...application,
          needsReview: false,
          changes: [...action.changes, ...(application.changes ?? [])],
        };
      case "update-details": {
        const detailsChanged = Object.entries(action.details).some(
          ([key, value]) =>
            application[key as keyof ApplicationDetailsInput] !== value,
        );
        if (!detailsChanged) return application;
        return {
          ...application,
          ...action.details,
          changes: [...action.changes, ...(application.changes ?? [])],
        };
      }
      case "save-memo":
        if (application.memo === action.memo) return application;
        return {
          ...application,
          memo: action.memo,
          changes: [...action.changes, ...(application.changes ?? [])],
        };
      case "update-status":
        if (statusValue(application) === action.status) return application;
        return {
          ...transitionStatus(application, action.status),
          activities: [action.activity, ...application.activities],
          changes: [...action.changes, ...(application.changes ?? [])],
        };
    }
  });
}
