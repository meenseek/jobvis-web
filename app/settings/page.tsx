"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  StatusIndicator,
} from "@measure-twice/react";
import { useState } from "react";
import { useAccountSettings } from "../account-settings-provider";
import {
  formatMailSyncTime,
  loginProviderLabel,
} from "../settings-state";

export default function SettingsPage() {
  const {
    connectGmail,
    disconnectMail,
    loginEmail,
    loginProvider,
    mailConnection,
    syncGmail,
  } = useAccountSettings();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const loginProviderName = loginProviderLabel(loginProvider);
  const lastMailSyncTime = mailConnection
    ? formatMailSyncTime(mailConnection.lastSyncedAt)
    : null;

  function closeConnectDialog() {
    setConnectDialogOpen(false);
    setConsentChecked(false);
  }

  function confirmConnection() {
    if (!consentChecked) return;
    connectGmail();
    closeConnectDialog();
  }

  function confirmDisconnection() {
    disconnectMail();
    setDisconnectDialogOpen(false);
  }

  return (
    <main id="main-content" className="main-content">
      <section className="page-heading">
        <div>
          <h1>설정</h1>
          <p>로그인 계정과 채용 메일 연결을 각각 관리하세요.</p>
        </div>
      </section>

      <section
        className={
          mailConnection
            ? "settings-callout is-connected"
            : "settings-callout"
        }
        aria-labelledby="mail-connection-callout-title"
      >
        <span className="settings-callout-mark" aria-hidden="true">
          {mailConnection ? "✓" : "@"}
        </span>
        <div className="settings-callout-copy">
          <StatusIndicator tone={mailConnection ? "success" : "warning"}>
            {mailConnection ? "연결됨" : "연결 필요"}
          </StatusIndicator>
          <h2 id="mail-connection-callout-title">
            {mailConnection
              ? "채용 메일을 자동으로 정리하고 있어요"
              : "채용 메일도 연결할까요?"}
          </h2>
          <p>
            {mailConnection
              ? "새 채용 메일을 지원 이력과 연결하고 진행 상태와 일정을 갱신합니다."
              : `${loginProviderName} 로그인과 채용 메일 읽기 권한은 별도예요. 동의한 뒤에만 채용 관련 메일을 가져옵니다.`}
          </p>
        </div>
        <div className="settings-callout-actions">
          {mailConnection ? (
            <Button tone="neutral" variant="outline" onClick={syncGmail}>
              지금 동기화
            </Button>
          ) : (
            <Button onClick={() => setConnectDialogOpen(true)}>
              Gmail 연결
            </Button>
          )}
        </div>
      </section>

      <section className="settings-grid" aria-label="계정 및 연결 설정">
        <article className="panel settings-card">
          <div className="panel-heading">
            <h2>로그인 계정</h2>
            <StatusIndicator tone="success">로그인 중</StatusIndicator>
          </div>
          <div className="settings-account-row">
            <span className="settings-provider-mark" aria-hidden="true">
              {loginProvider === "google" ? "G" : "K"}
            </span>
            <span>
              <strong>{loginProviderName}로 로그인 중</strong>
              <small>{loginEmail}</small>
            </span>
          </div>
          <p className="settings-card-note">
            로그인 계정은 본인 확인과 Jobvis 데이터 저장에 사용합니다.
            Google 또는 Kakao로 로그인해도 채용 메일은 자동으로 연결되지
            않습니다.
          </p>
        </article>

        <article className="panel settings-card">
          <div className="panel-heading">
            <h2>채용 메일 연결</h2>
            <StatusIndicator tone={mailConnection ? "success" : "neutral"}>
              {mailConnection ? "Gmail 연결됨" : "연결 안 됨"}
            </StatusIndicator>
          </div>
          <div className="settings-connection-body">
            {mailConnection ? (
              <div className="settings-account-row">
                <span className="settings-provider-mark" aria-hidden="true">
                  @
                </span>
                <span>
                  <strong>Gmail 연결됨</strong>
                  <small>
                    {mailConnection.email} · 마지막 동기화 {lastMailSyncTime}
                  </small>
                </span>
              </div>
            ) : (
              <div className="settings-empty-connection">
                <strong>연결된 채용 메일이 없습니다.</strong>
                <p>연결하면 새 지원 메일을 자동으로 정리할 수 있어요.</p>
              </div>
            )}

            <ul className="settings-permission-list">
              <li>채용 관련 발신자·제목·본문 요약만 지원 이력에 사용</li>
              <li>회사·포지션·진행 상태·일정을 찾아 확인 대상으로 표시</li>
              <li>관련 없는 개인 메일은 지원 이력으로 만들지 않음</li>
            </ul>

            {mailConnection ? (
              <div className="settings-card-actions">
                <Button
                  size="sm"
                  tone="danger"
                  variant="ghost"
                  onClick={() => setDisconnectDialogOpen(true)}
                >
                  연결 해제
                </Button>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <Dialog
        title="Gmail을 연결할까요?"
        description="로그인 계정과 별도로 채용 메일 읽기 권한에 동의합니다."
        closeLabel="Gmail 연결 창 닫기"
        open={connectDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeConnectDialog();
        }}
      >
        <div className="settings-dialog-copy">
          <p>
            Jobvis는 채용 관련 메일을 찾아 지원 이력, 진행 상태와 일정으로
            정리합니다. 연결은 언제든 설정에서 해제할 수 있습니다.
          </p>
          <Checkbox
            label="채용 메일 연결 안내를 확인했어요"
            description="Gmail 연결 화면에서 선택한 권한만 사용합니다."
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
          />
        </div>
        <DialogActions>
          <Button tone="neutral" variant="ghost" onClick={closeConnectDialog}>
            취소
          </Button>
          <Button disabled={!consentChecked} onClick={confirmConnection}>
            동의하고 연결
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        title="채용 메일 연결을 해제할까요?"
        description="기존 지원 이력은 유지되고 새 메일 동기화만 중지됩니다."
        closeLabel="채용 메일 연결 해제 창 닫기"
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <div className="settings-dialog-copy">
          <p>
            연결을 해제해도 이미 정리한 지원 이력, 메모와 일정은 삭제되지
            않습니다.
          </p>
        </div>
        <DialogActions>
          <Button
            tone="neutral"
            variant="ghost"
            onClick={() => setDisconnectDialogOpen(false)}
          >
            취소
          </Button>
          <Button tone="danger" onClick={confirmDisconnection}>
            연결 해제
          </Button>
        </DialogActions>
      </Dialog>
    </main>
  );
}
