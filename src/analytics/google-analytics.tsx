"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const measurementId =
  process.env.NEXT_PUBLIC_JOBVIS_GA_MEASUREMENT_ID?.trim() ?? "";
const isConfigured = /^G-[A-Z0-9]+$/.test(measurementId);

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    jobvisGaInitialized?: boolean;
    jobvisGaPagePath?: string;
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isConfigured) return;

    window.dataLayer = window.dataLayer ?? [];
    window.gtag =
      window.gtag ??
      ((...args: unknown[]) => {
        window.dataLayer?.push(args);
      });

    if (!window.jobvisGaInitialized) {
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        allow_ad_personalization_signals: false,
        allow_google_signals: false,
        send_page_view: false,
      });
      window.jobvisGaInitialized = true;
    }

    if (window.jobvisGaPagePath === pathname) return;
    window.jobvisGaPagePath = pathname;
    window.gtag("event", "page_view", {
      page_location: `${window.location.origin}${pathname}`,
      page_path: pathname,
      page_title: document.title,
    });
  }, [pathname]);

  if (!isConfigured) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
