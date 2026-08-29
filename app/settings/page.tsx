"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  StatusIndicator,
  TextField,
} from "@measure-twice/react";
import { useEffect, useState } from "react";
import { useAccountSettings } from "@/src/settings/account-settings-provider";
import {
  formatMailSyncTime,
  mailProviderLabel,
  MailProvider,
} from "@/src/settings/settings-state";
import { cn } from "@/src/ui/class-names";
import styles from "@/src/settings/settings.module.scss";

function inferMailProvider(email: string): MailProvider | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedEmail.endsWith("@gmail.com") ||
    normalizedEmail.endsWith("@googlemail.com")
  ) {
    return "gmail";
  }
  if (normalizedEmail.endsWith("@naver.com")) return "naver";
  return null;
}

export default function SettingsPage() {
  const {
    autoSyncEnabled,
    connectMail,
    disconnectMail,
    mailConnection,
    setAutoSyncEnabled,
    syncMail,
  } = useAccountSettings();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [mailAddress, setMailAddress] = useState("");
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const lastMailSyncTime = mailConnection
    ? formatMailSyncTime(mailConnection.lastSyncedAt)
    : null;
  const connectedMailProviderName = mailConnection
    ? mailProviderLabel(mailConnection.provider)
    : null;
  const inferredMailProvider = inferMailProvider(mailAddress);
  const inferredMailProviderName = inferredMailProvider
    ? mailProviderLabel(inferredMailProvider)
    : null;
  const trimmedMailAddress = mailAddress.trim();
  const mailProviderMessage = trimmedMailAddress
    ? inferredMailProviderName
      ? `${inferredMailProviderName} 메일로 연결을 진행합니다.`
      : "현재 Gmail과 Naver 메일만 지원합니다."
    : "현재 Gmail과 Naver 메일만 지원합니다.";
  const canConfirmConnection = Boolean(inferredMailProvider) && consentChecked;

  useEffect(() => {
    if (mailConnection) return;

    const frame = requestAnimationFrame(() => {
      const connect = new URLSearchParams(window.location.search).get(
        "connect",
      );
      if (connect) {
        setConnectDialogOpen(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mailConnection]);

  function closeConnectDialog() {
    setConnectDialogOpen(false);
    setConsentChecked(false);
    setMailAddress("");
  }

  function openConnectDialog() {
    setConnectDialogOpen(true);
  }

  function confirmConnection() {
    if (!canConfirmConnection || !inferredMailProvider) return;
    connectMail(inferredMailProvider, trimmedMailAddress);
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
          <p>채용 메일 연결과 권한 사용 범위를 관리하세요.</p>
        </div>
      </section>

      <section
        className={
          mailConnection
            ? cn(styles["settings-callout"], styles["is-connected"])
            : styles["settings-callout"]
        }
        aria-labelledby="mail-connection-callout-title"
      >
        <span className={styles["settings-callout-mark"]} aria-hidden="true">
          {mailConnection ? "✓" : "@"}
        </span>
        <div className={styles["settings-callout-copy"]}>
          <StatusIndicator tone={mailConnection ? "success" : "warning"}>
            {mailConnection ? "연결됨" : "연결 필요"}
          </StatusIndicator>
          <h2 id="mail-connection-callout-title">
            {mailConnection
              ? "채용 메일을 자동으로 정리하고 있어요"
              : "채용 메일을 연결할까요?"}
          </h2>
          <p>
            {mailConnection
              ? "새 채용 메일을 지원 이력과 연결하고 진행 상태와 일정을 갱신합니다."
              : "채용 메일 읽기 권한은 동의한 뒤에만 사용합니다. Jobvis는 채용 관련 메일만 가져와 지원 이력으로 정리합니다."}
          </p>
        </div>
        {!mailConnection ? (
          <div className={styles["settings-callout-actions"]}>
            <Button onClick={openConnectDialog}>채용 메일 연결하기</Button>
          </div>
        ) : null}
      </section>

      <section
        className={styles["settings-list"]}
        aria-label="채용 메일 연결 설정"
      >
        <article className={styles["settings-row"]}>
          <div className={styles["settings-row-main"]}>
            <span className={styles["settings-provider-mark"]} aria-hidden="true">
              @
            </span>
            <div className={styles["settings-row-copy"]}>
              <div className={styles["settings-row-heading"]}>
                <h2>채용 메일 연결</h2>
                <StatusIndicator tone={mailConnection ? "success" : "neutral"}>
                  {mailConnection
                    ? `${connectedMailProviderName} 연결됨`
                    : "연결 안 됨"}
                </StatusIndicator>
              </div>
              {mailConnection ? (
                <>
                  <p>{connectedMailProviderName} 메일을 확인하고 있어요.</p>
                  <small>
                    {mailConnection.email} · 마지막 동기화 {lastMailSyncTime}
                  </small>
                </>
              ) : (
                <>
                  <p>연결된 채용 메일이 없습니다.</p>
                  <small>Gmail과 Naver 메일을 지원합니다.</small>
                </>
              )}
            </div>
          </div>
          <div className={styles["settings-row-actions"]}>
            {mailConnection ? (
              <Button
                size="sm"
                tone="danger"
                variant="ghost"
                onClick={() => setDisconnectDialogOpen(true)}
              >
                연결 해제
              </Button>
            ) : (
              <Button size="sm" onClick={openConnectDialog}>
                연결하기
              </Button>
            )}
          </div>
        </article>

        <article className={styles["settings-row"]}>
          <div className={styles["settings-row-main"]}>
            <span className={styles["settings-provider-mark"]} aria-hidden="true">
              ↻
            </span>
            <div className={styles["settings-row-copy"]}>
              <div className={styles["settings-row-heading"]}>
                <h2>메일 동기화</h2>
                <StatusIndicator
                  tone={
                    !mailConnection
                      ? "neutral"
                      : autoSyncEnabled
                        ? "success"
                        : "warning"
                  }
                >
                  {!mailConnection
                    ? "연결 필요"
                    : autoSyncEnabled
                      ? "자동 동기화"
                      : "수동 동기화"}
                </StatusIndicator>
              </div>
              {mailConnection ? (
                <>
                  <p>
                    {autoSyncEnabled
                      ? "새 채용 메일을 주기적으로 확인합니다."
                      : "자동 확인은 멈추고 필요할 때만 직접 동기화합니다."}
                  </p>
                  <small>마지막 동기화 {lastMailSyncTime}</small>
                </>
              ) : (
                <>
                  <p>메일을 연결하면 동기화 방식을 선택할 수 있습니다.</p>
                  <small>연결 전에는 동기화를 실행하지 않습니다.</small>
                </>
              )}
            </div>
          </div>
          <div
            className={cn(
              styles["settings-row-actions"],
              styles["settings-row-actions-sync"],
            )}
          >
            <Checkbox
              label="자동 동기화"
              checked={autoSyncEnabled}
              disabled={!mailConnection}
              wrapperClassName={styles["settings-sync-checkbox"]}
              onChange={(event) => setAutoSyncEnabled(event.target.checked)}
            />
            <Button
              size="sm"
              tone="neutral"
              variant="outline"
              disabled={!mailConnection}
              onClick={syncMail}
            >
              수동 동기화
            </Button>
          </div>
        </article>

        <div className={styles["settings-permission-summary"]}>
          <strong>메일 권한 사용 범위</strong>
          <ul className={styles["settings-permission-list"]}>
            <li>채용 관련 발신자·제목·본문 요약만 지원 이력에 사용</li>
            <li>회사·포지션·진행 상태·일정을 찾아 확인 대상으로 표시</li>
            <li>관련 없는 개인 메일은 지원 이력으로 만들지 않음</li>
          </ul>
        </div>
      </section>

      <Dialog
        title="채용 메일을 연결할까요?"
        description="채용 메일 읽기 권한에 동의합니다."
        closeLabel="채용 메일 연결 창 닫기"
        open={connectDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeConnectDialog();
        }}
      >
        <div className={styles["settings-dialog-copy"]}>
          <p>
            Jobvis는 채용 관련 메일을 찾아 지원 이력, 진행 상태와 일정으로
            정리합니다. 연결은 언제든 설정에서 해제할 수 있습니다.
          </p>
          <TextField
            label="채용 메일 주소"
            type="email"
            placeholder="career@gmail.com"
            value={mailAddress}
            onChange={(event) => setMailAddress(event.target.value)}
          />
          <p
            className={
              trimmedMailAddress && !inferredMailProvider
                ? cn(
                    styles["settings-dialog-hint"],
                    styles["is-error"],
                  )
                : styles["settings-dialog-hint"]
            }
          >
            {mailProviderMessage}
          </p>
          <Checkbox
            label="채용 메일 연결 안내를 확인했어요"
            description={
              inferredMailProvider === "gmail"
                ? "Google 연결 화면에서 선택한 Gmail 읽기 권한만 사용합니다."
                : inferredMailProvider === "naver"
                  ? "Naver 앱 비밀번호는 암호화해 저장하고 메일 읽기에만 사용합니다."
                  : "지원 가능한 메일 주소를 입력한 뒤 연결할 수 있습니다."
            }
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
          />
        </div>
        <DialogActions>
          <Button tone="neutral" variant="ghost" onClick={closeConnectDialog}>
            취소
          </Button>
          <Button disabled={!canConfirmConnection} onClick={confirmConnection}>
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
        <div className={styles["settings-dialog-copy"]}>
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
