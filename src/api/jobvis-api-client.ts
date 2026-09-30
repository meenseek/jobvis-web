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

export class JobvisAuthenticationRequiredError extends Error {
  constructor(message = "Jobvis authentication is required") {
    super(message);
    this.name = "JobvisAuthenticationRequiredError";
  }
}

export class JobvisResourceNotFoundError extends Error {
  constructor(message = "요청한 정보를 찾을 수 없습니다.") {
    super(message);
    this.name = "JobvisResourceNotFoundError";
  }
}

export class JobvisConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobvisConflictError";
  }
}

export class JobvisRateLimitedError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = "JobvisRateLimitedError";
  }
}

async function apiErrorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    detail?: string;
  } | null;
  return body?.detail || `Jobvis API 요청에 실패했습니다. (${response.status})`;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
) {
  const response = await fetch(`/api/backend${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new JobvisApiUnavailableError(
      error instanceof Error ? error.message : undefined,
    );
  });

  if ([502, 503, 504].includes(response.status)) {
    throw new JobvisApiUnavailableError(await apiErrorMessage(response));
  }
  if (response.status === 401) {
    throw new JobvisAuthenticationRequiredError();
  }
  if (response.status === 404) {
    throw new JobvisResourceNotFoundError(await apiErrorMessage(response));
  }
  if (response.status === 409) {
    throw new JobvisConflictError(await apiErrorMessage(response));
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new JobvisRateLimitedError(
      await apiErrorMessage(response),
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    );
  }
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json().catch((error: unknown) => {
    // 헤더 수신 이후 본문 스트림의 연결 오류도 일시적 장애로 처리한다.
    if (error instanceof TypeError) {
      throw new JobvisApiUnavailableError(error.message);
    }
    throw error;
  })) as T;
}
