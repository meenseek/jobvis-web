import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import net from "node:net";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const upstreamRequests = [];
let fakeApi;
let vinextServer;

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  server.close();
  await once(server, "close");
  return address.port;
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function startFakeApi() {
  const port = await availablePort();
  fakeApi = createServer(async (request, response) => {
    upstreamRequests.push({
      body: await requestBody(request),
      headers: request.headers,
      method: request.method,
      url: request.url,
    });

    if (request.url === "/api/v1/auth/exchange") {
      json(response, 200, {
        accessToken: "opaque-session-token",
        expiresAt: "2099-01-01T00:00:00Z",
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          displayName: "Cloudflare 사용자",
          primaryEmail: "cloudflare@example.com",
        },
      });
      return;
    }

    if (request.url === "/api/v1/auth/providers") {
      json(response, 200, [{ provider: "google", configured: true }]);
      return;
    }

    if (request.headers.authorization !== "Bearer opaque-session-token") {
      json(response, 401, {
        title: "Unauthorized",
        status: 401,
        detail: "로그인이 필요합니다.",
      });
      return;
    }

    if (request.url === "/api/v1/auth/me") {
      json(response, 200, {
        id: "22222222-2222-4222-8222-222222222222",
        displayName: "Cloudflare 사용자",
        primaryEmail: "cloudflare@example.com",
      });
      return;
    }

    json(response, 200, { totalCount: 0 });
  });
  fakeApi.listen(port, "127.0.0.1");
  await once(fakeApi, "listening");
  return `http://127.0.0.1:${port}`;
}

async function waitUntilReady(baseUrl) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/favicon.svg`);
      if (response.ok) return;
    } catch {
      // The production server has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vinext production server did not become ready");
}

async function startVinext(apiBaseUrl) {
  const port = await availablePort();
  vinextServer = spawn(
    process.execPath,
    [
      "node_modules/vinext/dist/cli.js",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        JOBVIS_API_BASE_URL: apiBaseUrl,
        JOBVIS_API_MODE: "api",
        NEXT_PUBLIC_JOBVIS_API_MODE: "api",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilReady(baseUrl);
  return baseUrl;
}

after(async () => {
  if (vinextServer && vinextServer.exitCode === null) {
    vinextServer.kill("SIGTERM");
    await once(vinextServer, "exit");
  }
  if (fakeApi) {
    fakeApi.close();
    await once(fakeApi, "close");
  }
});

test("Cloudflare production BFF owns the Jobvis session boundary", async () => {
  const apiBaseUrl = await startFakeApi();
  const baseUrl = await startVinext(apiBaseUrl);

  const anonymousMe = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(anonymousMe.status, 401);
  assert.equal(upstreamRequests.length, 0);

  const providers = await fetch(`${baseUrl}/api/auth/providers`);
  assert.equal(providers.status, 200);
  assert.deepEqual(await providers.json(), [
    { provider: "google", configured: true },
  ]);

  const exchange = await fetch(`${baseUrl}/api/auth/exchange`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
    },
    body: JSON.stringify({
      provider: "google",
      idToken: "test-id-token",
      challengeToken: "test-challenge",
      nonce: "test-nonce",
    }),
  });
  assert.equal(exchange.status, 200);
  assert.deepEqual(await exchange.json(), {
    expiresAt: "2099-01-01T00:00:00Z",
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Cloudflare 사용자",
      primaryEmail: "cloudflare@example.com",
    },
  });
  const setCookie = exchange.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /__Host-jobvis-session=opaque-session-token/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);

  const sessionCookie = "__Host-jobvis-session=opaque-session-token";
  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: sessionCookie },
  });
  assert.equal(me.status, 200);
  assert.equal(
    upstreamRequests.at(-1).headers.authorization,
    "Bearer opaque-session-token",
  );
  assert.equal(upstreamRequests.at(-1).headers.cookie, undefined);

  const counts = await fetch(
    `${baseUrl}/api/backend/applications/counts`,
    { headers: { cookie: sessionCookie } },
  );
  assert.equal(counts.status, 200);
  assert.equal(
    upstreamRequests.at(-1).headers.authorization,
    "Bearer opaque-session-token",
  );

  const forgedAuthorization = await fetch(
    `${baseUrl}/api/backend/applications/counts`,
    { headers: { authorization: "Bearer browser-forged-token" } },
  );
  assert.equal(forgedAuthorization.status, 401);
  assert.equal(upstreamRequests.at(-1).headers.authorization, undefined);

  const requestCount = upstreamRequests.length;
  const crossSiteMutation = await fetch(
    `${baseUrl}/api/backend/applications`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
        origin: "https://attacker.example",
      },
      body: "{}",
    },
  );
  assert.equal(crossSiteMutation.status, 403);
  assert.equal(upstreamRequests.length, requestCount);
});
