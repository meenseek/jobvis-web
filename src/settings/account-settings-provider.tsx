"use client";

import { createContext, ReactNode, useContext, useReducer } from "react";
import {
  AccountSettingsState,
  accountSettingsReducer,
  initialAccountSettings,
  MailProvider,
} from "./settings-state";

type AccountSettingsContextValue = AccountSettingsState & {
  connectMail: (provider: MailProvider, email: string) => void;
  disconnectMail: () => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  syncMail: () => void;
};

const AccountSettingsContext =
  createContext<AccountSettingsContextValue | null>(null);

export function AccountSettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    accountSettingsReducer,
    initialAccountSettings,
  );

  function connectMail(provider: MailProvider, email: string) {
    dispatch({
      type: "connect-mail",
      provider,
      email,
      occurredAt: new Date().toISOString(),
    });
  }

  function syncMail() {
    dispatch({ type: "sync-mail", occurredAt: new Date().toISOString() });
  }

  function disconnectMail() {
    dispatch({ type: "disconnect-mail" });
  }

  function setAutoSyncEnabled(enabled: boolean) {
    dispatch({ type: "set-auto-sync", enabled });
  }

  return (
    <AccountSettingsContext.Provider
      value={{
        ...state,
        connectMail,
        disconnectMail,
        setAutoSyncEnabled,
        syncMail,
      }}
    >
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
