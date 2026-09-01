import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  forbiddenMutationResponse,
  isTrustedMutation,
  jobvisApiUrl,
  problemResponse,
  sessionToken,
  setSessionCookie,
} from "@/src/auth/server-session";
import type { components } from "@/src/contracts/jobvis-api.generated";
import {
  appendTrustedSiteGatewayHeaders,
  TrustedSiteGatewayConfigurationError,
  TrustedSiteIdentityRequiredError,
  usesTrustedSiteGateway,
} from "@/src/auth/trusted-site-gateway";

type RouteContext = {
  params: Promise<{ action: string }>;
};

type AuthSessionResponse = components["schemas"]["AuthSession"];

async function callAuthApi(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  for (const name of ["forwarded", "x-forwarded-for"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  appendTrustedSiteGatewayHeaders(request, headers);

  return fetch(jobvisApiUrl(`/auth/${path}`), {
    ...init,
    cache: "no-store",
    headers,
  });
}

function unavailableResponse() {
  return problemResponse(
    503,
    "Service Unavailable",
    "Jobvis API에 연결할 수 없습니다.",
  );
}

function gatewayErrorResponse(error: unknown) {
  if (error instanceof TrustedSiteIdentityRequiredError) {
    return problemResponse(401, "Unauthorized", "사이트 로그인이 필요합니다.");
  }
  if (error instanceof TrustedSiteGatewayConfigurationError) {
    return problemResponse(
      503,
      "Service Unavailable",
      "Sites 인증 연결이 준비되지 않았습니다.",
    );
  }
  return unavailableResponse();
}

async function passThroughJson(response: Response) {
  const body = await response.text();
  const headers = new Headers();
  if (body) {
    headers.set(
      "content-type",
      response.headers.get("content-type") ?? "application/json",
    );
  }
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);
  return new NextResponse(body || null, {
    status: response.status,
    headers,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { action } = await context.params;

  if (action === "providers") {
    try {
      return passThroughJson(await callAuthApi(request, "providers"));
    } catch (error) {
      return gatewayErrorResponse(error);
    }
  }

  if (action !== "me") {
    return problemResponse(404, "Not Found", "지원하지 않는 인증 요청입니다.");
  }

  const token = sessionToken(request);
  if (!token && !usesTrustedSiteGateway()) {
    return problemResponse(401, "Unauthorized", "로그인이 필요합니다.");
  }

  try {
    const upstream = await callAuthApi(
      request,
      "me",
      token ? { headers: { authorization: `Bearer ${token}` } } : undefined,
    );
    const response = await passThroughJson(upstream);
    if (upstream.status === 401) clearSessionCookie(response);
    return response;
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isTrustedMutation(request)) return forbiddenMutationResponse();

  const { action } = await context.params;

  if (action === "challenges") {
    try {
      return passThroughJson(
        await callAuthApi(request, "challenges", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: await request.text(),
        }),
      );
    } catch (error) {
      return gatewayErrorResponse(error);
    }
  }

  if (action === "exchange") {
    try {
      const upstream = await callAuthApi(request, "exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await request.text(),
      });
      if (!upstream.ok) return passThroughJson(upstream);

      const session = (await upstream.json()) as AuthSessionResponse;
      if (!session.accessToken || !session.expiresAt || !session.user?.id) {
        return problemResponse(
          502,
          "Bad Gateway",
          "인증 응답 형식이 올바르지 않습니다.",
        );
      }

      const expiresAt = new Date(session.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
        return problemResponse(
          502,
          "Bad Gateway",
          "인증 세션 만료 시간이 올바르지 않습니다.",
        );
      }

      const response = NextResponse.json({
        expiresAt: session.expiresAt,
        user: session.user,
      });
      setSessionCookie(response, session.accessToken, expiresAt);
      return response;
    } catch (error) {
      return gatewayErrorResponse(error);
    }
  }

  if (action === "logout") {
    const token = sessionToken(request);
    if (token) {
      try {
        await callAuthApi(request, "logout", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
      } catch {
        // The browser session is still removed when the API is unavailable.
      }
    }

    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  }

  return problemResponse(404, "Not Found", "지원하지 않는 인증 요청입니다.");
}
