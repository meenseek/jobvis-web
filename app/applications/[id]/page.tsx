"use client";

import {
  Button,
  Dialog,
  DialogActions,
  Select,
  StatusIndicator,
  TextField,
} from "@measure-twice/react";
import { ChevronDown, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { safeApplicationListPath } from "@/src/applications/application-navigation";
import { useApplications } from "@/src/applications/application-provider";
import type { ApplicationDetailsInput } from "@/src/applications/application-state";
import { CalloutBanner } from "@/src/ui/callout-banner";
import {
  ApplicationEmail,
  ApplicationProgressStatus,
  compareOccurredAtDesc,
  fullDate,
  fullDateTime,
  getApplicationProgressStatus,
  PROGRESS_STATUS_OPTIONS,
} from "@/src/applications/application-data";
import { cn } from "@/src/ui/class-names";
import styles from "@/src/applications/application-detail.module.scss";

function splitMemoBlocks(memo: string): string[] {
  return memo
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function joinMemoBlocks(blocks: string[]): string {
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

function memoPreview(block: string, index: number): string {
  return (
    block
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? `새 메모 ${index + 1}`
  );
}

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const {
    applications,
    deleteActivity,
    loadApplication,
    loadMoreHistory,
    markReviewed,
    saveMemo,
    updateApplicationDetails,
    updateProgressStatus,
  } = useApplications();
  const application = applications.find((item) => item.id === params.id);
  const [detailLoadState, setDetailLoadState] = useState<{
    id: string;
    status: "loading" | "ready" | "not-found" | "error";
  }>({ id: params.id, status: "loading" });
  const detailLoadStatus =
    detailLoadState.id === params.id ? detailLoadState.status : "loading";
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string[]>>({});
  const [openMemoDrafts, setOpenMemoDrafts] = useState<
    Record<string, number | null>
  >({});
  const [saved, setSaved] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDraft, setDetailsDraft] =
    useState<ApplicationDetailsInput | null>(null);
  const [selectedEmail, setSelectedEmail] =
    useState<ApplicationEmail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<
    "emails" | "activities" | "changes" | null
  >(null);
  const requestedReturnPath = searchParams.get("from");
  const returnPath = safeApplicationListPath(requestedReturnPath);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadApplication(params.id, controller.signal).then((result) => {
      if (active) setDetailLoadState({ id: params.id, status: result });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [detailReloadKey, loadApplication, params.id]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (detailLoadStatus === "loading") {
    return (
      <main id="main-content" className="main-content">
        <section className={cn("panel", styles["not-found-panel"])}>
          <h1>지원 상세 정보를 불러오는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (detailLoadStatus === "error") {
    return (
      <main id="main-content" className="main-content">
        <section className={cn("panel", styles["not-found-panel"])}>
          <h1>지원 상세 정보를 불러오지 못했습니다.</h1>
          <p>연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
          <Button
            onClick={() => {
              setDetailLoadState({ id: params.id, status: "loading" });
              setDetailReloadKey((value) => value + 1);
            }}
          >
            다시 시도
          </Button>
        </section>
      </main>
    );
  }

  if (detailLoadStatus === "not-found" || !application) {
    return (
      <main id="main-content" className="main-content">
        <section
          className={cn("panel", styles["not-found-panel"])}
        >
          <h1>지원 이력을 찾을 수 없습니다.</h1>
          <p>삭제되었거나 올바르지 않은 주소입니다.</p>
          <Link
            className={cn("detail-link", styles["not-found-link"])}
            href={returnPath}
          >
            지원 현황으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const selectedApplication = application;
  const memoBlocks =
    memoDrafts[selectedApplication.id] ??
    splitMemoBlocks(selectedApplication.memo);
  const memo = joinMemoBlocks(memoBlocks);
  const isMemoDirty = memo.trim() !== selectedApplication.memo.trim();
  const openMemoIndex = openMemoDrafts[selectedApplication.id] ?? null;
  const sortedActivities = [...selectedApplication.activities].sort(
    compareOccurredAtDesc,
  );
  const sortedChanges = [...(selectedApplication.changes ?? [])].sort(
    compareOccurredAtDesc,
  );

  async function handleMemoSave() {
    if (!isMemoDirty) return;
    const savedMemo = await saveMemo(selectedApplication.id, memo.trim());
    if (savedMemo) setSaved(true);
  }

  function updateMemoBlocks(updater: (blocks: string[]) => string[]) {
    setMemoDrafts((current) => {
      const nextBlocks = updater(
        current[selectedApplication.id] ??
          splitMemoBlocks(selectedApplication.memo),
      );
      return {
        ...current,
        [selectedApplication.id]: nextBlocks,
      };
    });
    setSaved(false);
  }

  function setOpenMemoIndex(index: number | null) {
    setOpenMemoDrafts((current) => ({
      ...current,
      [selectedApplication.id]: index,
    }));
  }

  function addMemoBlock() {
    const nextIndex = memoBlocks.length;
    updateMemoBlocks((blocks) => [...blocks, ""]);
    setOpenMemoIndex(nextIndex);
  }

  function openDetailsEditor() {
    setDetailsDraft({
      company: selectedApplication.company,
      position: selectedApplication.position,
      location: selectedApplication.location,
      employmentType: selectedApplication.employmentType,
      appliedAt: selectedApplication.appliedAt,
    });
    setEditDialogOpen(true);
  }

  function closeDetailsEditor() {
    setEditDialogOpen(false);
    setDetailsDraft(null);
  }

  function updateDetailsDraft(
    field: keyof ApplicationDetailsInput,
    value: string,
  ) {
    setDetailsDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  async function handleDetailsSave() {
    if (
      !detailsDraft?.company.trim() ||
      !detailsDraft.position.trim() ||
      !detailsDraft.appliedAt.trim()
    ) {
      return;
    }
    const updated = await updateApplicationDetails(
      selectedApplication.id,
      detailsDraft,
    );
    if (updated) closeDetailsEditor();
  }

  async function handleLoadMore(
    kind: "emails" | "activities" | "changes",
  ) {
    setLoadingHistory(kind);
    try {
      await loadMoreHistory(selectedApplication.id, kind);
    } finally {
      setLoadingHistory(null);
    }
  }

  return (
    <main id="main-content" className="main-content">
      <section className={styles["detail-heading"]}>
        <div>
          <Link className="back-link" href={returnPath}>
            ← 지원 현황
          </Link>
          <h1>{selectedApplication.company}</h1>
          <p>
            {selectedApplication.position} · {selectedApplication.location} ·{" "}
            {selectedApplication.employmentType}
          </p>
        </div>
        <div className={styles["detail-heading-actions"]}>
          <button
            className={styles["detail-edit-button"]}
            type="button"
            onClick={openDetailsEditor}
          >
            <Pencil aria-hidden="true" />
            <span>기본 정보 편집</span>
          </button>
        </div>
      </section>

      {selectedApplication.needsReview ? (
        <CalloutBanner
          className={styles["review-banner"]}
          title="자동 분류 결과를 확인해 주세요."
          tone="review"
          action={
            <Button
              size="sm"
              onClick={() => markReviewed(selectedApplication.id)}
            >
              확인 완료
            </Button>
          }
        >
          회사와 포지션은 연필 버튼으로 편집하고, 진행 상태까지 점검한 뒤
          확인하세요.
        </CalloutBanner>
      ) : null}

      <section className={styles["progress-summary"]}>
        <div className={styles["progress-summary-heading"]}>
          <h2>현재 진행 요약</h2>
        </div>
        <dl className={styles["summary-definition-list"]}>
          <div>
            <dt>진행 상태</dt>
            <dd>
              <Select
                label="진행 상태"
                wrapperClassName={styles["summary-select"]}
                value={getApplicationProgressStatus(selectedApplication)}
                onChange={(event) =>
                  updateProgressStatus(
                    selectedApplication.id,
                    event.target.value as ApplicationProgressStatus,
                  )
                }
              >
                {PROGRESS_STATUS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </dd>
          </div>
          <div>
            <dt>지원일</dt>
            <dd>{fullDate(selectedApplication.appliedAt)}</dd>
          </div>
          <div>
            <dt>다음 일정</dt>
            <dd className={styles["summary-schedule"]}>
              <span>
                {selectedApplication.nextActionAt
                  ? fullDate(selectedApplication.nextActionAt)
                  : "-"}
              </span>
              {selectedApplication.nextActionTitle ? (
                <small>{selectedApplication.nextActionTitle}</small>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>원문 출처</dt>
            <dd>{selectedApplication.source}</dd>
          </div>
        </dl>
      </section>

      <div className={styles["detail-layout"]}>
        <div className={styles["detail-main"]}>
          <article className="panel">
            <div className="panel-heading">
              <h2>진행 타임라인</h2>
            </div>
            <ol className={styles.timeline}>
              {sortedActivities.map((item, index) => (
                <li key={item.id}>
                  <span
                    className={cn(
                      styles["timeline-mark"],
                      selectedApplication.needsReview &&
                        index === 0 &&
                        styles["is-review"],
                    )}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>{fullDate(item.occurredAt)}</small>
                  </div>
                  <button
                    className={styles["timeline-delete-button"]}
                    type="button"
                    onClick={() =>
                      deleteActivity(selectedApplication.id, item.id)
                    }
                    aria-label={`${item.title} 타임라인 항목 삭제`}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
            {selectedApplication.activityNextCursor != null ? (
              <Button
                size="sm"
                tone="neutral"
                variant="ghost"
                disabled={loadingHistory === "activities"}
                onClick={() => handleLoadMore("activities")}
              >
                {loadingHistory === "activities" ? "불러오는 중" : "이전 활동 더 보기"}
              </Button>
            ) : null}
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>관련 메일</h2>
              <span className="panel-count">
                {selectedApplication.emailTotalCount ?? selectedApplication.emails.length}개
              </span>
            </div>
            <div className={styles["email-list"]}>
              {selectedApplication.emails.map((email) => (
                <button
                  className={styles["email-row"]}
                  type="button"
                  onClick={() => setSelectedEmail(email)}
                  key={email.id}
                >
                  <span className={styles["mail-icon"]} aria-hidden="true">
                    <Mail />
                  </span>
                  <span>
                    <strong>{email.subject}</strong>
                    <small>
                      {email.sender} · {fullDate(email.receivedAt)}
                    </small>
                  </span>
                  <span>메일 내용 보기</span>
                </button>
              ))}
              {selectedApplication.emails.length === 0 ? (
                <div
                  className={cn(
                    "empty-state",
                    "compact-empty",
                  )}
                >
                  <strong>연결된 메일이 없습니다.</strong>
                  <p>직접 추가한 지원 이력은 메일 없이 관리할 수 있습니다.</p>
                </div>
              ) : null}
              {selectedApplication.emailNextCursor != null ? (
                <Button
                  size="sm"
                  tone="neutral"
                  variant="ghost"
                  disabled={loadingHistory === "emails"}
                  onClick={() => handleLoadMore("emails")}
                >
                  {loadingHistory === "emails" ? "불러오는 중" : "이전 메일 더 보기"}
                </Button>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>변경 기록</h2>
              <span className="panel-count">
                {selectedApplication.changeTotalCount ?? sortedChanges.length}개
              </span>
            </div>
            {sortedChanges.length ? (
              <div className={styles["change-history-list"]}>
                {sortedChanges.map((item) => (
                  <div className={styles["change-history-row"]} key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>{fullDateTime(item.occurredAt)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={cn(
                  "empty-state",
                  "compact-empty",
                )}
              >
                <strong>아직 변경 기록이 없습니다.</strong>
                <p>기본 정보, 진행 상태 또는 메모를 수정하면 여기에 남습니다.</p>
              </div>
            )}
            {selectedApplication.changeNextCursor != null ? (
              <Button
                size="sm"
                tone="neutral"
                variant="ghost"
                disabled={loadingHistory === "changes"}
                onClick={() => handleLoadMore("changes")}
              >
                {loadingHistory === "changes" ? "불러오는 중" : "이전 변경 더 보기"}
              </Button>
            ) : null}
          </article>
        </div>

        <aside className={styles["detail-sidebar"]}>
          <article className={cn("panel", styles["memo-card"])}>
            <div className={styles["memo-card-heading"]}>
              <h2>메모</h2>
              <button
                className={styles["memo-add-button"]}
                type="button"
                onClick={addMemoBlock}
                aria-label="메모 추가"
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            {memoBlocks.length ? (
              <div className={styles["memo-list"]}>
                {memoBlocks.map((block, index) => (
                  <details
                    className={styles["memo-item"]}
                    open={openMemoIndex === index}
                    onToggle={(event) => {
                      if (event.currentTarget.open) {
                        setOpenMemoIndex(index);
                      } else if (openMemoIndex === index) {
                        setOpenMemoIndex(null);
                      }
                    }}
                    key={`${selectedApplication.id}-${index}`}
                  >
                    <summary>
                      <span>{memoPreview(block, index)}</span>
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className={styles["memo-editor"]}>
                      <textarea
                        className={styles["memo-textarea"]}
                        aria-label={`메모 ${index + 1} 내용`}
                        placeholder="면접 준비나 회고를 기록하세요."
                        value={block}
                        onChange={(event) =>
                          updateMemoBlocks((blocks) =>
                            blocks.map((item, itemIndex) =>
                              itemIndex === index
                                ? event.target.value
                                : item,
                            ),
                          )
                        }
                      />
                      <button
                        className={styles["memo-delete-button"]}
                        type="button"
                        onClick={() => {
                          updateMemoBlocks((blocks) =>
                            blocks.filter(
                              (_item, itemIndex) => itemIndex !== index,
                            ),
                          );
                          setOpenMemoIndex(null);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className={styles["memo-empty"]}>
                <strong>아직 메모가 없습니다.</strong>
                <p>면접 준비나 회고를 메모로 남겨두세요.</p>
              </div>
            )}
            <div className={styles["memo-actions"]}>
              {saved ? (
                <StatusIndicator tone="success">저장됨</StatusIndicator>
              ) : isMemoDirty ? (
                <StatusIndicator tone="warning">저장 안 됨</StatusIndicator>
              ) : (
                <span />
              )}
              <Button size="sm" onClick={handleMemoSave} disabled={!isMemoDirty}>
                저장
              </Button>
            </div>
          </article>
        </aside>
      </div>

      <Dialog
        title="기본 정보 편집"
        description="회사, 포지션, 근무지와 지원일을 수정하세요."
        closeLabel="기본 정보 편집 창 닫기"
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDetailsEditor();
        }}
      >
        {detailsDraft ? (
          <form
            className="application-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleDetailsSave();
            }}
          >
            <TextField
              label="회사"
              value={detailsDraft.company}
              onChange={(event) =>
                updateDetailsDraft("company", event.target.value)
              }
              required
            />
            <TextField
              label="포지션"
              value={detailsDraft.position}
              onChange={(event) =>
                updateDetailsDraft("position", event.target.value)
              }
              required
            />
            <TextField
              label="근무지"
              value={detailsDraft.location}
              onChange={(event) =>
                updateDetailsDraft("location", event.target.value)
              }
            />
            <TextField
              label="고용 형태"
              value={detailsDraft.employmentType}
              onChange={(event) =>
                updateDetailsDraft("employmentType", event.target.value)
              }
            />
            <TextField
              label="지원일"
              placeholder="YYYY-MM-DD"
              value={detailsDraft.appliedAt}
              onChange={(event) =>
                updateDetailsDraft("appliedAt", event.target.value)
              }
              required
            />
            <DialogActions>
              <Button
                type="button"
                tone="neutral"
                variant="ghost"
                onClick={closeDetailsEditor}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={
                  !detailsDraft.company.trim() ||
                  !detailsDraft.position.trim() ||
                  !detailsDraft.appliedAt.trim()
                }
              >
                변경사항 저장
              </Button>
            </DialogActions>
          </form>
        ) : null}
      </Dialog>

      <Dialog
        title={selectedEmail?.subject ?? "관련 메일"}
        description={selectedEmail?.sender}
        closeLabel="관련 메일 창 닫기"
        open={Boolean(selectedEmail)}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null);
        }}
      >
        <div className={styles["mail-preview"]}>
          <p>{selectedEmail?.summary}</p>
          <small>{fullDate(selectedEmail?.receivedAt ?? null)}</small>
        </div>
        <DialogActions>
          <Button
            tone="neutral"
            variant="outline"
            onClick={() => setSelectedEmail(null)}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </main>
  );
}
