import type { components } from "../contracts/jobvis-api.generated";
import {
  apiRequest,
  JobvisApiUnavailableError,
  JobvisAuthenticationRequiredError,
  JobvisRateLimitedError,
  JobvisResourceNotFoundError,
} from "../api/jobvis-api-client";
import type {
  Application,
  ApplicationStage,
  ApplicationStatus,
} from "./application-data";
import type { ApplicationScheduleInput } from "./application-state";

export {
  JobvisApiUnavailableError,
  JobvisAuthenticationRequiredError,
  JobvisRateLimitedError,
};

export type ApplicationListItem = components["schemas"]["ApplicationListItem"];
export type ApplicationPage = components["schemas"]["ApplicationPage"];
export type ApplicationCounts = components["schemas"]["ApplicationCounts"];
export type HomeSummary = components["schemas"]["HomeSummary"];
export type CalendarSchedulePage = components["schemas"]["CalendarSchedulePage"];
export type ApplicationAnalytics = components["schemas"]["ApplicationAnalytics"];
export type ApplicationSchedule = components["schemas"]["ApplicationSchedule"];
type ContractApplication = components["schemas"]["Application"];
type EmailHistoryPage = components["schemas"]["EmailHistoryPage"];
type ActivityHistoryPage = components["schemas"]["ActivityHistoryPage"];
type ChangeHistoryPage = components["schemas"]["ChangeHistoryPage"];
type CreateApplicationRequest = components["schemas"]["CreateApplicationRequest"];
type UpdateApplicationDetailsRequest = components["schemas"]["UpdateApplicationDetailsRequest"];
type UpdateMemoRequest = components["schemas"]["UpdateMemoRequest"];
type UpdateStatusRequest = components["schemas"]["UpdateStatusRequest"];
type CompleteBulkReviewResponse = components["schemas"]["CompleteBulkReviewResponse"];

export class JobvisApplicationNotFoundError extends JobvisResourceNotFoundError {
  constructor(message = "지원 이력을 찾을 수 없습니다.") {
    super(message);
    this.name = "JobvisApplicationNotFoundError";
  }
}

function stageFromStatus(status: ApplicationStatus): ApplicationStage {
  if (status === "offered") return "offer";
  if (status === "rejected") return "screening";
  return status;
}

function toApplication(
  application: ContractApplication,
  histories?: {
    emails: EmailHistoryPage;
    activities: ActivityHistoryPage;
    changes: ChangeHistoryPage;
  },
): Application {
  const stage = stageFromStatus(application.status);
  return {
    id: application.id,
    version: application.version,
    company: application.company,
    position: application.position,
    location: application.location,
    employmentType: application.employmentType,
    appliedAt: application.appliedAt,
    stage,
    highestStageReached: stage,
    screeningPassed:
      application.status === "interview" ||
      application.status === "offer" ||
      application.status === "offered",
    result:
      application.status === "offered"
        ? "offered"
        : application.status === "rejected"
          ? "rejected"
          : "active",
    needsReview: application.needsReview,
    source: application.source,
    scheduleType: "other",
    nextActionTitle: application.schedule?.nextActionTitle ?? null,
    nextActionAt: application.schedule?.nextActionAt ?? null,
    nextActionCompleted: false,
    memo: application.memo,
    emails: histories?.emails.items ?? [],
    activities: histories?.activities.items ?? [],
    changes: histories?.changes.items ?? [],
    emailNextCursor: histories?.emails.nextCursor ?? null,
    activityNextCursor: histories?.activities.nextCursor ?? null,
    changeNextCursor: histories?.changes.nextCursor ?? null,
    emailTotalCount: histories?.emails.totalCount ?? 0,
    changeTotalCount: histories?.changes.totalCount ?? 0,
  };
}

export function fetchApplicationEmails(
  id: string,
  before: number,
  signal?: AbortSignal,
) {
  return apiRequest<EmailHistoryPage>(
    `/applications/${id}/emails?before=${before}&limit=50`,
    { signal },
  );
}

export function fetchApplicationActivities(
  id: string,
  before: number,
  signal?: AbortSignal,
) {
  return apiRequest<ActivityHistoryPage>(
    `/applications/${id}/activities?before=${before}&limit=50`,
    { signal },
  );
}

export function fetchApplicationChanges(
  id: string,
  before: number,
  signal?: AbortSignal,
) {
  return apiRequest<ChangeHistoryPage>(
    `/applications/${id}/changes?before=${before}&limit=50`,
    { signal },
  );
}

export async function fetchApplicationCounts(signal?: AbortSignal) {
  return apiRequest<ApplicationCounts>("/applications/counts", { signal });
}

export async function fetchApplicationPage(
  query: string,
  status: string,
  page = 0,
  limit = 50,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });
  if (query.trim()) params.set("q", query.trim());
  return apiRequest<ApplicationPage>(`/applications/page?${params}`, { signal });
}

