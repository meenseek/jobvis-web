import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareOccurredAtDesc,
  filterApplications,
  filterScheduledApplications,
  fullDate,
  getApplicationProgressStatus,
  homeGreeting,
  initialApplications,
  normalizeApplicationFilter,
  SCHEDULE_TYPE_OPTIONS,
  seoulDateKey,
  statusValue,
  transitionStatus,
} from "../src/applications/application-data.ts";
import {
  applicationDetailPath,
  applicationListPath,
  safeApplicationListPath,
} from "../src/applications/application-navigation.ts";
import {
  closeOpenApplicationTab,
  upsertOpenApplicationTab,
} from "../src/applications/application-tabs.ts";
import {
  accountSettingsReducer,
  initialAccountSettings,
  mailProviderLabel,
} from "../src/settings/settings-state.ts";
import { MutationAttemptRegistry } from "../src/api/mutation-attempts.ts";

const projectRoot = new URL("../", import.meta.url);
const [currentYear, currentMonth] = seoulDateKey().split("-");
let nextServer;
let nextBaseUrlPromise;
let nextServerOutput = "";
let fakeJobvisApi;
let fakeJobvisApiBaseUrlPromise;
const fakeJobvisApiRequests = [];

test("mutation ids belong to an exact request attempt", () => {
  let sequence = 0;
  const attempts = new MutationAttemptRegistry(() => `mutation-${++sequence}`);

  const first = attempts.idFor("save-memo", [3, "첫 메모"]);
  assert.equal(attempts.idFor("save-memo", [3, "첫 메모"]), first);

  const changed = attempts.idFor("save-memo", [3, "수정한 메모"]);
  assert.notEqual(changed, first);

  attempts.clear("save-memo", first);
  assert.equal(
    attempts.idFor("save-memo", [3, "수정한 메모"]),
    changed,
  );

  attempts.clear("save-memo", changed);
  assert.notEqual(
    attempts.idFor("save-memo", [3, "수정한 메모"]),
    changed,
  );

  const sync = attempts.idFor("sync-mail", ["connection-1"]);
  attempts.clearAll();
  assert.notEqual(attempts.idFor("sync-mail", ["connection-1"]), sync);
});

