"use client";

import { Select } from "@measure-twice/react";
import {
  BriefcaseBusiness,
  FileCheck2,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApplications } from "@/src/applications/application-provider";
import { seoulDateKey, stageRank } from "@/src/applications/application-data";
import { cn } from "@/src/ui/class-names";
import styles from "./analytics.module.scss";

const today = seoulDateKey();
const [todayYear, todayMonth] = today.split("-").map(Number);
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
  const { applications } = useApplications();
  const [range, setRange] = useState("180");

  const periodApplications = useMemo(() => {
    const cutoff = new Date(`${today}T00:00:00+09:00`);
    cutoff.setDate(cutoff.getDate() - (Number(range) - 1));
    const cutoffKey = seoulDateKey(cutoff);
    return applications.filter(
      (application) => application.appliedAt >= cutoffKey,
    );
  }, [applications, range]);

  const total = periodApplications.length;
  const screened = periodApplications.filter(
    (application) => application.screeningPassed,
  ).length;
  const interviewed = periodApplications.filter(
    (application) =>
      stageRank[application.highestStageReached] >= stageRank.interview,
  ).length;
  const offered = periodApplications.filter(
    (application) => application.result === "offered",
  ).length;
  const screeningRate = total ? Math.round((screened / total) * 100) : 0;
  const interviewRate = total ? Math.round((interviewed / total) * 100) : 0;
  const monthlyCounts = monthOptions.map(({ key }) => {
    return periodApplications.filter((application) =>
      application.appliedAt.startsWith(key),
    ).length;
  });
  const maxMonthlyCount = Math.max(...monthlyCounts, 1);
  const chartLeft = 32;
  const chartRight = 568;
  const chartTop = 24;
  const chartBottom = 168;
  const chartPoints = monthlyCounts.map((count, index) => ({
    count,
    label: monthOptions[index].label,
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
  const sourceCounts = periodApplications.reduce<Record<string, number>>(
    (counts, application) => {
      const source = application.source.startsWith("Gmail")
        ? "Gmail"
        : application.source.startsWith("Naver")
          ? "Naver 메일"
          : "직접 추가";
      counts[source] = (counts[source] ?? 0) + 1;
      return counts;
    },
    {},
  );

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
        </Select>
      </section>

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

      <section className={styles["analytics-grid"]}>
        <article className="panel" key={`trend-${range}`}>
          <div className="panel-heading">
            <h2>월별 지원 흐름</h2>
            <span className="panel-count">총 {total}건</span>
          </div>
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
                  <stop offset="0%" stopColor="var(--mt-color-action)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--mt-color-action)" stopOpacity="0" />
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
                  key={monthOptions[index].key}
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
                <span key={monthOptions[index].key}>
                  <strong>{point.count}건</strong>
                  <small>{point.label}</small>
                </span>
              ))}
            </figcaption>
          </figure>
        </article>

        <article className="panel" key={`funnel-${range}`}>
          <div className="panel-heading">
            <h2>전형 단계 전환</h2>
          </div>
          <div className={styles["funnel-list"]}>
            {[
              ["전체 지원", total],
              ["서류 심사 통과", screened],
              ["면접 진입", interviewed],
              ["최종 합격", offered],
            ].map(([label, count], index) => (
              <div className={styles["funnel-row"]} key={label}>
                <span>
                  <strong>{label}</strong>
                  <small>{count}건</small>
                </span>
                <span className={styles["funnel-track"]}>
                  <span
                    style={{ width: `${total ? (Number(count) / total) * 100 : 0}%` }}
                  />
                </span>
                <small>
                  {index === 0 || total === 0
                    ? "100%"
                    : `${Math.round((Number(count) / total) * 100)}%`}
                </small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section
        className={cn("panel", styles["source-panel"])}
        key={`sources-${range}`}
      >
        <div className="panel-heading">
          <h2>지원 이력 출처</h2>
        </div>
        <div className={styles["source-breakdown"]}>
          {Object.entries(sourceCounts).map(([source, count]) => (
            <div key={source}>
              <span>
                <strong>{source}</strong>
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
      </section>
    </main>
  );
}
