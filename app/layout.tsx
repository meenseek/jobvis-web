import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@measure-twice/react/styles.css";
import "./globals.scss";
import { AuthGate } from "@/src/auth/auth-gate";
import { AuthProvider } from "@/src/auth/auth-provider";
import { AccountSettingsProvider } from "@/src/settings/account-settings-provider";
import { AppShell } from "@/src/shell/app-shell";
import { ApplicationProvider } from "@/src/applications/application-provider";

const title = "Jobvis · 구직 활동 대시보드";
const description =
  "지원 현황, 관련 메일, 일정과 전환율을 한곳에서 관리하는 개인 구직 활동 대시보드입니다.";

function configuredWebOrigin() {
  const rawOrigin = process.env.JOBVIS_WEB_ORIGIN?.trim();
  if (!rawOrigin) return undefined;

  const origin = new URL(rawOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("JOBVIS_WEB_ORIGIN must be an HTTPS origin");
  }
  return origin;
}

const metadataBase = configuredWebOrigin();
const socialImage = metadataBase
  ? new URL("/og.png", metadataBase).toString()
  : undefined;

export const metadata: Metadata = {
  title,
  description,
  metadataBase,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  ...(socialImage
    ? {
        openGraph: {
          title,
          description,
          type: "website" as const,
          url: metadataBase,
          images: [{ url: socialImage, width: 1200, height: 630 }],
        },
        twitter: {
          card: "summary_large_image" as const,
          title,
          description,
          images: [socialImage],
        },
      }
    : {}),
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
