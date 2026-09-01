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
let reviewRevision = 0;

function isApplication(value: object): value is Application {
  return (
    "id" in value &&
    "company" in value &&
    "nextActionAt" in value &&
    "nextActionCompleted" in value
  );
}

function sourceType(source: string) {
  const normalized = source.toLowerCase();
  if (normalized.includes("gmail")) return "gmail";
  if (normalized.includes("naver")) return "naver";
  if (normalized.includes("outlook")) return "outlook";
  return normalized.includes("직접") || normalized.includes("manual")
    ? "manual"
    : "other";
}

function toContractBody(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(toContractBody);
  if (!body || typeof body !== "object") return body;
  if (isApplication(body)) {
    return {
      id: body.id,
      version: body.version,
      company: body.company,
      position: body.position,
      location: body.location,
      employmentType: body.employmentType,
      appliedAt: body.appliedAt,
      status: statusValue(body),
      needsReview: body.needsReview,
      source: body.source,
      sourceType: sourceType(body.source),
      schedule: body.nextActionAt && !body.nextActionCompleted
        ? {
            nextActionTitle: body.nextActionTitle ?? "지원 일정",
            nextActionAt: body.nextActionAt,
          }
        : null,
      memo: body.memo,
    };
  }
  if ("items" in body && Array.isArray(body.items)) {
    return { ...body, items: body.items.map(toContractBody) };
  }
  return body;
}

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set("x-jobvis-api-mode", "mock");
  return Response.json(toContractBody(body), { ...init, headers });
}

function notFound(detail = "Application not found") {
  return json(
    { title: "Not Found", status: 404, detail },
    { status: 404, headers: { "content-type": "application/problem+json" } },
  );
}

function badRequest(message: string) {
  return json(
    { title: "Bad Request", status: 400, detail: message },
    { status: 400, headers: { "content-type": "application/problem+json" } },
  );
}

