type AnalyticsWindow = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  jobvisGaMeasurementId?: string;
  jobvisGaPagePath?: string;
};

const publicPaths = new Set([
  "/", "/applications", "/calendar", "/analytics", "/settings",
  "/about", "/privacy", "/terms", "/oauth/callback",
]);

export function isAnalyticsOrigin(origin: string, expected: string) {
  return /^https:\/\/[^/?#]+$/.test(expected) && origin === expected;
}

export function analyticsPagePath(pathname: string) {
  if (publicPaths.has(pathname)) return pathname;
  if (/^\/applications\/[^/]+\/?$/.test(pathname)) return "/applications/:id";
  return "/other";
}

export function trackPageView(
  target: AnalyticsWindow,
  measurementId: string,
  pathname: string,
  origin: string,
) {
  const pagePath = analyticsPagePath(pathname);
  const page = {
    page_location: `${origin}${pagePath}`,
    page_path: pagePath,
    page_title: `Jobvis ${pagePath}`,
    page_referrer: "",
  };
  target.dataLayer ??= [];
  target.gtag ??= function () {
    // Google tag는 배열이 아닌 Arguments 명령만 처리한다.
    // eslint-disable-next-line prefer-rest-params
    target.dataLayer?.push(arguments);
  };
  if (target.jobvisGaMeasurementId !== measurementId) {
    target.gtag("js", new Date());
    target.gtag("config", measurementId, {
      ...page,
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      send_page_view: false,
    });
    target.jobvisGaMeasurementId = measurementId;
    target.jobvisGaPagePath = undefined;
  }
  if (target.jobvisGaPagePath === pathname) return;
  target.gtag("event", "page_view", { ...page, send_to: measurementId });
  target.jobvisGaPagePath = pathname;
}
