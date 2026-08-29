import type {
  Application,
  ApplicationActivity,
  ApplicationChange,
  ApplicationEmail,
  ApplicationStage,
  ApplicationStatus,
  ScheduleType,
} from "./application-data";

type ApiApplication = {
  id: string;
  version: number;
  company: string;
  position: string;
  location: string;
  employmentType: string;
  appliedAt: string;
  stage: ApplicationStage;
  highestStageReached: ApplicationStage;
  screeningPassed: boolean;
  result: "active" | "offered" | "rejected";
  needsReview: boolean;
  source: string;
  scheduleType: ScheduleType;
  nextActionAt: string | null;
  nextActionCompleted: boolean;
  memo?: string;
  emails?: ApplicationEmail[];
  activities?: ApplicationActivity[];
  changes?: ApplicationChange[];
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export class JobvisApiUnavailableError extends Error {
  constructor(message = "Jobvis API is unavailable") {
    super(message);
    this.name = "JobvisApiUnavailableError";
  }
}

function mutationId() {
  return crypto.randomUUID();
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const response = await fetch(`/api/backend${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  }).catch((error: unknown) => {
    throw new JobvisApiUnavailableError(
      error instanceof Error ? error.message : undefined,
    );
  });

  if ([502, 503, 504].includes(response.status)) {
    throw new JobvisApiUnavailableError();
  }

  if (!response.ok) {
    throw new Error(`Jobvis API ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function toDateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function toApplication(application: ApiApplication): Application {
  return {
    ...application,
    appliedAt: toDateKey(application.appliedAt) ?? application.appliedAt,
    nextActionAt: toDateKey(application.nextActionAt),
    memo: application.memo ?? "",
    emails: application.emails ?? [],
    activities: application.activities ?? [],
    changes: application.changes ?? [],
  };
}

export async function fetchApplications(signal?: AbortSignal) {
  const applications = await apiRequest<ApiApplication[]>("/applications", {
    signal,
  });
  return applications.map(toApplication);
}

export async function createApplication(input: {
  company: string;
  position: string;
  stage: ApplicationStage;
}) {
  const application = await apiRequest<ApiApplication>("/applications", {
    method: "POST",
    body: { mutationId: mutationId(), ...input },
  });
  return toApplication(application);
}

export async function completeApplicationSchedule(application: Application) {
  const updated = await apiRequest<ApiApplication>(
    `/applications/${application.id}/schedule/complete`,
    {
      method: "POST",
      body: {
        mutationId: mutationId(),
        expectedVersion: application.version,
      },
    },
  );
  return toApplication(updated);
}

export async function completeApplicationReview(application: Application) {
  const updated = await apiRequest<ApiApplication>(
    `/applications/${application.id}/review/complete`,
    {
      method: "POST",
      body: {
        mutationId: mutationId(),
        expectedVersion: application.version,
      },
    },
  );
  return toApplication(updated);
}

export async function updateApplicationMemo(
  application: Application,
  memo: string,
) {
  const updated = await apiRequest<ApiApplication>(
    `/applications/${application.id}/memo`,
    {
      method: "PUT",
      body: {
        mutationId: mutationId(),
        expectedVersion: application.version,
        memo,
      },
    },
  );
  return toApplication(updated);
}

export async function updateApplicationDetails(
  application: Application,
  details: {
    company: string;
    position: string;
    location: string;
    employmentType: string;
  },
) {
  const updated = await apiRequest<ApiApplication>(
    `/applications/${application.id}/details`,
    {
      method: "PATCH",
      body: {
        mutationId: mutationId(),
        expectedVersion: application.version,
        ...details,
      },
    },
  );
  return toApplication(updated);
}

export async function updateApplicationStatus(
  application: Application,
  status: ApplicationStatus,
) {
  const updated = await apiRequest<ApiApplication>(
    `/applications/${application.id}/status`,
    {
      method: "POST",
      body: {
        mutationId: mutationId(),
        expectedVersion: application.version,
        status,
      },
    },
  );
  return toApplication(updated);
}
