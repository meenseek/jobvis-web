import { NextRequest } from "next/server";
import {
  type Application,
  type ApplicationActivity,
  type ApplicationChange,
  type ApplicationStatus,
  filterApplications,
  initialApplications,
  normalizeApplicationFilter,
  seoulDateKey,
  stageLabel,
  statusValue,
  transitionStatus,
} from "../applications/application-data";

type JsonRecord = Record<string, unknown>;

let mockApplications: Application[] = structuredClone(initialApplications);

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  headers.set("x-jobvis-api-mode", "mock");
  return Response.json(body, { ...init, headers });
}

function notFound() {
  return json({ message: "Application not found" }, { status: 404 });
}

function badRequest(message: string) {
  return json({ message }, { status: 400 });
}

function now() {
  return new Date().toISOString();
}

function activity(
  type: ApplicationActivity["type"],
  title: string,
  description: string,
): ApplicationActivity {
  const occurredAt = now();
  return {
    id: `mock-activity-${crypto.randomUUID()}`,
    type,
    title,
    description,
    occurredAt,
  };
}

function change(title: string, before: string, after: string): ApplicationChange {
  return {
    id: `mock-change-${crypto.randomUUID()}`,
    title,
    description: `${before} → ${after}`,
    occurredAt: now(),
  };
}

async function readBody(request: NextRequest) {
  if (!["POST", "PATCH", "PUT"].includes(request.method)) return {};
  return (await request.json().catch(() => ({}))) as JsonRecord;
}

function replaceApplication(
  id: string,
  updater: (application: Application) => Application,
) {
  const current = mockApplications.find((application) => application.id === id);
  if (!current) return null;

  const updated = {
    ...updater(current),
    version: current.version + 1,
  };
  mockApplications = mockApplications.map((application) =>
    application.id === id ? updated : application,
  );
  return updated;
}

function list(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const filter = normalizeApplicationFilter(
    request.nextUrl.searchParams.get("status"),
  );
  return filterApplications(mockApplications, query, filter);
}

function listPage(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "0");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const offset = Math.max(page, 0) * Math.max(limit, 1);
  const items = list(request).slice(offset, offset + limit);
  return {
    items,
    page,
    limit,
    hasNext: offset + limit < list(request).length,
  };
}

async function createApplication(request: NextRequest) {
  const body = await readBody(request);
  const company = String(body.company ?? "").trim();
  const position = String(body.position ?? "").trim();
  const stage = String(body.stage ?? "applied") as Application["stage"];

  if (!company || !position) {
    return badRequest("Company and position are required");
  }

  const createdAt = now();
  const application: Application = {
    id: `mock-${crypto.randomUUID()}`,
    version: 0,
    company,
    position,
    location: "근무지 미입력",
    employmentType: "고용 형태 미입력",
    appliedAt: seoulDateKey(createdAt),
    stage,
    highestStageReached: stage,
    screeningPassed: stage === "interview" || stage === "offer",
    result: "active",
    needsReview: false,
    source: "Mock API · 직접 추가",
    scheduleType: "application",
    nextActionAt: seoulDateKey(createdAt),
    nextActionCompleted: false,
    memo: "",
    emails: [],
    activities: [
      activity(
        "status",
        "지원 이력을 추가했습니다",
        "Mock API에서 직접 추가한 지원 이력입니다.",
      ),
    ],
    changes: [],
  };

  mockApplications = [application, ...mockApplications];
  return json(application, { status: 201 });
}

async function updateDetails(request: NextRequest, id: string) {
  const body = await readBody(request);
  const updated = replaceApplication(id, (application) => {
    const details = {
      company: String(body.company ?? application.company).trim(),
      position: String(body.position ?? application.position).trim(),
      location: String(body.location ?? application.location).trim(),
      employmentType: String(
        body.employmentType ?? application.employmentType,
      ).trim(),
    };
    const changes = [
      details.company !== application.company
        ? change("회사", application.company, details.company)
        : null,
      details.position !== application.position
        ? change("포지션", application.position, details.position)
        : null,
      details.location !== application.location
        ? change("근무지", application.location, details.location)
        : null,
      details.employmentType !== application.employmentType
        ? change("고용 형태", application.employmentType, details.employmentType)
        : null,
    ].filter((item): item is ApplicationChange => Boolean(item));

    return {
      ...application,
      ...details,
      changes: [...changes, ...application.changes],
    };
  });
  return updated ? json(updated) : notFound();
}

