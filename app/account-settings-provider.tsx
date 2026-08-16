"use client";

import { createContext, ReactNode, useContext, useReducer } from "react";
import {
  AccountSettingsState,
  accountSettingsReducer,
  initialAccountSettings,
} from "./settings-state";

type AccountSettingsContextValue = AccountSettingsState & {
  connectGmail: () => void;
  disconnectMail: () => void;
  syncGmail: () => void;
};

const AccountSettingsContext =
  createContext<AccountSettingsContextValue | null>(null);

export function AccountSettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    accountSettingsReducer,
    initialAccountSettings,
  );

  function connectGmail() {
    dispatch({
      type: "connect-gmail",
      email: "career@jobvis.example",
      occurredAt: new Date().toISOString(),
    });
  }

  function syncGmail() {
    dispatch({ type: "sync-gmail", occurredAt: new Date().toISOString() });
  }

  function disconnectMail() {
    dispatch({ type: "disconnect-mail" });
  }

  return (
    <AccountSettingsContext.Provider
      value={{
        ...state,
        connectGmail,
        disconnectMail,
        syncGmail,
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
