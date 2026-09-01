import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import net from "node:net";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const gatewaySecret = "test-only-site-gateway-secret-32-bytes";
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

async function startFakeApi() {
  const port = await availablePort();
  fakeApi = createServer((request, response) => {
    upstreamRequests.push({ headers: request.headers, url: request.url });
    response.writeHead(200, { "content-type": "application/json" });
    if (request.url === "/api/v1/auth/me") {
      response.end(
        JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          displayName: "Sites 사용자",
          primaryEmail: null,
        }),
      );
      return;
    }
    response.end(JSON.stringify({ totalCount: 0 }));
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
    ["node_modules/vinext/dist/cli.js", "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        JOBVIS_API_BASE_URL: apiBaseUrl,
        JOBVIS_API_MODE: "sites",
        JOBVIS_TRUSTED_SITE_SECRET: gatewaySecret,
        NEXT_PUBLIC_JOBVIS_API_MODE: "sites",
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

test("Sites production BFF trusts only the platform identity", async () => {
  const apiBaseUrl = await startFakeApi();
  const baseUrl = await startVinext(apiBaseUrl);

  const forgedHeaders = {
    "oai-authenticated-user-id": "platform-user-1",
    "x-jobvis-site-gateway-secret": "browser-forged-secret",
    "x-jobvis-site-user-id": "browser-forged-user",
  };
  const backendResponse = await fetch(
    `${baseUrl}/api/backend/applications/counts`,
    { headers: forgedHeaders },
  );
  assert.equal(backendResponse.status, 200);
  const backendUpstream = upstreamRequests.at(-1);
  assert.equal(backendUpstream.url, "/api/v1/applications/counts");
  assert.equal(
    backendUpstream.headers["x-jobvis-site-user-id"],
    "platform-user-1",
  );
  assert.equal(
    backendUpstream.headers["x-jobvis-site-gateway-secret"],
    gatewaySecret,
  );

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { "oai-authenticated-user-id": "platform-user-1" },
  });
  assert.equal(meResponse.status, 200);
  assert.equal(upstreamRequests.at(-1).url, "/api/v1/auth/me");
  assert.equal(
    upstreamRequests.at(-1).headers["x-jobvis-site-user-id"],
    "platform-user-1",
  );

  const requestCount = upstreamRequests.length;
  const missingIdentityResponse = await fetch(
    `${baseUrl}/api/backend/applications/counts`,
  );
  assert.equal(missingIdentityResponse.status, 401);
  assert.equal(upstreamRequests.length, requestCount);
});
