import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@measure-twice/react/styles.css";
import "./globals.css";
import { AccountSettingsProvider } from "./account-settings-provider";
import { AppShell } from "./app-shell";
import { ApplicationProvider } from "./application-provider";

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
    <html lang="ko">
      <body>
        <AccountSettingsProvider>
          <ApplicationProvider>
            <AppShell>{children}</AppShell>
          </ApplicationProvider>
        </AccountSettingsProvider>
      </body>
    </html>
  );
}
