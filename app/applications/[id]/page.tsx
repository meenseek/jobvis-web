"use client";

import {
  Button,
  Dialog,
  DialogActions,
  Select,
  StatusIndicator,
  TextField,
  Textarea,
} from "@measure-twice/react";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeApplicationListPath } from "../../application-navigation";
import { useApplications } from "../../application-provider";
import type { ApplicationDetailsInput } from "../../application-state";
import {
  ApplicationEmail,
  ApplicationStatus,
  compareOccurredAtDesc,
  fullDate,
  fullDateTime,
  stageLabel,
  stageTone,
  statusValue,
  STATUS_OPTIONS,
} from "../../data";

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const {
    applications,
    markReviewed,
    saveMemo,
    updateApplicationDetails,
    updateStatus,
  } = useApplications();
  const application = applications.find((item) => item.id === params.id);
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDraft, setDetailsDraft] =
    useState<ApplicationDetailsInput | null>(null);
  const [selectedEmail, setSelectedEmail] =
    useState<ApplicationEmail | null>(null);
  const requestedReturnPath = searchParams.get("from");
  const returnPath = safeApplicationListPath(requestedReturnPath);

  if (!application) {
    return (
      <main id="main-content" className="main-content">
        <section className="panel not-found-panel">
          <h1>지원 이력을 찾을 수 없습니다.</h1>
          <p>삭제되었거나 올바르지 않은 주소입니다.</p>
          <Link className="detail-link" href={returnPath}>
            지원 현황으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const memo = memoDrafts[application.id] ?? application.memo;
  const sortedActivities = [...application.activities].sort(
    compareOccurredAtDesc,
  );
  const sortedChanges = [...(application.changes ?? [])].sort(
    compareOccurredAtDesc,
  );

  function handleMemoSave() {
    if (!application) return;
    saveMemo(application.id, memo.trim());
    setSaved(true);
  }

  function openDetailsEditor() {
    setDetailsDraft({
      company: application.company,
      position: application.position,
      location: application.location,
      employmentType: application.employmentType,
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

  function handleDetailsSave() {
    if (!detailsDraft?.company.trim() || !detailsDraft.position.trim()) return;
    updateApplicationDetails(application.id, detailsDraft);
    closeDetailsEditor();
  }

  return (
    <main id="main-content" className="main-content">
      <section className="detail-heading">
        <div>
          <Link className="back-link" href={returnPath}>
            ← 지원 현황
          </Link>
          <h1>{application.company}</h1>
          <p>
            {application.position} · {application.location} ·{" "}
            {application.employmentType}
          </p>
        </div>
        <div className="detail-heading-actions">
          <button
            className="detail-edit-button"
            type="button"
            onClick={openDetailsEditor}
          >
            <Pencil aria-hidden="true" />
            <span>기본 정보 편집</span>
          </button>
          <StatusIndicator tone={stageTone(application)}>
            {application.needsReview ? "확인 필요" : stageLabel(application)}
          </StatusIndicator>
        </div>
      </section>

      {application.needsReview ? (
        <section className="review-banner">
          <div>
            <strong>자동 분류 결과를 확인해 주세요.</strong>
            <p>
              회사와 포지션은 연필 버튼으로 편집하고, 진행 상태까지 점검한 뒤
              확인하세요.
            </p>
          </div>
          <Button
            size="sm"
            tone="neutral"
            variant="outline"
            onClick={() => markReviewed(application.id)}
          >
            확인 완료
          </Button>
        </section>
      ) : null}

      <section className="detail-layout">
        <div className="detail-main">
          <article className="panel">
            <div className="panel-heading">
              <h2>지원 이력</h2>
            </div>
            <ol className="timeline">
              {sortedActivities.map((item) => (
                <li key={item.id}>
                  <span className="timeline-mark" aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>{fullDate(item.occurredAt)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>관련 메일</h2>
              <span className="panel-count">{application.emails.length}개</span>
            </div>
            <div className="email-list">
              {application.emails.map((email) => (
                <button
                  className="email-row"
                  type="button"
                  onClick={() => setSelectedEmail(email)}
                  key={email.id}
                >
                  <span className="mail-icon" aria-hidden="true">
                    @
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
              {application.emails.length === 0 ? (
                <div className="empty-state compact-empty">
                  <strong>연결된 메일이 없습니다.</strong>
                  <p>직접 추가한 지원 이력은 메일 없이 관리할 수 있습니다.</p>
                </div>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>변경 기록</h2>
                <p className="section-description">
                  변경 항목과 수정 전·후 값을 확인할 수 있습니다.
                </p>
              </div>
              <span className="panel-count">{sortedChanges.length}개</span>
            </div>
            {sortedChanges.length ? (
              <div className="change-history-list">
                {sortedChanges.map((item) => (
                  <div className="change-history-row" key={item.id}>
                    <span className="change-history-mark" aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <small>{fullDateTime(item.occurredAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <strong>아직 변경 기록이 없습니다.</strong>
                <p>기본 정보, 진행 상태 또는 메모를 수정하면 여기에 남습니다.</p>
              </div>
            )}
          </article>
        </div>

        <aside className="detail-sidebar">
          <article className="panel detail-control-card">
            <h2>진행 상태</h2>
            <Select
              label="진행 상태 변경"
              value={statusValue(application)}
              onChange={(event) =>
                updateStatus(
                  application.id,
                  event.target.value as ApplicationStatus,
                )
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <dl className="detail-definition-list">
              <div>
                <dt>지원일</dt>
                <dd>{fullDate(application.appliedAt)}</dd>
              </div>
              <div>
                <dt>다음 행동</dt>
                <dd>{application.nextAction}</dd>
              </div>
              <div>
                <dt>예정일</dt>
                <dd>{fullDate(application.nextActionAt)}</dd>
              </div>
              <div>
                <dt>원문 출처</dt>
                <dd>{application.source}</dd>
              </div>
            </dl>
          </article>

          <article className="panel memo-card">
            <h2>메모</h2>
            <Textarea
              label="지원 메모"
              placeholder="면접 준비나 회고를 기록하세요."
              value={memo}
              onChange={(event) => {
                setMemoDrafts((current) => ({
                  ...current,
                  [application.id]: event.target.value,
                }));
                setSaved(false);
              }}
            />
            <div className="memo-actions">
              {saved ? (
                <StatusIndicator tone="success">저장됨</StatusIndicator>
              ) : (
                <span />
              )}
              <Button size="sm" onClick={handleMemoSave}>
                메모 저장
              </Button>
            </div>
          </article>
        </aside>
      </section>

      <Dialog
        title="지원 정보 편집"
        description="자동으로 정리된 기본 정보가 정확하지 않다면 수정하세요."
        closeLabel="지원 정보 편집 창 닫기"
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
                  !detailsDraft.position.trim()
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
        <div className="mail-preview">
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
