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
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  applicationDetailPath,
  applicationListPath,
} from "@/src/applications/application-navigation";
import {
  invalidateJobvisApplications,
  JOBVIS_APPLICATIONS_INVALIDATED,
} from "@/src/api/jobvis-data-events";
import {
  completeAllApplicationReviews,
  createApplication,
  fetchApplicationPage,
  type ApplicationPage,
} from "@/src/applications/jobvis-api-client";
import {
  ApplicationFilter,
  ApplicationStage,
  applicationStatusDisplayLabel,
  applicationStatusTone,
  DISPLAY_STATUS_OPTIONS,
  fullDate,
  normalizeApplicationFilter,
  STAGE_OPTIONS,
} from "@/src/applications/application-data";
import { cn } from "@/src/ui/class-names";
import { MutationAttemptRegistry } from "@/src/api/mutation-attempts";
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
  const router = useRouter();
  const query = initialQuery;
  const filter = initialFilter;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkReviewDialogOpen, setBulkReviewDialogOpen] = useState(false);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [stage, setStage] = useState<ApplicationStage>("applied");
  const [pageData, setPageData] = useState<ApplicationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mutationAttempts] = useState(() => new MutationAttemptRegistry());
  const applications = pageData?.items ?? [];
  const reviewCount = pageData?.needsReviewCount ?? 0;
  const currentListPath = applicationListPath(query, filter);

  const loadPage = useCallback(
    async (
      page = 0,
      append = false,
      signal?: AbortSignal,
    ): Promise<ApplicationPage | null> => {
      setLoading(true);
      try {
        const response = await fetchApplicationPage(
          query,
          filter,
          page,
          100,
          signal,
        );
        setPageData((current) =>
          append && current
            ? { ...response, items: [...current.items, ...response.items] }
            : response,
        );
        setErrorMessage(null);
        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "지원 목록을 불러오지 못했습니다.",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [filter, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => void loadPage(0, false, controller.signal));
    return () => {
      cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [loadPage]);

  useEffect(() => {
    const reload = () => void loadPage();
    window.addEventListener(JOBVIS_APPLICATIONS_INVALIDATED, reload);
    return () => window.removeEventListener(JOBVIS_APPLICATIONS_INVALIDATED, reload);
  }, [loadPage]);

  function updateList(nextQuery: string, nextFilter: ApplicationFilter) {
    router.replace(applicationListPath(nextQuery, nextFilter));
  }

  async function handleAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !position.trim()) return;
    const key = "create-application";
    const mutationId = mutationAttempts.idFor(key, [company, position, stage]);
    let id: string;
    try {
      id = (await createApplication({ company, position, stage }, mutationId)).id;
      mutationAttempts.clear(key, mutationId);
      invalidateJobvisApplications();
    } catch (error) {
      await loadPage();
      setErrorMessage(
        error instanceof Error ? error.message : "지원 이력을 추가하지 못했습니다.",
      );
      return;
    }
    setCompany("");
    setPosition("");
    setStage("applied");
    setDialogOpen(false);
    router.push(applicationDetailPath(id, currentListPath));
  }

  async function handleBulkReviewComplete() {
    if (!reviewCount || !pageData || bulkReviewing) return;
    setBulkReviewing(true);
    const expectedReviewRevision = pageData.reviewRevision;
    const key = "complete-bulk-review";
    const mutationId = mutationAttempts.idFor(key, [expectedReviewRevision]);
    try {
      await completeAllApplicationReviews(
        expectedReviewRevision,
        mutationId,
      );
      mutationAttempts.clear(key, mutationId);
      invalidateJobvisApplications();
      await loadPage();
      setBulkReviewDialogOpen(false);
    } catch (error) {
      const recoveredPage = await loadPage();
      const reviewStateChanged =
        recoveredPage !== null &&
        recoveredPage.reviewRevision !== expectedReviewRevision;
      if (reviewStateChanged) mutationAttempts.clear(key, mutationId);
      if (reviewStateChanged && recoveredPage.needsReviewCount === 0) {
        invalidateJobvisApplications();
        setBulkReviewDialogOpen(false);
        return;
      }
      setErrorMessage(
        error instanceof Error ? error.message : "일괄 확인을 완료하지 못했습니다.",
      );
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
        {errorMessage ? (
          <div className="empty-state" role="alert">
            <strong>지원 목록을 불러오지 못했습니다.</strong>
            <p>{errorMessage}</p>
            <Button tone="neutral" variant="outline" onClick={() => loadPage()}>
              다시 시도
            </Button>
          </div>
        ) : null}
        <div>
          <h1>지원 현황</h1>
          <p>회사·포지션·상태를 비교하고 확인할 지원 건을 정리하세요.</p>
        </div>
        <div className={styles["applications-heading-actions"]}>
          <Button
            tone="neutral"
            variant="outline"
            disabled={!reviewCount || bulkReviewing}
            onClick={() => setBulkReviewDialogOpen(true)}
          >
            {bulkReviewing ? "확인 중" : "일괄 확인"}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>지원 내역 추가</Button>
        </div>
      </section>

      <section
        className={styles["applications-panel"]}
        aria-label="지원 목록"
      >
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
                <strong>{pageData?.totalCount ?? 0}</strong>
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
              {applications.map((application) => {
                const detailPath = applicationDetailPath(
                  application.id,
                  currentListPath,
                );
                const statusText = applicationStatusDisplayLabel(
                  application.status,
                  application.needsReview,
                );

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
                          `status-badge--${applicationStatusTone(
                            application.status,
                            application.needsReview,
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
          {!loading && applications.length === 0 ? (
            <div className="empty-state">
              <strong>조건에 맞는 지원 이력이 없습니다.</strong>
              <p>검색어나 진행 상태를 바꿔보세요.</p>
            </div>
          ) : null}
        </div>
        <footer className={styles["table-footer"]}>
          <span>
            {applications.length}개 / {pageData?.filteredCount ?? 0}개 이력 표시 중
          </span>
          {pageData?.hasNext ? (
            <Button
              size="sm"
              tone="neutral"
              variant="ghost"
              disabled={loading}
              onClick={() => loadPage(pageData.page + 1, true)}
            >
              더 보기
            </Button>
          ) : (
            <span>메일 원문 연결 정보 포함</span>
          )}
        </footer>
      </section>

      <Dialog
        title="확인 필요 항목을 일괄 확인할까요?"
        description={`${reviewCount}개 지원건의 확인 필요 표시를 모두 해제합니다.`}
        closeLabel="일괄 확인 확인 창 닫기"
        open={bulkReviewDialogOpen}
        onOpenChange={(open) => {
          if (!bulkReviewing) setBulkReviewDialogOpen(open);
        }}
      >
        <DialogActions>
          <Button
            type="button"
            tone="neutral"
            variant="ghost"
            onClick={() => setBulkReviewDialogOpen(false)}
            disabled={bulkReviewing}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleBulkReviewComplete}
            disabled={!reviewCount || bulkReviewing}
          >
            {bulkReviewing ? "확인 중" : "확인 완료"}
          </Button>
        </DialogActions>
      </Dialog>

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
            onChange={(event) => setStage(event.target.value as ApplicationStage)}
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
