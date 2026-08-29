"use client";

import {
  Button,
  Dialog,
  DialogActions,
  Select,
  TextField,
} from "@measure-twice/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  applicationDetailPath,
  applicationListPath,
} from "@/src/applications/application-navigation";
import { useApplications } from "@/src/applications/application-provider";
import {
  ApplicationFilter,
  ApplicationStage,
  applicationDisplayStatusLabel,
  applicationStatusBadgeTone,
  DISPLAY_STATUS_OPTIONS,
  filterApplications,
  fullDate,
  normalizeApplicationFilter,
  STAGE_OPTIONS,
} from "@/src/applications/application-data";
import { cn } from "@/src/ui/class-names";
import styles from "./applications.module.scss";

function ApplicationFilters({
  query,
  filter,
  onSearch,
  onFilter,
}: {
  query: string;
  filter: ApplicationFilter;
  onSearch: (query: string) => void;
  onFilter: (filter: ApplicationFilter, query: string) => void;
}) {
  const [draft, setDraft] = useState(query);

  return (
    <form
      className={styles["table-filters"]}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft);
      }}
    >
      <TextField
        label="지원 이력 검색"
        size="sm"
        type="search"
        placeholder="회사 또는 포지션"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Select
        label="진행 상태"
        size="sm"
        value={filter}
        onChange={(event) =>
          onFilter(normalizeApplicationFilter(event.target.value), draft)
        }
      >
        <option value="all">전체 상태</option>
        {DISPLAY_STATUS_OPTIONS.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" tone="neutral" variant="outline">
        검색
      </Button>
    </form>
  );
}

type ApplicationsClientPageProps = {
  initialQuery: string;
  initialFilter: ApplicationFilter;
};