export async function fetchApplication(id: string, signal?: AbortSignal) {
  try {
    const [application, emails, activities, changes] = await Promise.all([
      apiRequest<ContractApplication>(`/applications/${id}`, { signal }),
      apiRequest<EmailHistoryPage>(`/applications/${id}/emails?limit=50`, {
        signal,
      }),
      apiRequest<ActivityHistoryPage>(
        `/applications/${id}/activities?limit=50`,
        { signal },
      ),
      apiRequest<ChangeHistoryPage>(`/applications/${id}/changes?limit=50`, {
        signal,
      }),
    ]);
    return toApplication(application, { emails, activities, changes });
  } catch (error) {
    if (error instanceof JobvisResourceNotFoundError) {
      throw new JobvisApplicationNotFoundError(error.message);
    }
    throw error;
  }
}

export async function fetchHomeSummary(signal?: AbortSignal) {
  return apiRequest<HomeSummary>("/home/summary", { signal });
}

export async function fetchCalendarSchedules(
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ from, to });
  return apiRequest<CalendarSchedulePage>(`/calendar/schedules?${params}`, {
    signal,
  });
}

export async function fetchApplicationAnalytics(
  from: string | null,
  to: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ to });
  if (from) params.set("from", from);
  return apiRequest<ApplicationAnalytics>(`/analytics/summary?${params}`, {
    signal,
  });
}

export async function createApplication(
  input: { company: string; position: string; stage: ApplicationStage },
  mutationId: string,
) {
  const body: CreateApplicationRequest = {
    mutationId,
    company: input.company,
    position: input.position,
    status: input.stage,
  };
  return toApplication(
    await apiRequest<ContractApplication>("/applications", {
      method: "POST",
      body,
    }),
  );
}

function mutationBody(application: Application, mutationId: string) {
  return { mutationId, expectedVersion: application.version };
}

export async function completeApplicationSchedule(
  application: Application,
  mutationId: string,
) {
  return toApplication(
    await apiRequest<ContractApplication>(
      `/applications/${application.id}/schedule/complete`,
      { method: "POST", body: mutationBody(application, mutationId) },
    ),
  );
}

export async function completeScheduleByVersion(
  applicationId: string,
  expectedVersion: number,
  mutationId: string,
) {
  return apiRequest<ContractApplication>(
    `/applications/${applicationId}/schedule/complete`,
    { method: "POST", body: { mutationId, expectedVersion } },
  );
}

export async function completeApplicationReview(
  application: Application,
  mutationId: string,
) {
  return toApplication(
    await apiRequest<ContractApplication>(
      `/applications/${application.id}/review/complete`,
      { method: "POST", body: mutationBody(application, mutationId) },
    ),
  );
}

export async function completeAllApplicationReviews(
  expectedReviewRevision: number,
  mutationId: string,
) {
  return apiRequest<CompleteBulkReviewResponse>(
    "/applications/review/complete-bulk",
    { method: "POST", body: { mutationId, expectedReviewRevision } },
  );
}

export async function deleteApplicationActivity(
  application: Application,
  activityId: string,
  mutationId: string,
) {
  return toApplication(
    await apiRequest<ContractApplication>(
      `/applications/${application.id}/activities/${activityId}`,
      { method: "DELETE", body: mutationBody(application, mutationId) },
    ),
  );
}

export async function updateApplicationMemo(
  application: Application,
  memo: string,
  mutationId: string,
) {
  const body: UpdateMemoRequest = {
    ...mutationBody(application, mutationId),
    memo,
  };
  return toApplication(
    await apiRequest<ContractApplication>(`/applications/${application.id}/memo`, {
      method: "PUT",
      body,
    }),
  );
}

export async function updateApplicationSchedule(
  application: Application,
  schedule: ApplicationScheduleInput,
  mutationId: string,
) {
  return toApplication(
    await apiRequest<ContractApplication>(
      `/applications/${application.id}/schedule`,
      {
        method: "PATCH",
        body: {
          ...mutationBody(application, mutationId),
          nextActionAt: schedule.nextActionAt,
          nextActionTitle: schedule.nextActionTitle,
        },
      },
    ),
  );
}

export async function patchScheduleByVersion(
  applicationId: string,
  expectedVersion: number,
  schedule: ApplicationScheduleInput,
  mutationId: string,
) {
  return apiRequest<ContractApplication>(
    `/applications/${applicationId}/schedule`,
    {
      method: "PATCH",
      body: { mutationId, expectedVersion, ...schedule },
    },
  );
}

export async function updateApplicationDetails(
  application: Application,
  details: {
    company: string;
    position: string;
    location: string;
    employmentType: string;
    appliedAt: string;
  },
  mutationId: string,
) {
  const body: UpdateApplicationDetailsRequest = {
    ...mutationBody(application, mutationId),
    ...details,
  };
  return toApplication(
    await apiRequest<ContractApplication>(
      `/applications/${application.id}/details`,
      { method: "PATCH", body },
    ),
  );
}

export async function updateApplicationStatus(
  application: Application,
  status: ApplicationStatus,
  mutationId: string,
) {
  const body: UpdateStatusRequest = {
    ...mutationBody(application, mutationId),
    status,
  };
  return toApplication(
    await apiRequest<ContractApplication>(
      `/applications/${application.id}/status`,
      { method: "POST", body },
    ),
  );
}
