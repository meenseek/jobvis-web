"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { useAuth } from "../auth/auth-provider";
import { invalidateJobvisApplications } from "../api/jobvis-data-events";
import {
  MutationAttemptRegistry,
  type MutationIdentityPart,
} from "../api/mutation-attempts";
import type {
  Application,
  ApplicationProgressStatus,
  ApplicationStatus,
} from "./application-data";
import {
  getApplicationProgressStatus,
  progressStatusToApplicationStatus,
  statusValue,
} from "./application-data";
import type {
  ApplicationDetailsInput,
} from "./application-state";
import {
  completeApplicationReview,
  deleteApplicationActivity,
  fetchApplication,
  fetchApplicationActivities,
  fetchApplicationChanges,
  fetchApplicationEmails,
  JobvisApplicationNotFoundError,
  JobvisApiUnavailableError,
  JobvisAuthenticationRequiredError,
  updateApplicationDetails as updateApiApplicationDetails,
  updateApplicationMemo,
  updateApplicationStatus,
} from "./jobvis-api-client";

type ApplicationDetailLoadResult = "ready" | "not-found" | "error";
type ApplicationContextValue = {
  applications: Application[];
  errorMessage: string | null;
  loadApplication: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<ApplicationDetailLoadResult>;
  loadMoreHistory: (
    id: string,
    kind: "emails" | "activities" | "changes",
  ) => Promise<boolean>;
  deleteActivity: (id: string, activityId: string) => Promise<boolean>;
  dismissError: () => void;
  markReviewed: (id: string) => Promise<boolean>;
  saveMemo: (id: string, memo: string) => Promise<boolean>;
  updateApplicationDetails: (
    id: string,
    details: ApplicationDetailsInput,
  ) => Promise<boolean>;
  updateProgressStatus: (
    id: string,
    progressStatus: ApplicationProgressStatus,
  ) => Promise<boolean>;
};

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof JobvisApiUnavailableError) {
    return "Jobvis API에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { expireSession } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mutationAttempts] = useState(() => new MutationAttemptRegistry());

  const reportApiError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof JobvisAuthenticationRequiredError) {
        expireSession();
        return;
      }
      setErrorMessage(apiErrorMessage(error, fallback));
    },
    [expireSession],
  );

  const storeApplication = useCallback((application: Application) => {
    setApplications((current) => {
      const exists = current.some((item) => item.id === application.id);
      return exists
        ? current.map((item) => (item.id === application.id ? application : item))
        : [application, ...current];
    });
  }, []);

  const loadApplication = useCallback(
    async (id: string, signal?: AbortSignal): Promise<ApplicationDetailLoadResult> => {
      try {
        storeApplication(await fetchApplication(id, signal));
        setErrorMessage(null);
        return "ready";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "error";
        if (error instanceof JobvisApplicationNotFoundError) return "not-found";
        reportApiError(error, "지원 상세 정보를 불러오지 못했습니다.");
        return "error";
      }
    },
    [reportApiError, storeApplication],
  );

  const mutate = useCallback(
    async (
      key: string,
      identity: readonly MutationIdentityPart[],
      application: Application,
      operation: (mutationId: string) => Promise<Application>,
      fallback: string,
    ) => {
      const mutationId = mutationAttempts.idFor(key, identity);
      try {
        const response = await operation(mutationId);
        let refreshed = true;
        try {
          storeApplication(await fetchApplication(application.id));
        } catch {
          refreshed = false;
          storeApplication(response);
        }
        mutationAttempts.clear(key, mutationId);
        invalidateJobvisApplications();
        setErrorMessage(
          refreshed
            ? null
            : "변경은 저장됐지만 최신 이력을 불러오지 못했습니다. 페이지를 새로고침해 주세요.",
        );
        return true;
      } catch (error) {
        try {
          storeApplication(await fetchApplication(application.id));
          mutationAttempts.clear(key, mutationId);
        } catch {
          // Keep the same mutation id for the next retry when recovery cannot confirm state.
        }
        reportApiError(error, fallback);
        return false;
      }
    },
    [mutationAttempts, reportApiError, storeApplication],
  );

  async function loadMoreHistory(
    id: string,
    kind: "emails" | "activities" | "changes",
  ) {
    const application = applications.find((item) => item.id === id);
    if (!application) return false;
    const cursor =
      kind === "emails"
        ? application.emailNextCursor
        : kind === "activities"
          ? application.activityNextCursor
          : application.changeNextCursor;
    if (cursor == null) return false;
    try {
      if (kind === "emails") {
        const page = await fetchApplicationEmails(id, cursor);
        storeApplication({
          ...application,
          emails: [...application.emails, ...page.items],
          emailNextCursor: page.nextCursor,
          emailTotalCount: page.totalCount,
        });
      } else if (kind === "activities") {
        const page = await fetchApplicationActivities(id, cursor);
        storeApplication({
          ...application,
          activities: [...application.activities, ...page.items],
          activityNextCursor: page.nextCursor,
        });
      } else {
        const page = await fetchApplicationChanges(id, cursor);
        storeApplication({
          ...application,
          changes: [...application.changes, ...page.items],
          changeNextCursor: page.nextCursor,
          changeTotalCount: page.totalCount,
        });
      }
      setErrorMessage(null);
      return true;
    } catch (error) {
      reportApiError(error, "이력을 더 불러오지 못했습니다.");
      return false;
    }
  }

  async function deleteActivity(id: string, activityId: string) {
    const application = applications.find((item) => item.id === id);
    if (!application) return false;
    return mutate(
      `${id}:delete-activity:${activityId}`,
      [application.version],
      application,
      (mutationId) => deleteApplicationActivity(application, activityId, mutationId),
      "타임라인 항목을 삭제하지 못했습니다.",
    );
  }

  async function markReviewed(id: string) {
    const application = applications.find((item) => item.id === id);
    if (!application?.needsReview) return false;
    return mutate(
      `${id}:review`,
      [application.version],
      application,
      (mutationId) => completeApplicationReview(application, mutationId),
      "검토 완료 상태를 저장하지 못했습니다.",
    );
  }

  async function saveMemo(id: string, memo: string) {
    const application = applications.find((item) => item.id === id);
    if (!application || application.memo === memo) return false;
    return mutate(
      `${id}:memo`,
      [application.version, memo],
      application,
      (mutationId) => updateApplicationMemo(application, memo, mutationId),
      "메모를 저장하지 못했습니다.",
    );
  }

  async function updateApplicationDetails(id: string, details: ApplicationDetailsInput) {
    const application = applications.find((item) => item.id === id);
    if (!application) return false;
    const normalized = {
      company: details.company.trim(),
      position: details.position.trim(),
      location: details.location.trim() || "근무지 미입력",
      employmentType: details.employmentType.trim() || "고용 형태 미입력",
      appliedAt: details.appliedAt.trim() || application.appliedAt,
    };
    if (!normalized.company || !normalized.position) return false;
    return mutate(
      `${id}:details`,
      [
        application.version,
        normalized.company,
        normalized.position,
        normalized.location,
        normalized.employmentType,
        normalized.appliedAt,
      ],
      application,
      (mutationId) => updateApiApplicationDetails(application, normalized, mutationId),
      "지원 정보를 저장하지 못했습니다.",
    );
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    const application = applications.find((item) => item.id === id);
    if (!application || statusValue(application) === status) return false;
    return mutate(
      `${id}:status`,
      [application.version, status],
      application,
      (mutationId) => updateApplicationStatus(application, status, mutationId),
      "지원 상태를 저장하지 못했습니다.",
    );
  }

  async function updateProgressStatus(id: string, progressStatus: ApplicationProgressStatus) {
    const application = applications.find((item) => item.id === id);
    if (!application || getApplicationProgressStatus(application) === progressStatus) return false;
    return updateStatus(id, progressStatusToApplicationStatus(progressStatus));
  }

  return (
    <ApplicationContext.Provider
      value={{
        applications,
        errorMessage,
        loadApplication,
        loadMoreHistory,
        deleteActivity,
        dismissError: () => setErrorMessage(null),
        markReviewed,
        saveMemo,
        updateApplicationDetails,
        updateProgressStatus,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplications() {
  const context = useContext(ApplicationContext);
  if (!context) throw new Error("useApplications must be used within ApplicationProvider");
  return context;
}
