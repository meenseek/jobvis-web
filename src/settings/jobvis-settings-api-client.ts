import type { components } from "../contracts/jobvis-api.generated";
import { apiRequest } from "../api/jobvis-api-client";

export type ConnectionCapability =
  components["schemas"]["ConnectionCapability"];
export type ExternalConnection = components["schemas"]["ExternalConnection"];
export type ImportRun = components["schemas"]["ImportRun"];
type ConnectNaverRequest = components["schemas"]["ConnectNaverRequest"];
type BeginOAuthConnectionRequest =
  components["schemas"]["BeginOAuthConnectionRequest"];
type BeginOAuthConnectionResponse =
  components["schemas"]["BeginOAuthConnectionResponse"];
type CompleteOAuthConnectionRequest =
  components["schemas"]["CompleteOAuthConnectionRequest"];
type UpdateMonitoringConsentRequest =
  components["schemas"]["UpdateMonitoringConsentRequest"];
type ResumeMonitoringRequest =
  components["schemas"]["ResumeMonitoringRequest"];
type CreateImportRunRequest =
  components["schemas"]["CreateImportRunRequest"];
type ImportRunPage = components["schemas"]["ImportRunPage"];

export type MailOAuthProvider = "gmail" | "outlook";

export function fetchConnectionCapabilities(signal?: AbortSignal) {
  return apiRequest<ConnectionCapability[]>("/connections/capabilities", {
    signal,
  });
}

export function fetchMailConnections(signal?: AbortSignal) {
  return apiRequest<ExternalConnection[]>(
    "/connections?capability=mail&includeRevoked=false",
    { signal },
  );
}

export function connectNaverMail(
  accountEmail: string,
  appPassword: string,
) {
  return apiRequest<ExternalConnection>("/connections/naver", {
    method: "POST",
    body: {
      accountEmail,
      appPassword,
      ongoingSyncConsent: false,
    } satisfies ConnectNaverRequest,
  });
}

export function beginMailOAuth(
  provider: MailOAuthProvider,
  redirectUri: string,
) {
  return apiRequest<BeginOAuthConnectionResponse>(
    `/connections/${provider}/oauth/begin`,
    {
      method: "POST",
      body: { redirectUri } satisfies BeginOAuthConnectionRequest,
    },
  );
}

export function completeMailOAuth(
  provider: MailOAuthProvider,
  state: string,
  code: string,
) {
  return apiRequest<ExternalConnection>(
    `/connections/${provider}/oauth/complete`,
    {
      method: "POST",
      body: {
        state,
        code,
        ongoingSyncConsent: false,
      } satisfies CompleteOAuthConnectionRequest,
    },
  );
}

export function updateMonitoringConsent(
  connection: ExternalConnection,
  enabled: boolean,
) {
  return apiRequest<ExternalConnection>(
    `/connections/${connection.id}/monitoring-consent`,
    {
      method: "PATCH",
      body: {
        expectedVersion: connection.version,
        enabled,
      } satisfies UpdateMonitoringConsentRequest,
    },
  );
}

export function resumeMonitoring(connection: ExternalConnection) {
  return apiRequest<ExternalConnection>(
    `/connections/${connection.id}/monitoring/resume`,
    {
      method: "POST",
      body: {
        expectedVersion: connection.version,
      } satisfies ResumeMonitoringRequest,
    },
  );
}

export function revokeConnection(connectionId: string) {
  return apiRequest<void>(`/connections/${connectionId}`, {
    method: "DELETE",
  });
}

export function createImportRun(
  connectionId: string,
  mutationId: string,
) {
  return apiRequest<ImportRun>("/import-runs", {
    method: "POST",
    body: { mutationId, connectionId } satisfies CreateImportRunRequest,
  });
}

export function fetchLatestImportRun(signal?: AbortSignal) {
  return apiRequest<ImportRunPage>("/import-runs?page=0&size=1", { signal });
}

export function fetchImportRun(runId: string, signal?: AbortSignal) {
  return apiRequest<ImportRun>(`/import-runs/${runId}`, { signal });
}