async function updateMemo(request: NextRequest, id: string) {
  const body = await readBody(request);
  const memo = String(body.memo ?? "");
  const updated = replaceApplication(id, (application) => ({
    ...application,
    memo,
    changes:
      application.memo === memo
        ? application.changes
        : [
            change(
              "메모",
              application.memo || "내용 없음",
              memo || "내용 없음",
            ),
            ...application.changes,
          ],
  }));
  return updated ? json(updated) : notFound();
}

async function updateStatus(request: NextRequest, id: string) {
  const body = await readBody(request);
  const status = String(body.status ?? "") as ApplicationStatus;
  const updated = replaceApplication(id, (application) => {
    const previousLabel = stageLabel(application);
    const transitioned = transitionStatus(application, status);
    const nextLabel = stageLabel(transitioned);
    return {
      ...transitioned,
      activities: [
        activity(
          "status",
          `${nextLabel} 상태가 되었습니다`,
          "Mock API에서 진행 상태를 갱신했습니다.",
        ),
        ...application.activities,
      ],
      changes:
        statusValue(application) === status
          ? application.changes
          : [change("진행 상태", previousLabel, nextLabel), ...application.changes],
    };
  });
  return updated ? json(updated) : notFound();
}

function completeSchedule(id: string) {
  const updated = replaceApplication(id, (application) => ({
    ...application,
    nextActionCompleted: true,
    activities: application.nextActionCompleted
      ? application.activities
      : [
          activity(
            "task",
            "일정을 완료했습니다",
            "Mock API에서 예정된 지원 일정을 완료했습니다.",
          ),
          ...application.activities,
        ],
    changes: application.nextActionCompleted
      ? application.changes
      : [change("일정 상태", "미완료", "완료"), ...application.changes],
  }));
  return updated ? json(updated) : notFound();
}

function completeReview(id: string) {
  const updated = replaceApplication(id, (application) => ({
    ...application,
    needsReview: false,
    changes: application.needsReview
      ? [change("검토 상태", "확인 필요", "확인 완료"), ...application.changes]
      : application.changes,
  }));
  return updated ? json(updated) : notFound();
}

export async function handleMockJobvisApi(
  request: NextRequest,
  path: string[],
) {
  const [resource, id, subResource, action] = path;
  if (resource !== "applications") {
    return json({ message: "Mock endpoint not implemented" }, { status: 404 });
  }

  if (!id) {
    if (request.method === "GET") return json(list(request));
    if (request.method === "POST") return createApplication(request);
    return badRequest("Unsupported method");
  }

  if (id === "page" && request.method === "GET") {
    return json(listPage(request));
  }

  const application = mockApplications.find((item) => item.id === id);

  if (!subResource && request.method === "GET") {
    return application ? json(application) : notFound();
  }

  if (subResource === "emails" && request.method === "GET") {
    return application ? json({ items: application.emails, nextCursor: null }) : notFound();
  }

  if (subResource === "activities" && request.method === "GET") {
    return application
      ? json({ items: application.activities, nextCursor: null })
      : notFound();
  }

  if (subResource === "changes" && request.method === "GET") {
    return application ? json({ items: application.changes, nextCursor: null }) : notFound();
  }

  if (subResource === "details" && request.method === "PATCH") {
    return updateDetails(request, id);
  }

  if (subResource === "memo" && request.method === "PUT") {
    return updateMemo(request, id);
  }

  if (subResource === "status" && request.method === "POST") {
    return updateStatus(request, id);
  }

  if (subResource === "schedule" && action === "complete" && request.method === "POST") {
    return completeSchedule(id);
  }

  if (subResource === "review" && action === "complete" && request.method === "POST") {
    return completeReview(id);
  }

  return json({ message: "Mock endpoint not implemented" }, { status: 404 });
}
