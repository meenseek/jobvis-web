"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  JobvisApiUnavailableError,
  JobvisAuthenticationRequiredError,
  JobvisConflictError,
  JobvisRateLimitedError,
} from "../api/jobvis-api-client";
import { invalidateJobvisApplications } from "../api/jobvis-data-events";
import { MutationAttemptRegistry } from "../api/mutation-attempts";
import { useAuth } from "../auth/auth-provider";
import {
  beginMailOAuth,
  completeMailOAuth,
  connectNaverMail,
  createImportRun,
  type ConnectionCapability,
  type ExternalConnection,
  fetchConnectionCapabilities,
  fetchImportRun,
  fetchLatestImportRun,
  fetchMailConnections,
  type ImportRun,
  type MailOAuthProvider,
  resumeMonitoring as resumeMonitoringRequest,
  revokeConnection,
  updateMonitoringConsent,
} from "./jobvis-settings-api-client";

type SettingsLoadStatus = "loading" | "ready" | "error";
type SettingsAction =
  | "connect"
  | "disconnect"
  | "monitoring"
  | "oauth"
  | "sync"
  | null;

type AccountSettingsContextValue = {
  autoSyncEnabled: boolean;
  busyAction: SettingsAction;
  capabilities: ConnectionCapability[];
  clearError: () => void;
  completeOAuth: (
    provider: MailOAuthProvider,
    state: string,
    code: string,
  ) => Promise<boolean>;
  connectNaver: (
    accountEmail: string,
    appPassword: string,
  ) => Promise<boolean>;
  disconnectMail: () => Promise<boolean>;
  errorMessage: string | null;
  latestImportRun: ImportRun | null;
  loadStatus: SettingsLoadStatus;
  mailConnection: ExternalConnection | null;
  reloadConnections: () => Promise<void>;
  resumeMonitoring: () => Promise<boolean>;
  setAutoSyncEnabled: (enabled: boolean) => Promise<boolean>;
  startOAuth: (provider: MailOAuthProvider) => Promise<boolean>;
  syncMail: () => Promise<boolean>;
};

const isMockMode = process.env.NEXT_PUBLIC_JOBVIS_API_MODE === "mock";
const OAUTH_PROVIDER_KEY = "jobvis.mail-oauth.provider";
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);
const AccountSettingsContext =
  createContext<AccountSettingsContextValue | null>(null);

function mockConnection(
  provider: "gmail" | "naver",
  accountEmail: string,
): ExternalConnection {
  return {
    id: crypto.randomUUID(),
    provider,
    capability: "mail",
    accountEmail,
    status: "connected",
    ongoingSyncConsent: false,
    lastSyncedAt: null,
    nextSyncAfter: null,
    lastErrorCode: null,
    monitoringPaused: false,
    tokenExpiresAt: null,
    grantedScopes: [],
    version: 0,
  };
}

