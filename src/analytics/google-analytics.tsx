"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { isAnalyticsOrigin, trackPageView } from "./google-analytics-runtime";

const measurementId =
  process.env.NEXT_PUBLIC_JOBVIS_GA_MEASUREMENT_ID?.trim() ?? "";
const isConfigured = /^G-[A-Z0-9]{10}$/.test(measurementId);
const siteOrigin = process.env.NEXT_PUBLIC_JOBVIS_WEB_ORIGIN?.trim() ?? "";
const subscribeToOrigin = () => () => undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    jobvisGaMeasurementId?: string;
    jobvisGaPagePath?: string;
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const enabled = useSyncExternalStore(
    subscribeToOrigin,
    () => isConfigured && isAnalyticsOrigin(window.location.origin, siteOrigin),
    () => false,
  );

  useEffect(() => {
    if (!enabled) return;

    trackPageView(window, measurementId, pathname, window.location.origin);
  }, [enabled, pathname]);

  if (!isConfigured || !enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
