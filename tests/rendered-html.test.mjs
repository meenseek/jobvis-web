import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import net from "node:net";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applicationReducer,
  createManualApplication,
} from "../src/applications/application-state.ts";
import {
  compareOccurredAtDesc,
  filterApplications,
  filterScheduledApplications,
  fullDate,
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

const projectRoot = new URL("../", import.meta.url);
const [currentYear, currentMonth] = seoulDateKey().split("-");
let nextServer;
let nextBaseUrlPromise;
let nextServerOutput = "";

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
    nextServer = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
      {
        cwd: fileURLToPath(projectRoot),
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
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
    "src/auth/auth.module.scss",
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
  ["/", /오늘의 우선순위/],
  ["/applications", /지원 목록/],
  ["/applications?q=무신사&status=test", /무신사/],
  ["/applications/musinsa", /온라인 코딩 테스트 안내/],
  ["/applications/missing", /지원 이력을 찾을 수 없습니다/],
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

test("server-rendered URL filters exclude non-matching applications", async () => {
  const response = await render(
    "/applications?q=%EB%AC%B4%EC%8B%A0%EC%82%AC&status=test",
  );
  const html = await response.text();
  const tableBody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  assert.match(tableBody, /무신사/);
  assert.doesNotMatch(tableBody, /토스페이먼츠/);
  assert.match(html, /aria-label="무신사 [^"]* 지원 상세 보기"/);
});

test("uses real route navigation and shared application state", async () => {
  const [
    shell,
    provider,
    authGate,
    authProvider,
    authScreen,
    homePage,
    homeClientPage,
    homeSummary,
    applicationsPage,
    detailPage,
    calendarPage,
    analyticsPage,
    settingsPage,
    layout,
    styles,
    packageJson,
    apiRoute,
    mockApi,
    apiClient,
  ] = await Promise.all([
    readFile(new URL("../src/shell/app-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/applications/application-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/auth-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth/auth-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/home/home-client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/home/home-summary.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/applications/applications-client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/applications/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/calendar/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/analytics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readStyleBundle(),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backend/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/mock-api/applications.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/applications/jobvis-api-client.ts", import.meta.url), "utf8"),
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
  assert.match(authGate, /<AuthScreen \/>/);
  assert.match(authProvider, /NEXT_PUBLIC_JOBVIS_AUTH_BYPASS/);
  assert.match(authProvider, /NEXT_PUBLIC_JOBVIS_API_MODE/);
  assert.match(authProvider, /createDemoUser/);
  assert.match(authProvider, /localStorage/);
  assert.match(authScreen, /Google로 시작하기/);
  assert.match(authScreen, /기존 계정으로 로그인됩니다/);
  assert.doesNotMatch(authScreen, /auth-mode-tabs/);
  assert.doesNotMatch(authScreen, /이메일/);
  assert.match(provider, /updateStatus/);
  assert.match(provider, /completeNextAction/);
  assert.match(provider, /saveMemo/);
  assert.match(provider, /updateApplicationDetails/);
  assert.match(provider, /description: `\$\{before\} → \$\{after\}`/);
  assert.match(provider, /title: "진행 상태"/);
  assert.match(provider, /title: "검토 상태"/);
  assert.match(provider, /title: "일정 상태"/);
  assert.match(provider, /title: "메모"/);
  assert.match(applicationsPage, /applicationDetailPath/);
  assert.match(applicationsPage, /router\.replace\(applicationListPath/);
  assert.match(applicationsPage, /markReviewed/);
  assert.match(applicationsPage, /일괄 확인/);
  assert.match(detailPage, /safeApplicationListPath/);
  assert.match(detailPage, /STATUS_OPTIONS/);
  assert.match(detailPage, /<Pencil aria-hidden="true"/);
  assert.match(detailPage, /지원 정보 편집/);
  assert.match(detailPage, /변경 기록/);
  assert.match(detailPage, /변경 항목과 수정 전·후 값/);
  assert.match(detailPage, /sortedChanges/);
  assert.match(calendarPage, /aria-pressed/);
  assert.match(calendarPage, /aria-current/);
  assert.match(calendarPage, /SCHEDULE_TYPE_OPTIONS/);
  assert.match(calendarPage, /<article className=\{styles\["calendar-panel"\]\}/);
  assert.doesNotMatch(
    calendarPage,
    /cn\("panel",\s*styles\["calendar-panel"\]/,
  );
  assert.match(analyticsPage, /analytics-trend-graphic/);
  assert.match(analyticsPage, /pathLength=\{1\}/);
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
  assert.match(layout, /<ApplicationProvider>/);
  assert.match(layout, /<AccountSettingsProvider>/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(layout, /@measure-twice\/react\/styles\.css/);
  assert.match(styles, /--mt-color-bg-surface/);
  assert.match(styles, /@keyframes chart-line-draw/);
  assert.match(styles, /@keyframes timeline-radar/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /\.timeline li:not\(:last-child\)::after/);
  assert.match(packageJson, /"@measure-twice\/react": "\^0\.4\.0"/);
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
  assert.match(packageJson, /NEXT_PUBLIC_JOBVIS_AUTH_BYPASS=1 npm run build/);
  assert.doesNotMatch(packageJson, /"vinext"/);
  assert.doesNotMatch(packageJson, /"vite"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /drizzle/);
  assert.match(apiRoute, /JOBVIS_API_BASE_URL/);
  assert.match(apiRoute, /JOBVIS_API_MODE/);
  assert.match(apiRoute, /handleMockJobvisApi/);
  assert.match(apiRoute, /x-jobvis-user-id/);
  assert.match(mockApi, /x-jobvis-api-mode/);
  assert.match(mockApi, /filterApplications/);
  assert.match(mockApi, /completeSchedule/);
  assert.match(homePage, /<HomeClientPage today=\{today\} todayLabel=\{todayLabel\}/);
  assert.match(homeClientPage, /buildRuleBasedHomeSummary/);
  assert.match(homeClientPage, /home-mail-setup-banner/);
  assert.match(homeClientPage, /채용 메일 연결하기/);
  assert.match(homeClientPage, /href="\/settings\?connect=mail"/);
  assert.doesNotMatch(homeClientPage, /href="\/settings\?connect=gmail"/);
  assert.doesNotMatch(homeClientPage, /href="\/settings\?connect=naver"/);
  assert.match(homeSummary, /source: "rule"/);
  assert.match(homeSummary, /briefing/);
  assert.match(apiClient, /\/api\/backend/);
  assert.match(apiClient, /JobvisApiUnavailableError/);
  assert.doesNotMatch(styles, /thead\s*\{\s*display:\s*none/);
  await assert.rejects(access(new URL("../app/_sites-preview", projectRoot)));
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

test("application reducer applies representative user actions", () => {
  const event = {
    id: "test-event",
    type: "task",
    title: "테스트 변경",
    description: "사용자 동작을 재현합니다.",
    occurredAt: "2026-08-16T12:00:00+09:00",
  };
  const change = {
    id: "test-change",
    title: "검토 상태",
    description: "확인 필요 → 확인 완료",
    occurredAt: "2026-08-16T12:00:00+09:00",
  };
  let state = initialApplications;
  const tossInitialActivityCount =
    state.find((application) => application.id === "toss-payments")
      ?.activities.length ?? 0;

  state = applicationReducer(state, {
    type: "mark-reviewed",
    id: "toss-payments",
    changes: [change],
  });
  const reviewed = state.find(
    (application) => application.id === "toss-payments",
  );
  assert.equal(reviewed?.needsReview, false);
  assert.equal(reviewed?.activities.length, tossInitialActivityCount);
  assert.equal(reviewed?.changes.length, 1);

  state = applicationReducer(state, {
    type: "mark-reviewed",
    id: "toss-payments",
    changes: [change],
  });
  const reviewedAgain = state.find(
    (application) => application.id === "toss-payments",
  );
  assert.strictEqual(reviewedAgain, reviewed);

  state = applicationReducer(state, {
    type: "complete-next-action",
    id: "toss-payments",
    activity: event,
    changes: [
      {
        ...change,
        id: "test-change-task",
        title: "일정 상태",
        description: "미완료 → 완료",
      },
    ],
  });
  const completed = state.find(
    (application) => application.id === "toss-payments",
  );
  assert.equal(completed?.nextActionCompleted, true);
  assert.equal(completed?.activities.length, tossInitialActivityCount + 1);
  assert.equal(completed?.changes.length, 2);

  state = applicationReducer(state, {
    type: "complete-next-action",
    id: "toss-payments",
    activity: event,
    changes: [{ ...change, id: "duplicate-task-change" }],
  });
  const completedAgain = state.find(
    (application) => application.id === "toss-payments",
  );
  assert.strictEqual(completedAgain, completed);

  const musinsaInitialActivityCount =
    state.find((application) => application.id === "musinsa")?.activities
      .length ?? 0;
  state = applicationReducer(state, {
    type: "save-memo",
    id: "musinsa",
    memo: "코딩 테스트 회고",
    changes: [
      {
        ...change,
        title: "메모",
        description: "기존 메모 → 코딩 테스트 회고",
      },
    ],
  });
  const memoEdited = state.find(
    (application) => application.id === "musinsa",
  );
  assert.equal(memoEdited?.memo, "코딩 테스트 회고");
  assert.equal(memoEdited?.activities.length, musinsaInitialActivityCount);
  assert.equal(memoEdited?.changes.length, 1);

  state = applicationReducer(state, {
    type: "save-memo",
    id: "musinsa",
    memo: "코딩 테스트 회고",
    changes: [{ ...change, id: "duplicate-memo-change" }],
  });
  const memoEditedAgain = state.find(
    (application) => application.id === "musinsa",
  );
  assert.strictEqual(memoEditedAgain, memoEdited);

  state = applicationReducer(state, {
    type: "update-details",
    id: "musinsa",
    details: {
      company: "무신사 스토어",
      position: "Backend Engineer",
      location: "서울 성수동",
      employmentType: "정규직",
    },
    changes: [
      {
        ...change,
        id: "test-change-company",
        title: "회사",
        description: "무신사 → 무신사 스토어",
      },
      {
        ...change,
        id: "test-change-location",
        title: "근무지",
        description: "서울 성동구 → 서울 성수동",
      },
    ],
  });
  const edited = state.find((application) => application.id === "musinsa");
  assert.equal(edited?.company, "무신사 스토어");
  assert.equal(edited?.location, "서울 성수동");
  assert.equal(edited?.activities.length, musinsaInitialActivityCount);
  assert.deepEqual(
    edited?.changes.slice(0, 2).map((item) => item.title),
    ["회사", "근무지"],
  );
  assert.equal(edited?.changes.length, 3);

  state = applicationReducer(state, {
    type: "update-details",
    id: "musinsa",
    details: {
      company: "무신사 스토어",
      position: "Backend Engineer",
      location: "서울 성수동",
      employmentType: "정규직",
    },
    changes: [{ ...change, id: "duplicate-details-change" }],
  });
  const editedAgain = state.find(
    (application) => application.id === "musinsa",
  );
  assert.strictEqual(editedAgain, edited);

  state = applicationReducer(state, {
    type: "update-status",
    id: "daangn",
    status: "rejected",
    activity: { ...event, type: "status" },
    changes: [
      {
        ...change,
        id: "status-change",
        title: "진행 상태",
        description: "면접 진행 → 전형 종료",
      },
      change,
    ],
  });
  const closed = state.find((application) => application.id === "daangn");
  assert.equal(closed?.result, "rejected");
  assert.equal(closed?.nextActionCompleted, false);
  assert.equal(closed?.changes.length, 2);
  assert.deepEqual(
    closed?.changes.map((item) => item.title),
    ["진행 상태", "검토 상태"],
  );

  state = applicationReducer(state, {
    type: "update-status",
    id: "daangn",
    status: "rejected",
    activity: { ...event, id: "duplicate-status-event", type: "status" },
    changes: [{ ...change, id: "duplicate-status-change" }],
  });
  const closedAgain = state.find(
    (application) => application.id === "daangn",
  );
  assert.strictEqual(closedAgain, closed);

  const added = createManualApplication(
    { company: "새 회사", position: "Backend Engineer", stage: "applied" },
    "new-application",
    "2026-08-16T12:00:00+09:00",
    { ...event, type: "status" },
  );
  state = applicationReducer(state, { type: "add", application: added });
  assert.equal(state[0].id, "new-application");
  assert.equal(state[0].source, "직접 추가");
  assert.equal(state[0].emails.length, 0);
  assert.equal(state[0].changes.length, 0);
});

test("Seoul date keys stay correct across the UTC midnight boundary", () => {
  const afterSeoulMidnight = "2026-08-15T15:30:00.000Z";
  assert.equal(seoulDateKey(afterSeoulMidnight), "2026-08-16");
  assert.equal(fullDate(afterSeoulMidnight), "2026년 8월 16일");

  const event = {
    id: "midnight-event",
    type: "status",
    title: "자정 경계 지원",
    description: "서울 날짜를 사용합니다.",
    occurredAt: afterSeoulMidnight,
  };
  const application = createManualApplication(
    { company: "자정 테스트", position: "Engineer", stage: "applied" },
    "midnight-application",
    afterSeoulMidnight,
    event,
  );
  assert.equal(application.appliedAt, "2026-08-16");
  assert.equal(application.nextActionAt, "2026-08-16");

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