export function AccountSettingsProvider({ children }: { children: ReactNode }) {
  const { expireSession } = useAuth();
  const [mailConnection, setMailConnection] =
    useState<ExternalConnection | null>(null);
  const [capabilities, setCapabilities] = useState<ConnectionCapability[]>([]);
  const [loadStatus, setLoadStatus] = useState<SettingsLoadStatus>(
    isMockMode ? "ready" : "loading",
  );
  const [busyAction, setBusyAction] = useState<SettingsAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestImportRun, setLatestImportRun] = useState<ImportRun | null>(null);
  const [mutationAttempts] = useState(() => new MutationAttemptRegistry());

  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof JobvisAuthenticationRequiredError) {
        expireSession();
        return;
      }
      setErrorMessage(
        error instanceof Error && error.message ? error.message : fallback,
      );
    },
    [expireSession],
  );

  const reloadConnections = useCallback(async () => {
    if (isMockMode) return;
    try {
      const [nextCapabilities, connections, runPage] = await Promise.all([
        fetchConnectionCapabilities(),
        fetchMailConnections(),
        fetchLatestImportRun(),
      ]);
      setCapabilities(nextCapabilities);
      const connection = connections[0] ?? null;
      setMailConnection(connection);
      setLatestImportRun(
        runPage.items.find((run) => run.connectionId === connection?.id) ?? null,
      );
      setLoadStatus("ready");
      setErrorMessage(null);
    } catch (error) {
      reportError(error, "메일 연결 상태를 불러오지 못했습니다.");
      setLoadStatus("error");
    }
  }, [reportError]);

  useEffect(() => {
    if (isMockMode) return;
    const controller = new AbortController();
    void Promise.all([
      fetchConnectionCapabilities(controller.signal),
      fetchMailConnections(controller.signal),
      fetchLatestImportRun(controller.signal),
    ])
      .then(([nextCapabilities, connections, runPage]) => {
        setCapabilities(nextCapabilities);
        const connection = connections[0] ?? null;
        setMailConnection(connection);
        setLatestImportRun(
          runPage.items.find((run) => run.connectionId === connection?.id) ?? null,
        );
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        reportError(error, "메일 연결 상태를 불러오지 못했습니다.");
        setLoadStatus("error");
      });
    return () => controller.abort();
  }, [reportError]);

  useEffect(() => {
    if (
      isMockMode ||
      !latestImportRun ||
      TERMINAL_RUN_STATUSES.has(latestImportRun.status)
    ) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void fetchImportRun(latestImportRun.id)
        .then(async (run) => {
          if (!active) return;
          setLatestImportRun(run);
          if (TERMINAL_RUN_STATUSES.has(run.status)) {
            await reloadConnections();
            if (run.status === "completed") {
              setErrorMessage(null);
              invalidateJobvisApplications();
            } else {
              setErrorMessage(
                run.errorCode
                  ? `메일 동기화를 완료하지 못했습니다. (${run.errorCode})`
                  : "메일 동기화를 완료하지 못했습니다.",
              );
            }
          }
        })
        .catch((error: unknown) => {
          if (active) {
            reportError(error, "메일 동기화 상태를 확인하지 못했습니다.");
          }
        });
    }, 1000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [latestImportRun, reloadConnections, reportError]);

  async function connectNaver(accountEmail: string, appPassword: string) {
    setBusyAction("connect");
    setErrorMessage(null);
    try {
      const connection = isMockMode
        ? mockConnection("naver", accountEmail)
        : await connectNaverMail(accountEmail, appPassword);
      setMailConnection(connection);
      setLatestImportRun(null);
      mutationAttempts.clearAll();
      return true;
    } catch (error) {
      reportError(error, "Naver 메일을 연결하지 못했습니다.");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function startOAuth(provider: MailOAuthProvider) {
    if (isMockMode) {
      setMailConnection(mockConnection("gmail", "demo@gmail.com"));
      setLatestImportRun(null);
      mutationAttempts.clearAll();
      return true;
    }
    setBusyAction("oauth");
    setErrorMessage(null);
    try {
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const response = await beginMailOAuth(provider, redirectUri);
      window.sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);
      window.location.assign(response.authorizationUrl);
      return true;
    } catch (error) {
      reportError(error, "메일 연결 승인을 시작하지 못했습니다.");
      setBusyAction(null);
      return false;
    }
  }

  async function completeOAuth(
    provider: MailOAuthProvider,
    state: string,
    code: string,
  ) {
    setBusyAction("oauth");
    setErrorMessage(null);
    try {
      const connection = await completeMailOAuth(provider, state, code);
      setMailConnection(connection);
      setLatestImportRun(null);
      mutationAttempts.clearAll();
      window.sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
      return true;
    } catch (error) {
      if (
        error instanceof JobvisConflictError ||
        error instanceof JobvisApiUnavailableError
      ) {
        const connections = await fetchMailConnections().catch(() => []);
        const recovered = connections.find(
          (connection) =>
            connection.provider === provider && connection.status === "connected",
        );
        if (recovered) {
          setMailConnection(recovered);
          setLatestImportRun(null);
          mutationAttempts.clearAll();
          window.sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
          return true;
        }
      }
      reportError(error, "메일 연결 승인을 완료하지 못했습니다.");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectMail() {
    if (!mailConnection) return false;
    setBusyAction("disconnect");
    try {
      if (!isMockMode) await revokeConnection(mailConnection.id);
      setMailConnection(null);
      setLatestImportRun(null);
      mutationAttempts.clearAll();
      return true;
    } catch (error) {
      reportError(error, "메일 연결을 해제하지 못했습니다.");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function setAutoSyncEnabled(enabled: boolean) {
    if (!mailConnection) return false;
    setBusyAction("monitoring");
    try {
      const connection = isMockMode
        ? { ...mailConnection, ongoingSyncConsent: enabled }
        : await updateMonitoringConsent(mailConnection, enabled);
      setMailConnection(connection);
      return true;
    } catch (error) {
      reportError(error, "자동 동기화 설정을 저장하지 못했습니다.");
      if (error instanceof JobvisConflictError) await reloadConnections();
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function resumeMonitoring() {
    if (!mailConnection) return false;
    setBusyAction("monitoring");
    try {
      const connection = isMockMode
        ? { ...mailConnection, monitoringPaused: false }
        : await resumeMonitoringRequest(mailConnection);
      setMailConnection(connection);
      return true;
    } catch (error) {
      reportError(error, "자동 동기화를 재개하지 못했습니다.");
      if (error instanceof JobvisConflictError) await reloadConnections();
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function syncMail() {
    if (
      !mailConnection ||
      busyAction === "sync" ||
      (latestImportRun && !TERMINAL_RUN_STATUSES.has(latestImportRun.status))
    ) {
      return false;
    }
    setBusyAction("sync");
    setErrorMessage(null);
    try {
      if (isMockMode) {
        setMailConnection({
          ...mailConnection,
          lastSyncedAt: new Date().toISOString(),
        });
        invalidateJobvisApplications();
        return true;
      }
      const key = "sync-mail";
      const mutationId = mutationAttempts.idFor(key, [mailConnection.id]);
      let run;
      try {
        try {
          run = await createImportRun(mailConnection.id, mutationId);
        } catch (error) {
          if (!(error instanceof JobvisRateLimitedError)) throw error;
          setErrorMessage(error.message);
          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              (error.retryAfterSeconds ?? 30) * 1000,
            ),
          );
          run = await createImportRun(mailConnection.id, mutationId);
        }
      } catch (error) {
        if (
          !(error instanceof JobvisConflictError) &&
          !(error instanceof JobvisApiUnavailableError)
        ) {
          throw error;
        }
        const latest = await fetchLatestImportRun();
        run = latest.items.find(
          (item) =>
            item.connectionId === mailConnection.id &&
            !TERMINAL_RUN_STATUSES.has(item.status),
        );
        if (!run) throw error;
      }
      mutationAttempts.clear(key, mutationId);
      setLatestImportRun(run);
      setErrorMessage(null);
      return true;
    } catch (error) {
      reportError(error, "메일 동기화를 시작하지 못했습니다.");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  const value: AccountSettingsContextValue = {
      autoSyncEnabled: Boolean(
        mailConnection?.status === "connected" &&
          mailConnection.ongoingSyncConsent &&
          !mailConnection.monitoringPaused,
      ),
      busyAction,
      capabilities,
      clearError: () => setErrorMessage(null),
      completeOAuth,
      connectNaver,
      disconnectMail,
      errorMessage,
      latestImportRun,
      loadStatus,
      mailConnection,
      reloadConnections,
      resumeMonitoring,
      setAutoSyncEnabled,
      startOAuth,
      syncMail,
  };

  return (
    <AccountSettingsContext.Provider value={value}>
      {children}
    </AccountSettingsContext.Provider>
  );
}

export function useAccountSettings() {
  const context = useContext(AccountSettingsContext);
  if (!context) {
    throw new Error(
      "useAccountSettings must be used within AccountSettingsProvider",
    );
  }
  return context;
}

export function storedMailOAuthProvider(): MailOAuthProvider | null {
  const provider = window.sessionStorage.getItem(OAUTH_PROVIDER_KEY);
  return provider === "gmail" || provider === "outlook" ? provider : null;
}
