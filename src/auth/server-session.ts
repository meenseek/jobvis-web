import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.JOBVIS_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8080";

export const JOBVIS_SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-jobvis-session"
    : "jobvis-session";

export function jobvisApiUrl(path: string) {
  return `${API_BASE_URL}/api/v1${path}`;
}

export function sessionToken(request: NextRequest) {
  return request.cookies.get(JOBVIS_SESSION_COOKIE)?.value ?? null;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set({
    name: JOBVIS_SESSION_COOKIE,
    value: token,
    expires: expiresAt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: JOBVIS_SESSION_COOKIE,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function isTrustedMutation(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestHost = request.headers.get("host");
  if (!requestHost) return false;
  return runCatchingOriginHost(origin) === requestHost;
}

function runCatchingOriginHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export function forbiddenMutationResponse() {
  return problemResponse(
    403,
    "Forbidden",
    "허용되지 않은 요청 출처입니다.",
  );
}

export function problemResponse(
  status: number,
  title: string,
  detail: string,
) {
  return NextResponse.json(
    { title, status, detail },
    {
      status,
      headers: { "content-type": "application/problem+json" },
    },
  );
}
