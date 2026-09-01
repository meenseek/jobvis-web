import { NextRequest, NextResponse } from "next/server";
import { handleMockJobvisApi } from "@/src/mock-api/applications";
import {
  clearSessionCookie,
  forbiddenMutationResponse,
  isTrustedMutation,
  JOBVIS_SESSION_COOKIE,
  problemResponse,
} from "@/src/auth/server-session";

const API_BASE_URL =
  process.env.JOBVIS_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8080";
const API_MODE = process.env.JOBVIS_API_MODE ?? "api";
const LOCAL_USER_ID =
  process.env.JOBVIS_LOCAL_USER_ID ??
  "11111111-1111-4111-8111-111111111111";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const PROXIED_RESOURCE_ROOTS = new Set([
  "analytics",
  "applications",
  "calendar",
  "connections",
  "home",
  "import-runs",
]);
const LOOPBACK_API_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

function isLoopbackApi() {
  try {
    return LOOPBACK_API_HOSTS.has(new URL(API_BASE_URL).hostname);
  } catch {
    return false;
  }
}

function forwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");

  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  if (API_MODE === "local") {
    headers.set("x-jobvis-user-id", LOCAL_USER_ID);
  } else {
    const token = request.cookies.get(JOBVIS_SESSION_COOKIE)?.value;
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

  if (!path[0] || !PROXIED_RESOURCE_ROOTS.has(path[0])) {
    return problemResponse(404, "Not Found", "지원하지 않는 API 요청입니다.");
  }

  if (API_MODE === "local" && !isLoopbackApi()) {
    return problemResponse(
      503,
      "Service Unavailable",
      "local 모드는 loopback API에서만 사용할 수 있습니다.",
    );
  }

  if (API_MODE === "mock") {
    return handleMockJobvisApi(request, path);
  }

  const upstreamUrl = new URL(`${API_BASE_URL}/api/v1/${path.join("/")}`);
  upstreamUrl.search = request.nextUrl.search;

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: forwardHeaders(request),
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return problemResponse(
      503,
      "Service Unavailable",
      "Jobvis API is unavailable",
    );
  }

  const headers = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const retryAfter = upstreamResponse.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);

  const response = new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
  if (upstreamResponse.status === 401) clearSessionCookie(response);
  return response;
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  if (!isTrustedMutation(request)) return forbiddenMutationResponse();
  return proxy(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  if (!isTrustedMutation(request)) return forbiddenMutationResponse();
  return proxy(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  if (!isTrustedMutation(request)) return forbiddenMutationResponse();
  return proxy(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  if (!isTrustedMutation(request)) return forbiddenMutationResponse();
  return proxy(request, context);
}
