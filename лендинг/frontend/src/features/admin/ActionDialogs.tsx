import { useEffect, useState } from "react";
import { Alert, Button, Dialog } from "../../shared/ui";
import { generateTempPassword } from "./tempPassword";
import { AdminApiError } from "./types";
import styles from "./dialogs.module.css";

export interface ConfirmDraft {
  title: string;
  body: string;
  warning?: string;
  confirmLabel: string;
  run: () => Promise<unknown>;
}

export function ConfirmDialog({
  draft,
  onClose,
  onDone,
}: {
  draft: ConfirmDraft | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (draft === null) {
    return null;
  }

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await draft.run();
      onDone();
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Не удалось выполнить операцию",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (!pending) {
          onClose();
        }
      }}
      title={draft.title}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button size="sm" variant="primary" onClick={() => void confirm()} disabled={pending}>
            {pending ? "Выполняем…" : draft.confirmLabel}
          </Button>
        </>
      }
    >
      <p>{draft.body}</p>
      {draft.warning !== undefined ? (
        <Alert tone="warning" title="Внимание">
          {draft.warning}
        </Alert>
      ) : null}
      {error !== null ? (
        <Alert tone="error" title="Операция не выполнена">
          {error}
        </Alert>
      ) : null}
    </Dialog>
  );
}

const COPY_LABEL = "Скопировать пароль";

export function ResetPasswordDialog({
  targetName,
  open,
  onClose,
  onSubmit,
}: {
  targetName: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword(generateTempPassword());
      setIssued(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const reset = () => {
    setPassword("");
    setPending(false);
    setIssued(null);
    setError(null);
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const generate = () => {
    setPassword(generateTempPassword());
    setError(null);
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await onSubmit(password);
      setIssued(password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить пароль");
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (issued === null) {
      return;
    }
    await navigator.clipboard.writeText(issued);
    setCopied(true);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) {
          close();
        }
      }}
      title="Временный пароль"
      footer={
        issued === null ? (
          <>
            <Button size="sm" variant="secondary" onClick={close} disabled={pending}>
              Отмена
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void submit()}
              disabled={pending || password.trim().length < 12}
            >
              {pending ? "Сохраняем…" : "Выдать пароль"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onClick={close}>
            Готово
          </Button>
        )
      }
    >
      {issued === null ? (
        <>
          <p>
            Задайте временный пароль для {targetName}. При сохранении все текущие сеансы сотрудника
            будут завершены, при следующем входе система попросит сменить пароль.
          </p>
          <div className={styles.passwordRow}>
            <label className={styles.passwordLabel} htmlFor="temp-password">
              Пароль
            </label>
            <input
              id="temp-password"
              className={styles.passwordInput}
              type="text"
              value={password}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={generate} disabled={pending}>
              Сгенерировать
            </Button>
          </div>
          <p className={styles.passwordHint}>Минимум 12 символов. Пароль показывается один раз.</p>
          {error !== null ? (
            <Alert tone="error" title="Пароль не сохранён">
              {error}
            </Alert>
          ) : null}
        </>
      ) : (
        <>
          <Alert tone="success" title="Пароль установлен">
            Передайте пароль сотруднику надёжным способом — повторно он показан не будет.
          </Alert>
          <div className={styles.issuedRow}>
            <output className={styles.issued} aria-live="polite">
              {issued}
            </output>
            <Button size="sm" variant="secondary" onClick={() => void copy()} aria-label={COPY_LABEL}>
              {copied ? "Скопировано" : "Копировать"}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