function methodNotAllowed(detail = "Method not allowed") {
  return json(
    { title: "Method Not Allowed", status: 405, detail },
    { status: 405, headers: { "content-type": "application/problem+json" } },
  );
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

function dateLabel(dateKey: string | null) {
  return dateKey ?? "일정 없음";
}

async function readBody(request: NextRequest) {
  if (!["DELETE", "POST", "PATCH", "PUT"].includes(request.method)) return {};
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
  if (request.nextUrl.searchParams.get("status") === "schedulable") {
    return filterApplications(
      mockApplications.filter((application) => application.result !== "rejected"),
      query,
      "all",
    );
  }
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
  const filtered = list(request);
  return {
    items,
    page,
    limit,
    hasNext: offset + limit < filtered.length,
    filteredCount: filtered.length,
    totalCount: mockApplications.length,
    needsReviewCount: mockApplications.filter((item) => item.needsReview).length,
    reviewRevision,
  };
}

async function createApplication(request: NextRequest) {
  const body = await readBody(request);
  const company = String(body.company ?? "").trim();
  const position = String(body.position ?? "").trim();
  const stage = String(body.status ?? "applied") as Application["stage"];

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
    scheduleType: "other",
    nextActionAt: null,
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
      appliedAt: String(body.appliedAt ?? application.appliedAt).slice(0, 10),
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
      details.appliedAt !== application.appliedAt
        ? change("지원일", application.appliedAt, details.appliedAt)
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

async function updateSchedule(request: NextRequest, id: string) {
  const body = await readBody(request);
  const nextActionAtPresent = Object.hasOwn(body, "nextActionAt");
  const nextActionTitlePresent = Object.hasOwn(body, "nextActionTitle");
  const nextActionAt = String(body.nextActionAt ?? "").slice(0, 10);
  const nextActionTitle = String(body.nextActionTitle ?? "").trim();

  if (!nextActionAtPresent && !nextActionTitlePresent) {
    return badRequest("nextActionAt or nextActionTitle is required");
  }
  if (
    (nextActionAtPresent && (!nextActionAt || body.nextActionAt === null)) ||
    (nextActionTitlePresent && body.nextActionTitle === null)
  ) {
    return badRequest("schedule fields cannot be null or blank");
  }

  const updated = replaceApplication(id, (application) => {
    const resolvedDate = nextActionAtPresent
      ? nextActionAt
      : application.nextActionAt;
    const resolvedTitle = nextActionTitlePresent
      ? nextActionTitle || application.nextActionTitle
      : application.nextActionTitle;
    const changes = [
      (application.nextActionTitle ?? null) !== (resolvedTitle ?? null)
        ? change(
            "일정명",
            application.nextActionTitle ?? "내용 없음",
            resolvedTitle ?? "내용 없음",
          )
        : null,
      application.nextActionAt !== resolvedDate
        ? change(
            "일정일",
            dateLabel(application.nextActionAt),
            dateLabel(resolvedDate),
          )
        : null,
      application.nextActionCompleted
        ? change("일정 상태", "완료", "미완료")
        : null,
    ].filter((item): item is ApplicationChange => Boolean(item));

    return {
      ...application,
      nextActionAt: resolvedDate,
      nextActionTitle: resolvedTitle,
      nextActionCompleted: false,
      activities: [
        activity(
          "task",
          application.nextActionAt ? "일정을 수정했습니다" : "일정을 등록했습니다",
          `${resolvedTitle ?? application.nextActionTitle ?? "일정"} · ${resolvedDate}`,
        ),
        ...application.activities,
      ],
      changes: [...changes, ...application.changes],
    };
  });
  return updated ? json(updated) : notFound();
}

async function updateStatus(request: NextRequest, id: string) {
  const body = await readBody(request);
  const status = String(body.status ?? "") as ApplicationStatus;
  const updated = replaceApplication(id, (application) => {
    const previousLabel = stageLabel(application);
    const transitioned = transitionStatus(application, status);
    const nextLabel = stageLabel(transitioned);
    const statusChanged = statusValue(application) !== status;
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
        !statusChanged
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
  if (updated) reviewRevision += 1;
  return updated ? json(updated) : notFound();
}

function completeBulkReview() {
  let completedCount = 0;
  mockApplications = mockApplications.map((application) => {
    if (!application.needsReview) return application;
    completedCount += 1;
    return {
      ...application,
      version: application.version + 1,
      needsReview: false,
      changes: [
        change("검토 상태", "확인 필요", "확인 완료"),
        ...application.changes,
      ],
    };
  });
  if (completedCount) reviewRevision += 1;
  return json({
    completedCount,
    needsReviewCount: 0,
    reviewRevision,
  });
}

function homeSummary() {
  const today = seoulDateKey();
  const weekEnd = seoulDateKey(
    new Date(new Date(`${today}T00:00:00+09:00`).getTime() + 6 * 86400000),
  );
  const review = mockApplications.filter((item) => item.needsReview);
  const scheduled = mockApplications.filter((item) => item.result !== "rejected");
  const open = scheduled.filter(
    (item) => !item.needsReview && !item.nextActionCompleted && item.nextActionAt && item.nextActionAt <= today,
  );
  const upcoming = scheduled
    .filter((item) => !item.nextActionCompleted && item.nextActionAt && item.nextActionAt >= today)
    .sort((a, b) => (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? ""));
  const priority = [...review, ...open].sort((a, b) => {
    const aDate = a.nextActionAt ?? "9999-12-31";
    const bDate = b.nextActionAt ?? "9999-12-31";
    const urgency = Number(aDate > today) - Number(bDate > today);
    return urgency || aDate.localeCompare(bDate) || a.company.localeCompare(b.company, "ko-KR");
  });
  const weeklyUpcoming = upcoming.filter((item) => item.nextActionAt! <= weekEnd);
  const briefing = review.length
    ? { reason: "needsReview", count: review.length }
    : open.length
      ? { reason: "openTask", count: open.length }
      : weeklyUpcoming.length
        ? { reason: "upcomingSchedule", count: weeklyUpcoming.length }
        : { reason: "idle", count: 0 };
  return {
    date: today,
    briefing,
    priorityItems: priority.slice(0, 5).map((item) => ({
      applicationId: item.id,
      applicationVersion: item.version,
      company: item.company,
      position: item.position,
      reason: item.needsReview ? "needsReview" : item.nextActionAt! < today ? "overdue" : "today",
      scheduleType: item.needsReview ? null : item.scheduleType,
      nextActionAt: item.nextActionAt,
      canComplete:
        !item.needsReview &&
        item.result === "active" &&
        (item.stage === "test" || item.stage === "interview"),
    })),
    upcomingSchedules: weeklyUpcoming.slice(0, 5).map((item) => ({
      applicationId: item.id,
      company: item.company,
      position: item.position,
      scheduleType: item.scheduleType,
      date: item.nextActionAt,
    })),
    activeApplications: mockApplications
      .filter((item) => item.result === "active")
      .sort((a, b) => {
        const aDate = a.nextActionCompleted ? "9999-12-31" : (a.nextActionAt ?? "9999-12-31");
        const bDate = b.nextActionCompleted ? "9999-12-31" : (b.nextActionAt ?? "9999-12-31");
        const byDate = aDate.localeCompare(bDate);
        return byDate || b.appliedAt.localeCompare(a.appliedAt) || a.id.localeCompare(b.id);
      })
      .slice(0, 5)
      .map((item) => ({
        applicationId: item.id,
        company: item.company,
        position: item.position,
        status: statusValue(item),
        needsReview: item.needsReview,
        nextActionAt: item.nextActionCompleted ? null : item.nextActionAt,
        latestActivityTitle: item.activities[0]?.title ?? item.source,
      })),
  };
}

function calendarSchedules(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? "0000-01-01";
  const to = request.nextUrl.searchParams.get("to") ?? "9999-12-31";
  return {
    items: mockApplications
      .filter(
        (item) =>
          !item.nextActionCompleted &&
          item.result !== "rejected" &&
          item.nextActionAt &&
          item.nextActionAt >= from &&
          item.nextActionAt <= to,
      )
      .map((item) => ({
        applicationId: item.id,
        company: item.company,
        position: item.position,
        status: statusValue(item),
        needsReview: item.needsReview,
        title: item.nextActionTitle ?? "지원 일정",
        date: item.nextActionAt,
      })),
  };
}

function analytics(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to") ?? seoulDateKey();
  const items = mockApplications.filter(
    (item) => (!from || item.appliedAt >= from) && item.appliedAt <= to,
  );
  const months = Array.from({ length: 6 }, (_, index) => {
    const end = new Date(`${to.slice(0, 7)}-01T00:00:00+09:00`);
    end.setMonth(end.getMonth() - (5 - index));
    const month = seoulDateKey(end).slice(0, 7);
    return { month, count: items.filter((item) => item.appliedAt.startsWith(month)).length };
  });
  const sourceCounts = items.reduce<Record<string, number>>((counts, item) => {
    const source = sourceType(item.source);
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});
  return {
    from,
    to,
    total: items.length,
    screeningPassed: items.filter((item) => item.screeningPassed).length,
    reachedInterview: items.filter((item) => ["interview", "offer"].includes(item.highestStageReached)).length,
    offered: items.filter((item) => item.result === "offered").length,
    monthlyFlow: months,
    sourceCounts,
  };
}

function deleteActivity(id: string, activityId: string) {
  const application = mockApplications.find((item) => item.id === id);
  if (!application) return notFound();
  if (!application.activities.some((item) => item.id === activityId)) {
    return notFound("Activity not found");
  }
  const updated = replaceApplication(id, (application) => {
    const targetActivity = application.activities.find((item) => item.id === activityId)!;
    return {
      ...application,
      activities: application.activities.filter((item) => item.id !== activityId),
      changes: [
        change("진행 타임라인", targetActivity.title, "삭제됨"),
        ...application.changes,
      ],
    };
  });
  return updated ? json(updated) : notFound();
}

export async function handleMockJobvisApi(
  request: NextRequest,
  path: string[],
) {
  const [resource, id, subResource, action] = path;
  if (resource === "home" && id === "summary" && request.method === "GET") {
    return json(homeSummary());
  }
  if (resource === "calendar" && id === "schedules" && request.method === "GET") {
    return json(calendarSchedules(request));
  }
  if (resource === "analytics" && id === "summary" && request.method === "GET") {
    return json(analytics(request));
  }
  if (resource === "connections" && id === "capabilities" && request.method === "GET") {
    return json([
      { provider: "gmail", capability: "mail", connectionMode: "oauth2", available: true, supportsHistoricalImport: true, supportsOngoingSync: true, notes: [] },
      { provider: "naver", capability: "mail", connectionMode: "app_password", available: true, supportsHistoricalImport: true, supportsOngoingSync: true, notes: [] },
    ]);
  }
  if (resource === "connections" && !id && request.method === "GET") {
    return json([]);
  }
  if (resource === "import-runs" && !id && request.method === "GET") {
    return json({ items: [], page: 0, size: 50, hasNext: false });
  }
  if (resource !== "applications") {
    return notFound("Mock endpoint not implemented");
  }

  if (!id) {
    if (request.method === "POST") return createApplication(request);
    return methodNotAllowed();
  }

  if (id === "page" && request.method === "GET") {
    return json(listPage(request));
  }

  if (id === "counts" && request.method === "GET") {
    return json({ totalCount: mockApplications.length });
  }

  if (id === "review" && subResource === "complete-bulk" && request.method === "POST") {
    return completeBulkReview();
  }

  const application = mockApplications.find((item) => item.id === id);

  if (!subResource && request.method === "GET") {
    return application ? json(application) : notFound();
  }

  if (subResource === "emails" && request.method === "GET") {
    return application ? json({ items: application.emails, nextCursor: null, totalCount: application.emails.length }) : notFound();
  }

  if (subResource === "activities" && request.method === "GET") {
    return application
      ? json({ items: application.activities, nextCursor: null })
      : notFound();
  }

  if (subResource === "activities" && action && request.method === "DELETE") {
    return deleteActivity(id, action);
  }

  if (subResource === "changes" && request.method === "GET") {
    return application ? json({ items: application.changes, nextCursor: null, totalCount: application.changes.length }) : notFound();
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

  if (subResource === "schedule" && request.method === "PATCH") {
    return updateSchedule(request, id);
  }

  if (subResource === "review" && action === "complete" && request.method === "POST") {
    return completeReview(id);
  }

  return notFound("Mock endpoint not implemented");
}
