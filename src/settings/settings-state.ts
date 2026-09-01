export type MailProvider = "gmail" | "outlook" | "naver";

export type MailConnection = {
  provider: MailProvider;
  email: string;
  lastSyncedAt: string | null;
};

export type AccountSettingsState = {
  mailConnection: MailConnection | null;
  autoSyncEnabled: boolean;
};

export type AccountSettingsAction =
  | {
      type: "connect-mail";
      provider: MailProvider;
      email: string;
      occurredAt: string;
    }
  | { type: "sync-mail"; occurredAt: string }
  | { type: "set-auto-sync"; enabled: boolean }
  | { type: "disconnect-mail" };

export const initialAccountSettings: AccountSettingsState = {
  mailConnection: null,
  autoSyncEnabled: true,
};

export function accountSettingsReducer(
  state: AccountSettingsState,
  action: AccountSettingsAction,
): AccountSettingsState {
  switch (action.type) {
    case "connect-mail":
      return {
        ...state,
        mailConnection: {
          provider: action.provider,
          email: action.email,
          lastSyncedAt: action.occurredAt,
        },
      };
    case "sync-mail":
      if (!state.mailConnection) return state;
      return {
        ...state,
        mailConnection: {
          ...state.mailConnection,
          lastSyncedAt: action.occurredAt,
        },
      };
    case "set-auto-sync":
      return {
        ...state,
        autoSyncEnabled: action.enabled,
      };
    case "disconnect-mail":
      return { ...state, mailConnection: null };
  }
}

export function mailProviderLabel(provider: MailProvider) {
  if (provider === "gmail") return "Gmail";
  if (provider === "outlook") return "Outlook";
  return "Naver";
}

export function formatMailSyncTime(isoDate: string | null) {
  if (!isoDate) return "동기화 전";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}
