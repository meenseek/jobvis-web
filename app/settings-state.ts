export type LoginProvider = "google" | "kakao";

export type MailConnection = {
  provider: "gmail";
  email: string;
  lastSyncedAt: string;
};

export type AccountSettingsState = {
  loginProvider: LoginProvider;
  loginEmail: string;
  mailConnection: MailConnection | null;
};

export type AccountSettingsAction =
  | { type: "connect-gmail"; email: string; occurredAt: string }
  | { type: "sync-gmail"; occurredAt: string }
  | { type: "disconnect-mail" };

export const initialAccountSettings: AccountSettingsState = {
  loginProvider: "google",
  loginEmail: "demo@jobvis.example",
  mailConnection: null,
};

export function accountSettingsReducer(
  state: AccountSettingsState,
  action: AccountSettingsAction,
): AccountSettingsState {
  switch (action.type) {
    case "connect-gmail":
      return {
        ...state,
        mailConnection: {
          provider: "gmail",
          email: action.email,
          lastSyncedAt: action.occurredAt,
        },
      };
    case "sync-gmail":
      if (!state.mailConnection) return state;
      return {
        ...state,
        mailConnection: {
          ...state.mailConnection,
          lastSyncedAt: action.occurredAt,
        },
      };
    case "disconnect-mail":
      return { ...state, mailConnection: null };
  }
}

export function loginProviderLabel(provider: LoginProvider) {
  return provider === "google" ? "Google" : "Kakao";
}

export function formatMailSyncTime(isoDate: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}
