import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import fieldStyles from "../../shared/ui/Field/Field.module.css";
import { Alert, Button, ComicHeading, Field, Halftone, Kicker, PageShell } from "../../shared/ui";
import { useAuth } from "./AuthContext";
import { PasswordInput } from "./PasswordInput";
import { loginSchema, type LoginFormValues } from "./schema";
import type { LoginOutcome } from "./api";
import styles from "./auth.module.css";

const AUTH_PATHS = new Set(["/login", "/register", "/registration-pending", "/change-password"]);

/** returnTo принимает только внутренние пути вне auth-экранов (защита от open-redirect). */
function safeReturnTo(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/candidates";
  }
  const path = raw.split("?")[0] ?? raw;
  return AUTH_PATHS.has(path) ? "/candidates" : raw;
}

interface FailureView {
  tone: "error" | "warning";
  title: string;
  text: string;
}

function failureView(outcome: Extract<LoginOutcome, { ok: false }>): FailureView | null {
  switch (outcome.kind) {
    case "invalid_credentials":
      return { tone: "error", title: "Не удалось войти", text: "Неверная e-mail или пароль" };
    case "account_state":
      if (outcome.state === "ACCOUNT_PENDING") return null;
      return {
        tone: "warning",
        title: "Вход недоступен",
        text: "Доступ приостановлен, свяжитесь с администратором",
      };
    case "rate_limited":
      return {
        tone: "warning",
        title: "Слишком много попыток",
        text:
          outcome.retryAfterSeconds !== null
            ? `Подождите примерно ${outcome.retryAfterSeconds} с и попробуйте снова`
            : "Подождите немного и попробуйте снова",
      };
    case "network":
      return { tone: "error", title: "Нет связи с сервером", text: "Проверьте подключение и попробуйте ещё раз" };
    case "http_error":
      return { tone: "error", title: "Не удалось войти", text: outcome.message };
  }
}

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [failure, setFailure] = useState<FailureView | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const passwordChanged = (location.state as { passwordChanged?: boolean } | null)?.passwordChanged === true;

  const { register, handleSubmit, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!isLoading && user !== null && user.state === "active" && !user.must_change_password) {
    return <Navigate to={returnTo} replace />;
  }

  const onValid = async (values: LoginFormValues) => {
    setFailure(null);
    setSubmitting(true);
    const outcome = await login(values.email, values.password);
    setSubmitting(false);
    if (outcome.ok) {
      const target = outcome.employee.must_change_password ? "/change-password" : returnTo;
      navigate(target, { replace: true });
      return;
    }
    if (outcome.kind === "account_state" && outcome.state === "ACCOUNT_PENDING") {
      navigate("/registration-pending", { replace: true });
      return;
    }
    setFailure(failureView(outcome));
  };

  return (
    <PageShell variant="public">
      <div className={styles.hero}>
        <Halftone />
        <Kicker>Кабинет сотрудника</Kicker>
        <div className={styles.heroHeading}>
          <ComicHeading level={1} accent="Вход">
            для команды
          </ComicHeading>
        </div>
        <p className={styles.sub}>Реестр кандидатов «Очаково» — для сотрудников отдела персонала.</p>
      </div>

      <form className={styles.formCard} noValidate onSubmit={handleSubmit(onValid)}>
        {passwordChanged ? (
          <div className={styles.notice}>
            <Alert tone="success" title="Пароль изменён">
              Войдите с новым паролем.
            </Alert>
          </div>
        ) : null}
        {failure !== null ? (
          <div className={styles.notice}>
            <Alert tone={failure.tone} title={failure.title}>
              {failure.text}
            </Alert>
          </div>
        ) : null}

        <Field label="E-mail" required error={formState.errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            className={fieldStyles.control}
            {...register("email")}
          />
        </Field>
        <Field label="Пароль" required error={formState.errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>

        <div className={styles.actions}>
          <Button type="submit" block disabled={submitting}>
            {submitting ? "Входим…" : "Войти"}
          </Button>
        </div>

        <div className={styles.links}>
          <Link className={styles.link} to="/register">
            Регистрация
          </Link>
          <Link className={styles.link} to="/">
            На главную
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
