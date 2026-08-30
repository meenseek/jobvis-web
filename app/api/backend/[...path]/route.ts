import { NextRequest } from "next/server";
import { handleMockJobvisApi } from "@/src/mock-api/applications";

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

function forwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  headers.set("accept", "application/json");
  headers.set("x-jobvis-user-id", LOCAL_USER_ID);
  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

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
    return Response.json(
      { message: "Jobvis API is unavailable" },
      { status: 503 },
    );
  }

  const headers = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
