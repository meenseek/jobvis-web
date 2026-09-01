"use client";

import { Select } from "@measure-twice/react";
import {
  BriefcaseBusiness,
  FileCheck2,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { seoulDateKey } from "@/src/applications/application-data";
import {
  fetchApplicationAnalytics,
  type ApplicationAnalytics,
} from "@/src/applications/jobvis-api-client";
import { cn } from "@/src/ui/class-names";
import styles from "./analytics.module.scss";

const today = seoulDateKey();
const [todayYear, todayMonth] = today.split("-").map(Number);
const SOURCE_LABELS: Record<string, string> = {
  gmail: "Gmail 메일",
  naver: "Naver 메일",
  outlook: "Outlook 메일",
  manual: "직접 추가",
  other: "기타",
};
const monthOptions = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(Date.UTC(
    todayYear,
    todayMonth - 1 - (5 - index),
    1,
  ));
  return {
    key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    label: `${date.getUTCMonth() + 1}월`,
  };
});

export default function AnalyticsPage() {
  const [range, setRange] = useState("180");
  const [summary, setSummary] = useState<ApplicationAnalytics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = useMemo(() => {
    if (range === "all") return null;
    const cutoff = new Date(`${today}T00:00:00+09:00`);
    cutoff.setDate(cutoff.getDate() - (Number(range) - 1));
    return seoulDateKey(cutoff);
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchApplicationAnalytics(from, today, controller.signal)
      .then((response) => {
        setSummary(response);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(
          error instanceof Error ? error.message : "지원 통계를 불러오지 못했습니다.",
        );
      });
    return () => controller.abort();
  }, [from]);

  const total = summary?.total ?? 0;
  const screened = summary?.screeningPassed ?? 0;
  const interviewed = summary?.reachedInterview ?? 0;
  const offered = summary?.offered ?? 0;
  const screeningRate = total ? Math.round((screened / total) * 100) : 0;
  const interviewRate = total ? Math.round((interviewed / total) * 100) : 0;
  const offerRate = total ? Math.round((offered / total) * 100) : 0;
  const flow = summary?.monthlyFlow ?? monthOptions.map(({ key }) => ({ month: key, count: 0 }));
  const flowOptions = flow.map(({ month }) => ({
    key: month,
    label: `${Number(month.slice(5, 7))}월`,
  }));
  const monthlyCounts = flow.map((item) => item.count);
  const maxMonthlyCount = Math.max(...monthlyCounts, 1);
  const chartLeft = 32;
  const chartRight = 568;
  const chartTop = 24;
  const chartBottom = 168;
  const chartPoints = monthlyCounts.map((count, index) => ({
    count,
    label: flowOptions[index].label,
    x:
      chartLeft +
      (index / (monthlyCounts.length - 1)) * (chartRight - chartLeft),
    y:
      chartBottom -
      (count / maxMonthlyCount) * (chartBottom - chartTop),
  }));
  const trendLinePath = chartPoints.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previousPoint = chartPoints[index - 1];
    const midpointX = (previousPoint.x + point.x) / 2;
    return `${path} C ${midpointX} ${previousPoint.y}, ${midpointX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const lastChartPoint = chartPoints[chartPoints.length - 1];
  const trendAreaPath = `${trendLinePath} L ${lastChartPoint.x} ${chartBottom} L ${chartPoints[0].x} ${chartBottom} Z`;
  const sourceCounts = summary?.sourceCounts ?? {};
  const conversionMetrics = [
    {
      key: "screening",
      label: "서류 합격률",
      count: screened,
      rate: screeningRate,
      className: styles["conversion-bar--screening"],
    },
    {
      key: "interview",
      label: "면접 진행률",
      count: interviewed,
      rate: interviewRate,
      className: styles["conversion-bar--interview"],
    },
    {
      key: "offer",
      label: "최종 합격률",
      count: offered,
      rate: offerRate,
      className: styles["conversion-bar--offer"],
    },
  ];

  return (
    <main
      id="main-content"
      className={cn("main-content", styles["analytics-page"])}
    >
      <section
        className={cn(
          "page-heading",
          styles["analytics-heading"],
        )}
      >
        <div>
          <h1>지원 통계</h1>
          <p>지원 수와 단계별 전환율을 실제 지원 이력에서 계산합니다.</p>
        </div>
        <Select
          label="통계 기간"
          size="sm"
          value={range}
          onChange={(event) => setRange(event.target.value)}
          wrapperClassName={styles["analytics-range"]}
        >
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
          <option value="180">최근 180일</option>
          <option value="all">전체</option>
        </Select>
      </section>

      {errorMessage ? (
        <div className="empty-state" role="alert">
          <strong>지원 통계를 불러오지 못했습니다.</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section
        className={cn(
          "stat-grid",
          "summary-strip",
          styles["summary-strip"],
        )}
        aria-label="지원 성과 요약"
      >
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <BriefcaseBusiness />
          </span>
          <div>
            <p>지원 수</p>
            <strong>{total}</strong>
            <small>선택 기간 내 지원</small>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <FileCheck2 />
          </span>
          <div>
            <p>서류 통과율</p>
            <strong>{screeningRate}%</strong>
            <small>{screened}건이 서류 심사 통과</small>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <UserRoundCheck />
          </span>
          <div>
            <p>면접 전환율</p>
            <strong>{interviewRate}%</strong>
            <small>{interviewed}건이 면접 단계 이상</small>
          </div>
        </article>
      </section>

      <div className={styles["analytics-grid"]}>
        <section className={styles["analytics-section"]}>
          <div className={styles["analytics-section-heading"]}>
            <h2>월별 지원 흐름</h2>
            <span className="panel-count">총 {total}건</span>
          </div>
          <article
            className={cn("panel", styles["analytics-chart-card"])}
            key={`trend-${range}`}
          >
            <figure className={styles["analytics-trend-chart"]}>
              <svg
                className={styles["analytics-trend-graphic"]}
                viewBox="0 0 600 190"
                role="img"
                aria-label="최근 6개월 월별 지원 건수 추이"
              >
                <defs>
                  <linearGradient
                    id="application-trend-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--mt-color-action)"
                      stopOpacity="0.2"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--mt-color-action)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                {[chartTop, (chartTop + chartBottom) / 2, chartBottom].map(
                  (y) => (
                    <line
                      className={styles["analytics-trend-grid"]}
                      x1={chartLeft}
                      x2={chartRight}
                      y1={y}
                      y2={y}
                      key={y}
                    />
                  ),
                )}
                <path
                  className={styles["analytics-trend-area"]}
                  d={trendAreaPath}
                  fill="url(#application-trend-fill)"
                />
                <path
                  className={styles["analytics-trend-line"]}
                  d={trendLinePath}
                  pathLength={1}
                />
                {chartPoints.map((point, index) => (
                  <g
                    className={cn(
                      styles["analytics-trend-point"],
                      index === chartPoints.length - 1 && styles["is-current"],
                    )}
                    style={{ animationDelay: `${480 + index * 90}ms` }}
                    key={flowOptions[index].key}
                  >
                    {index === chartPoints.length - 1 ? (
                      <circle
                        className={styles["analytics-trend-point-halo"]}
                        cx={point.x}
                        cy={point.y}
                        r="8"
                      />
                    ) : null}
                    <circle
                      className={styles["analytics-trend-point-core"]}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                    />
                  </g>
                ))}
              </svg>
              <figcaption className={styles["analytics-trend-labels"]}>
                {chartPoints.map((point, index) => (
                  <span key={flowOptions[index].key}>
                    <strong>{point.count}건</strong>
                    <small>{point.label}</small>
                  </span>
                ))}
              </figcaption>
            </figure>
          </article>
        </section>

        <section className={styles["analytics-section"]}>
          <div className={styles["analytics-section-heading"]}>
            <h2>전형 단계 전환</h2>
          </div>
          <article
            className={cn("panel", styles["analytics-chart-card"])}
            key={`conversion-${range}`}
          >
            <div className={styles["conversion-list"]}>
              {conversionMetrics.map((metric, index) => (
                <div className={styles["conversion-row"]} key={metric.key}>
                  <div className={styles["conversion-row-heading"]}>
                    <span>
                      <strong>{metric.label}</strong>
                      <small>{metric.count}건 / 전체 {total}건</small>
                    </span>
                    <b>{metric.rate}%</b>
                  </div>
                  <div className={styles["conversion-track"]}>
                    <span
                      className={metric.className}
                      style={{
                        width: `${metric.rate}%`,
                        animationDelay: `${160 + index * 120}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      <section
        className={cn(styles["analytics-section"], styles["source-section"])}
        key={`sources-${range}`}
      >
        <div className={styles["analytics-section-heading"]}>
          <h2>지원 이력 출처</h2>
        </div>
        <article className={cn("panel", styles["analytics-chart-card"])}>
          <div className={styles["source-breakdown"]}>
            {Object.entries(sourceCounts).map(([source, count]) => (
              <div key={source}>
                <span>
                  <strong>{SOURCE_LABELS[source] ?? "기타"}</strong>
                  <small>{count}건</small>
                </span>
                <span className={styles["source-track"]}>
                  <span
                    style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