export default function ApplicationsClientPage({
  initialQuery,
  initialFilter,
}: ApplicationsClientPageProps) {
  const { applications, addApplication, markReviewed } = useApplications();
  const router = useRouter();
  const query = initialQuery;
  const filter = initialFilter;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [stage, setStage] = useState<ApplicationStage>("applied");

  const filteredApplications = useMemo(
    () => filterApplications(applications, query, filter),
    [applications, filter, query],
  );
  const reviewCount = applications.filter(
    (application) => application.needsReview,
  ).length;
  const reviewApplicationIds = useMemo(
    () =>
      applications
        .filter((application) => application.needsReview)
        .map((application) => application.id),
    [applications],
  );
  const currentListPath = applicationListPath(query, filter);

  function updateList(nextQuery: string, nextFilter: ApplicationFilter) {
    router.replace(applicationListPath(nextQuery, nextFilter));
  }

  async function handleAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !position.trim()) return;
    const id = await addApplication({ company, position, stage });
    setCompany("");
    setPosition("");
    setStage("applied");
    setDialogOpen(false);
    router.push(applicationDetailPath(id, currentListPath));
  }

  async function handleBulkReviewComplete() {
    if (!reviewApplicationIds.length || bulkReviewing) return;
    setBulkReviewing(true);
    try {
      await Promise.all(reviewApplicationIds.map((id) => markReviewed(id)));
    } finally {
      setBulkReviewing(false);
    }
  }

  return (
    <main id="main-content" className="main-content">
      <section
        className={cn(
          "page-heading",
          styles["applications-page-heading"],
        )}
      >
        <div>
          <h1>지원 현황</h1>
          <p>회사·포지션·상태를 비교하고 확인할 지원 건을 정리하세요.</p>
        </div>
        <div className={styles["applications-heading-actions"]}>
          <Button
            tone="neutral"
            variant="outline"
            disabled={!reviewCount || bulkReviewing}
            onClick={handleBulkReviewComplete}
          >
            {bulkReviewing ? "확인 중" : "일괄 확인"}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>지원 내역 추가</Button>
        </div>
      </section>

      <section className={styles["applications-panel"]}>
        <div className={styles["applications-toolbar"]}>
          <div className={styles["applications-toolbar-start"]}>
            <div className={styles["application-summary-controls"]}>
              <button
                type="button"
                className={styles["summary-filter"]}
                aria-pressed={filter === "all"}
                onClick={() => updateList(query, "all")}
              >
                <span>전체 지원</span>
                <strong>{applications.length}</strong>
              </button>
              <button
                type="button"
                className={cn(
                  styles["summary-filter"],
                  styles["summary-filter-review"],
                )}
                aria-pressed={filter === "review"}
                onClick={() => updateList(query, "review")}
              >
                <span>확인 필요</span>
                <strong>{reviewCount}</strong>
              </button>
            </div>
          </div>
          <ApplicationFilters
            key={currentListPath}
            query={query}
            filter={filter}
            onSearch={(nextQuery) => updateList(nextQuery, filter)}
            onFilter={(nextFilter, nextQuery) =>
              updateList(nextQuery, nextFilter)
            }
          />
        </div>

        <div className={styles["table-wrap"]}>
          <table>
            <caption>검색 및 진행 상태 필터가 적용된 지원 목록</caption>
            <thead>
              <tr>
                <th scope="col">회사 / 포지션</th>
                <th className={styles["status-cell"]} scope="col">
                  상태
                </th>
                <th scope="col">출처</th>
                <th className={styles["date-cell"]} scope="col">
                  지원일
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application) => {
                const detailPath = applicationDetailPath(
                  application.id,
                  currentListPath,
                );
                const statusText = applicationDisplayStatusLabel(application);

                return (
                  <tr
                    key={application.id}
                    className={styles["application-row"]}
                    tabIndex={0}
                    role="link"
                    aria-label={`${application.company} ${application.position} 지원 상세 보기`}
                    onClick={() => router.push(detailPath)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(detailPath);
                      }
                    }}
                  >
                    <td>
                      <div className={styles["company-cell"]}>
                        <span
                          className="company-monogram"
                          aria-hidden="true"
                        >
                          {application.company.slice(0, 1)}
                        </span>
                        <span>
                          <Link
                            className={styles["row-detail-link"]}
                            href={detailPath}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <strong>{application.company}</strong>
                          </Link>
                          <small>{application.position}</small>
                        </span>
                      </div>
                    </td>
                    <td className={styles["status-cell"]} data-label="상태">
                      <span
                        className={cn(
                          "status-badge",
                          `status-badge--${applicationStatusBadgeTone(
                            application,
                          )}`,
                        )}
                      >
                        {statusText}
                      </span>
                    </td>
                    <td className={styles["source-cell"]} data-label="출처">
                      {application.source}
                    </td>
                    <td className={styles["date-cell"]} data-label="지원일">
                      {fullDate(application.appliedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredApplications.length === 0 ? (
            <div className="empty-state">
              <strong>조건에 맞는 지원 이력이 없습니다.</strong>
              <p>검색어나 진행 상태를 바꿔보세요.</p>
            </div>
          ) : null}
        </div>
        <footer className={styles["table-footer"]}>
          <span>{filteredApplications.length}개 이력 표시 중</span>
          <span>메일 원문 연결 정보 포함</span>
        </footer>
      </section>

      <Dialog
        title="지원 내역 추가"
        description="메일에 없는 지원 이력을 직접 기록할 수 있습니다."
        closeLabel="지원 내역 추가 창 닫기"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <form
          className="application-form"
          onSubmit={handleAddApplication}
        >
          <TextField
            label="회사"
            placeholder="예: 네이버"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            required
          />
          <TextField
            label="포지션"
            placeholder="예: Backend Engineer"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            required
          />
          <Select
            label="진행 상태"
            value={stage}
            onChange={(event) =>
              setStage(event.target.value as ApplicationStage)
            }
          >
            {STAGE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <DialogActions>
            <Button
              type="button"
              tone="neutral"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button type="submit">이력 저장</Button>
          </DialogActions>
        </form>
      </Dialog>
    </main>
  );
}
