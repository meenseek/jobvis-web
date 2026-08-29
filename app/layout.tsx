import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@measure-twice/react/styles.css";
import "./globals.scss";
import { AuthGate } from "@/src/auth/auth-gate";
import { AuthProvider } from "@/src/auth/auth-provider";
import { AccountSettingsProvider } from "@/src/settings/account-settings-provider";
import { AppShell } from "@/src/shell/app-shell";
import { ApplicationProvider } from "@/src/applications/application-provider";

export const metadata: Metadata = {
  title: "Jobvis · 구직 활동 대시보드",
  description:
    "지원 현황, 관련 메일, 일정과 전환율을 한곳에서 관리하는 개인 구직 활동 대시보드입니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <AuthGate>
            <AccountSettingsProvider>
              <ApplicationProvider>
                <AppShell>{children}</AppShell>
              </ApplicationProvider>
            </AccountSettingsProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