function jsonResponse(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function startFakeJobvisApi() {
  if (fakeJobvisApiBaseUrlPromise) return fakeJobvisApiBaseUrlPromise;

  fakeJobvisApiBaseUrlPromise = new Promise((resolve, reject) => {
    fakeJobvisApi = createServer(async (request, response) => {
      const body = await requestBody(request);
      fakeJobvisApiRequests.push({
        body,
        headers: request.headers,
        method: request.method,
        url: request.url,
      });

      if (request.method === "GET" && request.url === "/api/v1/auth/providers") {
        jsonResponse(response, 200, [{ provider: "google", configured: true }]);
        return;
      }
      if (request.method === "POST" && request.url === "/api/v1/auth/challenges") {
        jsonResponse(response, 201, {
          challengeToken: "challenge-token",
          nonce: "login-nonce",
          expiresAt: "2099-01-01T00:00:00Z",
        });
        return;
      }
      if (request.method === "POST" && request.url === "/api/v1/auth/exchange") {
        jsonResponse(response, 200, {
          accessToken: "opaque-session-token",
          tokenType: "Bearer",
          expiresAt: "2099-01-01T00:00:00Z",
          user: {
            id: "22222222-2222-4222-8222-222222222222",
            displayName: "인증 사용자",
            primaryEmail: "auth@example.com",
          },
        });
        return;
      }

      const authorization = request.headers.authorization;
      if (authorization !== "Bearer opaque-session-token") {
        jsonResponse(response, 401, { message: "로그인이 필요합니다." });
        return;
      }
      if (request.method === "GET" && request.url === "/api/v1/auth/me") {
        jsonResponse(response, 200, {
          id: "22222222-2222-4222-8222-222222222222",
          displayName: "인증 사용자",
          primaryEmail: "auth@example.com",
        });
        return;
      }
      if (request.method === "POST" && request.url === "/api/v1/auth/logout") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "GET" && request.url === "/api/v1/applications/counts") {
        jsonResponse(response, 200, { totalCount: 0 });
        return;
      }

      jsonResponse(response, 404, { message: "not found" });
    });
    fakeJobvisApi.once("error", reject);
    fakeJobvisApi.listen(0, "127.0.0.1", () => {
      const address = fakeJobvisApi.address();
      assert.equal(typeof address, "object");
      assert.ok(address);
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

  return fakeJobvisApiBaseUrlPromise;
}

async function getAvailablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
}

async function startNextServer() {
  if (nextBaseUrlPromise) return nextBaseUrlPromise;

  nextBaseUrlPromise = (async () => {
    const port = await getAvailablePort();
    const fakeApiBaseUrl = await startFakeJobvisApi();
    nextServer = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
      {
        cwd: fileURLToPath(projectRoot),
        env: {
          ...process.env,
          JOBVIS_API_BASE_URL: fakeApiBaseUrl,
          JOBVIS_API_MODE: "api",
          NEXT_PUBLIC_JOBVIS_API_MODE: "api",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    nextServer.stdout.on("data", (chunk) => {
      nextServerOutput += chunk.toString();
    });
    nextServer.stderr.on("data", (chunk) => {
      nextServerOutput += chunk.toString();
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      if (nextServer.exitCode !== null) {
        throw new Error(`Next server exited early.\n${nextServerOutput}`);
      }

      try {
        const response = await fetch(baseUrl, {
          headers: { accept: "text/html" },
        });
        if (response.ok) return baseUrl;
      } catch {
        // Wait for the production server to finish binding the port.
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`Next server did not start.\n${nextServerOutput}`);
  })();

  return nextBaseUrlPromise;
}

after(() => {
  if (nextServer && nextServer.exitCode === null) {
    nextServer.kill();
  }
  if (fakeJobvisApi?.listening) {
    fakeJobvisApi.close();
  }
});

async function render(pathname = "/") {
  const baseUrl = await startNextServer();
  return fetch(`${baseUrl}${pathname}`, {
    headers: { accept: "text/html" },
  });
}

async function readStyleBundle() {
  const styleFiles = [
    "app/globals.scss",
    "app/tokens.scss",
    "app/base.scss",
    "src/ui/shared.scss",
    "src/ui/callout-banner.module.scss",
    "src/auth/auth.module.scss",
    "src/public/public-page.module.scss",
    "src/shell/shell.module.scss",
    "src/home/home.module.scss",
    "src/applications/applications.module.scss",
    "src/applications/application-detail.module.scss",
    "app/calendar/calendar.module.scss",
    "app/analytics/analytics.module.scss",
    "src/settings/settings.module.scss",
  ];
  const contents = await Promise.all(
    styleFiles.map((file) =>
      readFile(new URL(`../${file}`, import.meta.url), "utf8"),
    ),
  );
  return contents.join("\n");
}

const routes = [
  ["/", /홈 요약을 불러오는 중입니다/],
  ["/about", /구직 활동의 흐름을 한곳에서 정리하세요/],
  ["/privacy", /개인정보처리방침/],
  ["/terms", /서비스 약관/],
  ["/applications", /지원 목록/],
  ["/applications?q=무신사&status=test", /지원 목록/],
  ["/applications/musinsa", /지원 상세 정보를 불러오는 중입니다/],
  ["/applications/missing", /지원 상세 정보를 불러오는 중입니다/],
  ["/calendar", new RegExp(`${currentYear}년 ${Number(currentMonth)}월`)],
  ["/analytics", /면접 전환율/],
  ["/settings", /채용 메일을 연결할까요/],
];

for (const [pathname, expectedContent] of routes) {
  test(`server-renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^text\/html\b/i,
    );
    const html = await response.text();
    assert.match(html, expectedContent);
    assert.match(html, /Jobvis/);
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  });
}

test("BFF keeps the Jobvis session out of browser JavaScript and secures proxy requests", async () => {
  const baseUrl = await startNextServer();
  const challengeResponse = await fetch(`${baseUrl}/api/auth/challenges`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify({ provider: "google" }),
  });
  assert.equal(challengeResponse.status, 201);
  assert.equal((await challengeResponse.json()).nonce, "login-nonce");
  const challengeRequest = fakeJobvisApiRequests.findLast(
    (request) => request.url === "/api/v1/auth/challenges",
  );
  assert.equal(challengeRequest?.headers["x-forwarded-for"], "203.0.113.7");

  const unauthenticatedApplicationsResponse = await fetch(
    `${baseUrl}/api/backend/applications/counts`,
  );
  assert.equal(unauthenticatedApplicationsResponse.status, 401);
  assert.match(
    unauthenticatedApplicationsResponse.headers.get("set-cookie") ?? "",
    /Expires=Thu, 01 Jan 1970/i,
  );

  const exchangeResponse = await fetch(`${baseUrl}/api/auth/exchange`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
    },
    body: JSON.stringify({
      provider: "google",
      idToken: "google-id-token",
      challengeToken: "challenge-token",
      nonce: "login-nonce",
    }),
  });
  assert.equal(exchangeResponse.status, 200);
  const exchangeBody = await exchangeResponse.json();
  assert.equal(exchangeBody.user.primaryEmail, "auth@example.com");
  assert.equal("accessToken" in exchangeBody, false);

  const setCookie = exchangeResponse.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^__Host-jobvis-session=opaque-session-token;/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  const sessionCookie = setCookie.split(";", 1)[0];

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: sessionCookie },
  });
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).displayName, "인증 사용자");

  const applicationsResponse = await fetch(`${baseUrl}/api/backend/applications/counts`, {
    headers: {
      authorization: "Bearer browser-controlled-token",
      cookie: sessionCookie,
    },
  });
  assert.equal(applicationsResponse.status, 200);
  assert.deepEqual(await applicationsResponse.json(), { totalCount: 0 });
  const applicationsRequest = fakeJobvisApiRequests.findLast(
    (request) => request.url === "/api/v1/applications/counts",
  );
  assert.ok(applicationsRequest);
  assert.equal(
    applicationsRequest.headers.authorization,
    "Bearer opaque-session-token",
  );
  assert.equal(applicationsRequest.headers.cookie, undefined);
  assert.equal(applicationsRequest.headers["x-jobvis-user-id"], undefined);

  for (const blockedPath of ["auth/exchange", "%2561uth/exchange"]) {
    const directAuthResponse = await fetch(
      `${baseUrl}/api/backend/${blockedPath}`,
    );
    assert.equal(directAuthResponse.status, 404);
  }
  for (const unusedRoot of ["activities/recent", "calendar-exports/previews"]) {
    const unusedResponse = await fetch(`${baseUrl}/api/backend/${unusedRoot}`);
    assert.equal(unusedResponse.status, 404);
  }

  const crossSiteMutation = await fetch(`${baseUrl}/api/backend/applications`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie,
      origin: "https://attacker.example",
    },
    body: "{}",
  });
  assert.equal(crossSiteMutation.status, 403);

  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: baseUrl },
  });
  assert.equal(logoutResponse.status, 204);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/i);
  const logoutRequest = fakeJobvisApiRequests.findLast(
    (request) => request.url === "/api/v1/auth/logout",
  );
  assert.equal(logoutRequest?.headers.authorization, "Bearer opaque-session-token");
});

test("server render defers URL-filtered rows to route-owned client data", async () => {
  const response = await render(
    "/applications?q=%EB%AC%B4%EC%8B%A0%EC%82%AC&status=test",
  );
  const html = await response.text();
  assert.match(html, /지원 목록/);
  const tableBody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  assert.equal(tableBody, "");
  assert.match(html, /value="무신사"/);
  assert.doesNotMatch(html, /토스페이먼츠/);
  const source = await readFile(
    new URL("../src/applications/applications-client-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /fetchApplicationPage\(/);
  assert.match(source, /router\.replace\(applicationListPath/);
});

test("uses real route navigation and shared application state", async () => {
  const [
    shell,
    provider,
    authGate,
    authProvider,
    authScreen,
    googleButton,
    googleAnalytics,
    appBoundary,
    aboutPage,
    privacyPage,
    termsPage,
    homePage,
    homeClientPage,
    applicationsPage,
    detailPage,
    calendarPage,
    analyticsPage,
    settingsPage,
    layout,
    styles,
    packageJson,
    apiRoute,
    authApiRoute,
    serverSession,
    mockApi,
    apiClient,
    commonApiClient,
  ] = await Promise.all([
    readFile(new URL("../src/shell/app-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/applications/application-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/auth-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/auth-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/google-sign-in-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/analytics/google-analytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/shell/app-boundary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/home/home-client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/applications/applications-client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/applications/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/calendar/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/analytics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readStyleBundle(),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backend/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/[action]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/server-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/mock-api/applications.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/applications/jobvis-api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/api/jobvis-api-client.ts", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /href: "\/applications"/);
  assert.match(shell, /href: "\/calendar"/);
  assert.match(shell, /href: "\/analytics"/);
  assert.match(shell, /href: "\/settings"/);
  assert.match(shell, /from "lucide-react"/);
  assert.match(shell, /<NavIcon className=\{styles\["nav-icon"\]\}/);
  assert.match(shell, /<FileText\s+className=\{styles\["nav-icon"\]\}/);
  assert.match(shell, /open-detail-tab-close/);
  assert.match(shell, /closeOpenApplicationTab/);
  assert.doesNotMatch(shell, /icon: "(?:HM|AP|CA|AN|ST|DT)"/);
  assert.doesNotMatch(shell, /WORKSPACE|SHORTCUT/);
  assert.match(shell, /usePathname\(\)/);
  assert.match(shell, /aria-current/);
  assert.match(shell, /useAuth/);
  assert.match(shell, /profile-logout-button/);
  assert.match(shell, /handleSignOut/);
  assert.match(shell, /로그아웃하지 못했습니다/);
  assert.match(shell, /fetchApplicationCounts/);
  assert.match(shell, /JOBVIS_APPLICATIONS_INVALIDATED/);
  assert.match(shell, /NAVER_LEDGER_MIGRATION_REQUIRED/);
  assert.match(shell, /운영자 확인 필요/);
  assert.match(shell, /재승인 필요/);
  assert.match(shell, /지원 정보 상태를 확인해 주세요/);
  assert.match(authGate, /status === "loading"/);
  assert.match(authGate, /status === "unavailable"/);
  assert.match(authGate, /retrySession/);
  assert.match(authGate, /<AuthScreen \/>/);
  assert.match(authProvider, /NEXT_PUBLIC_JOBVIS_AUTH_BYPASS/);
  assert.match(authProvider, /NEXT_PUBLIC_JOBVIS_API_MODE/);
  assert.match(authProvider, /isDemoMode = isMockMode \|\| isLocalMode/);
  assert.match(authProvider, /fetch\("\/api\/auth\/me"/);
  assert.match(authProvider, /fetch\("\/api\/auth\/exchange"/);
  assert.match(authProvider, /keepalive: true/);
  assert.match(authProvider, /expireSession/);
  assert.match(authProvider, /response\.status === 401/);
  assert.match(authProvider, /setStatus\("unauthenticated"\)/);
  assert.match(authProvider, /setStatus\("unavailable"\)/);
  assert.match(authProvider, /retrySession/);
  assert.match(authProvider, /createDemoUser/);
  assert.match(authProvider, /localStorage/);
  assert.match(authProvider, /jobvis\.mock-auth\.user/);
  assert.match(googleButton, /Google로 시작하기/);
  assert.match(googleButton, /accounts\.google\.com\/gsi\/client/);
  assert.match(googleButton, /NEXT_PUBLIC_JOBVIS_GOOGLE_CLIENT_ID/);
  assert.match(googleButton, /nonce: challenge\.nonce/);
  assert.doesNotMatch(authScreen, /Kakao/);
  assert.match(authScreen, /기존 계정으로 로그인됩니다/);
  assert.match(authScreen, /href="\/privacy"/);
  assert.doesNotMatch(authScreen, /auth-mode-tabs/);
  assert.doesNotMatch(authScreen, /이메일/);
  assert.match(appBoundary, /publicPaths\.has\(pathname\)/);
  assert.match(appBoundary, /"\/about", "\/privacy", "\/terms"/);
  assert.match(appBoundary, /<AuthProvider>/);
  assert.match(appBoundary, /<ApplicationProvider>/);
  assert.match(appBoundary, /<AccountSettingsProvider>/);
  assert.match(aboutPage, /Google 로그인에서는 계정을 식별/);
  assert.match(aboutPage, /href="\/privacy"/);
  assert.match(privacyPage, /Google 로그인/);
  assert.match(privacyPage, /Google Analytics 4/);
  assert.match(privacyPage, /Google 비밀번호/);
  assert.match(privacyPage, /메일 원문과 첨부파일은 저장하지 않습니다/);
  assert.match(privacyPage, /AES-256-GCM/);
  assert.match(termsPage, /채용 결과를 보장하거나/);
  assert.match(googleAnalytics, /NEXT_PUBLIC_JOBVIS_GA_MEASUREMENT_ID/);
  assert.match(googleAnalytics, /trackPageView\(window, measurementId, pathname, window.location.origin\)/);
  assert.doesNotMatch(googleAnalytics, /searchParams/);
  assert.match(packageJson, /JOBVIS_GA_MEASUREMENT_ID is required/);
  assert.match(provider, /updateStatus/);
  assert.match(provider, /JobvisAuthenticationRequiredError/);
  assert.match(provider, /expireSession\(\)/);
  assert.match(provider, /saveMemo/);
  assert.match(provider, /updateApplicationDetails/);
  assert.match(provider, /deleteActivity/);
  assert.match(provider, /loadApplication/);
  assert.match(provider, /loadMoreHistory/);
  assert.match(provider, /mutationAttempts\.idFor\(key, identity\)/);
  assert.match(provider, /변경은 저장됐지만 최신 이력을 불러오지 못했습니다/);
  assert.doesNotMatch(provider, /emails: application\.emails/);
  assert.doesNotMatch(provider, /createManualApplication/);
  assert.doesNotMatch(provider, /type: "save-memo"/);
  assert.match(applicationsPage, /applicationDetailPath/);
  assert.match(applicationsPage, /router\.replace\(applicationListPath/);
  assert.match(applicationsPage, /fetchApplicationPage/);
  assert.match(applicationsPage, /completeAllApplicationReviews/);
  assert.match(applicationsPage, /createApplication/);
  assert.match(applicationsPage, /recoveredPage\.reviewRevision !== expectedReviewRevision/);
  assert.match(applicationsPage, /mutationAttempts\.idFor\(key, \[company, position, stage\]\)/);
  assert.match(applicationsPage, /일괄 확인/);
  assert.match(applicationsPage, /확인 필요 항목을 일괄 확인할까요/);
  assert.match(homeClientPage, /recoveredItem\.applicationVersion !== version/);
  assert.match(mockApi, /upcomingSchedules: weeklyUpcoming\.slice\(0, 5\)/);
  assert.match(detailPage, /safeApplicationListPath/);
  assert.match(detailPage, /loadApplication\(params\.id/);
  assert.match(detailPage, /PROGRESS_STATUS_OPTIONS/);
  assert.match(detailPage, /<Pencil aria-hidden="true"/);
  assert.match(detailPage, /기본 정보 편집/);
  assert.doesNotMatch(detailPage, /다음 일정 이름/);
  assert.match(detailPage, /timeline-delete-button/);
  assert.match(detailPage, /변경 기록/);
  assert.doesNotMatch(detailPage, /변경 항목과 수정 전·후 값/);
  assert.match(detailPage, /sortedChanges/);
  assert.match(calendarPage, /aria-pressed/);
  assert.match(calendarPage, /aria-current/);
  assert.doesNotMatch(calendarPage, /SCHEDULE_TYPE_OPTIONS/);
  assert.doesNotMatch(calendarPage, /일정 유형/);
  assert.match(calendarPage, /fetchCalendarSchedules/);
  assert.match(calendarPage, /"schedulable",\s*0,\s*20/);
  assert.doesNotMatch(calendarPage, /while \(page\.hasNext\)/);
  assert.match(calendarPage, /patchScheduleByVersion/);
  assert.match(calendarPage, /일정 등록/);
  assert.match(calendarPage, /<article className=\{styles\["calendar-panel"\]\}/);
  assert.match(calendarPage, /error instanceof JobvisConflictError/);
  assert.match(calendarPage, /loadSchedulableApplications\(\)/);
  assert.doesNotMatch(
    calendarPage,
    /cn\("panel",\s*styles\["calendar-panel"\]/,
  );
  assert.match(analyticsPage, /analytics-trend-graphic/);
  assert.match(analyticsPage, /conversion-list/);
  assert.match(analyticsPage, /pathLength=\{1\}/);
  assert.match(analyticsPage, /gmail: "Gmail 메일"/);
  assert.match(analyticsPage, /manual: "직접 추가"/);
  assert.match(analyticsPage, /other: "기타"/);
  assert.match(settingsPage, /채용 메일을 연결할까요/);
  assert.match(settingsPage, /URLSearchParams\(window\.location\.search\)/);
  assert.match(settingsPage, /inferMailProvider/);
  assert.match(settingsPage, /채용 메일 주소/);
  assert.match(settingsPage, /현재 Gmail과 Naver 메일만 지원합니다/);
  assert.doesNotMatch(settingsPage, /로그인 계정/);
  assert.doesNotMatch(settingsPage, /loginProviderLabel/);
  assert.match(settingsPage, /채용 메일 연결/);
  assert.match(settingsPage, /메일 동기화/);
  assert.match(settingsPage, /자동 동기화/);
  assert.match(settingsPage, /수동 동기화/);
  assert.doesNotMatch(
    [
      shell,
      homePage,
      homeClientPage,
      applicationsPage,
      detailPage,
      calendarPage,
      analyticsPage,
      settingsPage,
    ].join("\n"),
    /className="eyebrow">[A-Z][^<]*</,
  );
  assert.match(layout, /<AppBoundary>/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(layout, /@measure-twice\/react\/styles\.css/);
  assert.match(layout, /JOBVIS_WEB_ORIGIN/);
  assert.match(layout, /new URL\("\/og\.png", metadataBase\)/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(styles, /--mt-color-bg-surface/);
  assert.match(styles, /@keyframes chart-line-draw/);
  assert.match(styles, /@keyframes conversion-bar-fill-in/);
  assert.match(styles, /@keyframes timeline-radar/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /\.timeline li:not\(:last-child\)::after/);
  assert.match(packageJson, /"@measure-twice\/react": "\^0\.4\.4"/);
  assert.match(packageJson, /"next": "\^16\./);
  assert.match(packageJson, /"sass": "\^1\./);
  assert.match(
    packageJson,
    /"dev:mock": "JOBVIS_API_MODE=mock NEXT_PUBLIC_JOBVIS_API_MODE=mock next dev"/,
  );
  assert.match(
    packageJson,
    /"dev:api": "JOBVIS_API_MODE=api NEXT_PUBLIC_JOBVIS_API_MODE=api next dev"/,
  );
  assert.match(
    packageJson,
    /"dev:local": "JOBVIS_API_MODE=local NEXT_PUBLIC_JOBVIS_API_MODE=local next dev"/,
  );
  assert.match(packageJson, /NEXT_PUBLIC_JOBVIS_AUTH_BYPASS=1 npm run build/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /"build:cloudflare"/);
  assert.match(packageJson, /"deploy:cloudflare"/);
  assert.match(packageJson, /"vinext"/);
  assert.match(packageJson, /"vite"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /drizzle/);
  assert.match(apiRoute, /JOBVIS_API_BASE_URL/);
  assert.match(apiRoute, /JOBVIS_API_MODE/);
  assert.match(apiRoute, /handleMockJobvisApi/);
  assert.match(apiRoute, /x-jobvis-user-id/);
  assert.match(apiRoute, /API_MODE === "local"/);
  assert.match(apiRoute, /LOOPBACK_API_HOSTS/);
  assert.match(apiRoute, /!isLoopbackApi\(\)/);
  assert.match(apiRoute, /PROXIED_RESOURCE_ROOTS/);
  assert.match(apiRoute, /retry-after/);
  assert.match(apiRoute, /JOBVIS_SESSION_COOKIE/);
  assert.doesNotMatch(apiRoute, /request\.headers\.get\("authorization"\)/);
  assert.doesNotMatch(apiRoute, /request\.headers\.get\("cookie"\)/);
  assert.match(authApiRoute, /setSessionCookie/);
  assert.match(authApiRoute, /retry-after/);
  assert.match(authApiRoute, /setSessionCookie\(response, session\.accessToken/);
  assert.doesNotMatch(authApiRoute, /NextResponse\.json\(session\)/);
  assert.match(serverSession, /httpOnly: true/);
  assert.match(serverSession, /sameSite: "lax"/);
  assert.match(serverSession, /__Host-jobvis-session/);
  assert.match(serverSession, /problemResponse/);
  assert.match(mockApi, /x-jobvis-api-mode/);
  assert.match(mockApi, /application\/problem\+json/);
  assert.match(mockApi, /filterApplications/);
  assert.match(mockApi, /item\.result !== "rejected"/);
  assert.match(mockApi, /return methodNotAllowed\(\)/);
  assert.match(mockApi, /nextActionAt: null/);
  assert.match(mockApi, /updateSchedule/);
  assert.match(mockApi, /deleteActivity/);
  assert.match(mockApi, /completeSchedule/);
  assert.match(homePage, /<HomeClientPage todayLabel=\{todayLabel\}/);
  assert.match(homeClientPage, /fetchHomeSummary/);
  assert.match(homeClientPage, /home-mail-setup-banner/);
  assert.match(homeClientPage, /채용 메일 연결하기/);
  assert.match(homeClientPage, /href="\/settings\?connect=mail"/);
  assert.doesNotMatch(homeClientPage, /href="\/settings\?connect=gmail"/);
  assert.doesNotMatch(homeClientPage, /href="\/settings\?connect=naver"/);
  assert.match(apiClient, /JobvisApiUnavailableError/);
  assert.match(apiClient, /JobvisAuthenticationRequiredError/);
  assert.match(apiClient, /updateApplicationSchedule/);
  assert.match(apiClient, /fetchApplication/);
  assert.match(apiClient, /jobvis-api\.generated/);
  assert.match(commonApiClient, /\/api\/backend/);
  assert.match(commonApiClient, /body\?\.detail/);
  assert.match(authProvider, /body\?\.detail/);
  assert.match(apiClient, /deleteApplicationActivity/);
  assert.doesNotMatch(styles, /thead\s*\{\s*display:\s*none/);
  await assert.rejects(access(new URL("../app/application-provider.tsx", projectRoot)));
  await assert.rejects(access(new URL("../app/data.ts", projectRoot)));
  await assert.rejects(access(new URL("../app/app-shell.tsx", projectRoot)));
  await assert.rejects(access(new URL("../app/applications/applications-client-page.tsx", projectRoot)));
  await assert.rejects(access(new URL("../app/chatgpt-auth.ts", projectRoot)));
  await assert.rejects(access(new URL("../db/index.ts", projectRoot)));
});

test("URL filters remain the single source of truth across detail navigation", () => {
  const listPath = applicationListPath(" 무신사 ", "test");
  assert.equal(listPath, "/applications?q=%EB%AC%B4%EC%8B%A0%EC%82%AC&status=test");
  const detailPath = applicationDetailPath("musinsa", listPath);
  assert.equal(
    detailPath,
    "/applications/musinsa?from=%2Fapplications%3Fq%3D%25EB%25AC%25B4%25EC%258B%25A0%25EC%2582%25AC%26status%3Dtest",
  );
  assert.equal(safeApplicationListPath(listPath), listPath);
  assert.equal(safeApplicationListPath("https://example.com"), "/applications");

  const filtered = filterApplications(initialApplications, "무신사", "test");
  assert.deepEqual(filtered.map((application) => application.id), ["musinsa"]);
  assert.equal(normalizeApplicationFilter("garbage"), "all");
});

test("opened application tabs accumulate and choose a neighbor when closed", () => {
  let tabs = upsertOpenApplicationTab([], {
    id: "musinsa",
    returnPath: "/applications?q=무신사",
  });
  tabs = upsertOpenApplicationTab(tabs, {
    id: "daangn",
    returnPath: "/applications",
  });
  assert.deepEqual(tabs.map((tab) => tab.id), ["musinsa", "daangn"]);

  tabs = upsertOpenApplicationTab(tabs, {
    id: "musinsa",
    returnPath: "/applications?status=screening",
  });
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].returnPath, "/applications?status=screening");

  const closedLast = closeOpenApplicationTab(tabs, "daangn");
  assert.equal(closedLast.nextTab?.id, "musinsa");
  const closedOnly = closeOpenApplicationTab(closedLast.tabs, "musinsa");
  assert.equal(closedOnly.nextTab, undefined);
  assert.equal(closedOnly.closedTab?.returnPath, "/applications?status=screening");
});

test("status transitions preserve conversion history and support final outcomes", () => {
  const rejectedAfterInterview = initialApplications.find(
    (application) => application.id === "wanted-lab",
  );
  assert.ok(rejectedAfterInterview);
  const reopened = transitionStatus(rejectedAfterInterview, "applied");
  assert.equal(statusValue(reopened), "applied");
  assert.equal(reopened.highestStageReached, "interview");
  assert.equal(reopened.screeningPassed, true);

  const offered = transitionStatus(reopened, "offered");
  assert.equal(statusValue(offered), "offered");
  assert.equal(offered.highestStageReached, "offer");

  const closed = transitionStatus(offered, "rejected");
  assert.equal(statusValue(closed), "rejected");
  assert.equal(closed.highestStageReached, "offer");
  assert.equal(closed.nextActionCompleted, true);
});

test("schedule type never overrides the persisted application stage", () => {
  const testApplication = initialApplications.find(
    (application) => application.id === "musinsa",
  );
  assert.ok(testApplication);
  assert.equal(getApplicationProgressStatus(testApplication), "test");
  assert.equal(
    getApplicationProgressStatus(transitionStatus(testApplication, "screening")),
    "application",
  );
});

test("schedule taxonomy covers every visible branch and ignores stale status", () => {
  const scheduled = filterScheduledApplications(initialApplications, "all");
  const visibleTypes = new Set(
    scheduled.map((application) => application.scheduleType),
  );
  for (const option of SCHEDULE_TYPE_OPTIONS) {
    assert.equal(visibleTypes.has(option.value), true, option.label);
  }

  const toss = initialApplications.find(
    (application) => application.id === "toss-payments",
  );
  const daangn = initialApplications.find(
    (application) => application.id === "daangn",
  );
  assert.ok(toss);
  assert.ok(daangn);

  const tossMovedToInterview = transitionStatus(toss, "interview");
  assert.equal(tossMovedToInterview.scheduleType, "application");
  assert.equal(
    filterScheduledApplications([tossMovedToInterview], "interview").length,
    0,
  );

  const closedInterview = transitionStatus(daangn, "rejected");
  assert.equal(closedInterview.nextActionCompleted, false);
  assert.equal(
    filterScheduledApplications([closedInterview], "interview").length,
    0,
  );
});

test("Seoul date keys stay correct across the UTC midnight boundary", () => {
  const afterSeoulMidnight = "2026-08-15T15:30:00.000Z";
  assert.equal(seoulDateKey(afterSeoulMidnight), "2026-08-16");
  assert.equal(fullDate(afterSeoulMidnight), "2026년 8월 16일");

  const mixedOffsets = [
    { occurredAt: "2026-08-16T09:00:00+09:00" },
    { occurredAt: "2026-08-16T00:30:00.000Z" },
  ].sort(compareOccurredAtDesc);
  assert.equal(mixedOffsets[0].occurredAt, "2026-08-16T00:30:00.000Z");
});

test("home greeting follows Seoul morning, afternoon, and evening", () => {
  assert.deepEqual(homeGreeting("2026-08-15T20:00:00.000Z"), {
    heading: "좋은 아침이에요",
    description: "오늘의 일정과 지원 흐름을 가볍게 살펴볼까요?",
  });
  assert.deepEqual(homeGreeting("2026-08-16T03:00:00.000Z"), {
    heading: "좋은 오후예요",
    description: "지금까지의 흐름을 살피고 다음 할 일을 차분히 이어가요.",
  });
  assert.deepEqual(homeGreeting("2026-08-16T09:00:00.000Z"), {
    heading: "오늘도 수고했어요",
    description: "남은 일정만 가볍게 확인하고 하루를 마무리해요.",
  });
});

test("mail connection state tracks connect, sync, and disconnect actions", () => {
  assert.equal(mailProviderLabel("naver"), "Naver");
  assert.equal(initialAccountSettings.mailConnection, null);
  assert.equal(initialAccountSettings.autoSyncEnabled, true);

  const connected = accountSettingsReducer(initialAccountSettings, {
    type: "connect-mail",
    provider: "gmail",
    email: "career@jobvis.example",
    occurredAt: "2026-08-16T01:00:00.000Z",
  });
  assert.equal(connected.mailConnection?.provider, "gmail");
  assert.equal(connected.mailConnection?.email, "career@jobvis.example");

  const synced = accountSettingsReducer(connected, {
    type: "sync-mail",
    occurredAt: "2026-08-16T02:00:00.000Z",
  });
  assert.equal(
    synced.mailConnection?.lastSyncedAt,
    "2026-08-16T02:00:00.000Z",
  );

  const manualOnly = accountSettingsReducer(synced, {
    type: "set-auto-sync",
    enabled: false,
  });
  assert.equal(manualOnly.autoSyncEnabled, false);

  const disconnected = accountSettingsReducer(manualOnly, {
    type: "disconnect-mail",
  });
  assert.equal(disconnected.autoSyncEnabled, false);
  assert.equal(disconnected.mailConnection, null);
});
