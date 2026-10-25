import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import fieldStyles from "../../shared/ui/Field/Field.module.css";
import { Alert, Button, ComicHeading, Field, Halftone, Kicker, PageShell } from "../../shared/ui";
import { PasswordInput } from "./PasswordInput";
import { registerRequest, type RegisterOutcome } from "./api";
import { PASSWORD_MIN, registerSchema, type RegisterFormValues } from "./schema";
import styles from "./auth.module.css";

interface FailureView {
  tone: "error" | "warning";
  title: string;
  text: string;
}

function failureView(outcome: Extract<RegisterOutcome, { ok: false }>): FailureView {
  switch (outcome.kind) {
    case "email_exists":
      return { tone: "error", title: "E-mail занят", text: outcome.message };
    case "intake_disabled":
      return { tone: "warning", title: "Регистрация закрыта", text: outcome.message };
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
    case "validation":
      return { tone: "error", title: "Не удалось отправить", text: outcome.message };
  }
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<FailureView | null>(null);
  const [intakeClosed, setIntakeClosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setError, formState } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", first_name: "", last_name: "", position: "", password: "", password_confirm: "" },
  });

  const onValid = async (values: RegisterFormValues) => {
    setFailure(null);
    setSubmitting(true);
    const outcome = await registerRequest({
      email: values.email,
      first_name: values.first_name,
      last_name: values.last_name,
      position: values.position,
      password: values.password,
    });
    setSubmitting(false);
    if (outcome.ok) {
      navigate("/registration-pending", { replace: true });
      return;
    }
    if (outcome.kind === "intake_disabled") {
      setIntakeClosed(true);
      return;
    }
    if (outcome.kind === "validation") {
      for (const [field, message] of Object.entries(outcome.fieldErrors)) {
        if (["email", "first_name", "last_name", "position", "password"].includes(field)) {
          setError(field as keyof RegisterFormValues, { message });
        }
      }
      if (Object.keys(outcome.fieldErrors).length > 0) {
        setFailure({ tone: "error", title: "Проверьте поля формы", text: outcome.message });
        return;
      }
    }
    setFailure(failureView(outcome));
  };

  return (
    <PageShell variant="public">
      <div className={styles.hero}>
        <Halftone />
        <Kicker>Кабинет сотрудника</Kicker>
        <div className={styles.heroHeading}>
          <ComicHeading level={1} accent="Регистрация">
            в кабинете
          </ComicHeading>
        </div>
        <p className={styles.sub}>
          Учётная запись сотрудника. После регистрации администратор подтвердит доступ.
        </p>
      </div>

      {intakeClosed ? (
        <div className={styles.closedCard}>
          <Alert tone="info" title="Регистрация временно закрыта">
            Приём новых учётных записей приостановлен. Обратитесь к администратору системы.
          </Alert>
        </div>
      ) : (
        <form className={styles.formCard} noValidate onSubmit={handleSubmit(onValid)}>
          {failure !== null ? (
            <div className={styles.notice}>
              <Alert tone={failure.tone} title={failure.title}>
                {failure.text}
              </Alert>
            </div>
          ) : null}

          <Field label="Фамилия" required error={formState.errors.last_name?.message}>
            <input autoComplete="family-name" className={fieldStyles.control} {...register("last_name")} />
          </Field>
          <Field label="Имя" required error={formState.errors.first_name?.message}>
            <input autoComplete="given-name" className={fieldStyles.control} {...register("first_name")} />
          </Field>
          <Field label="Должность" required error={formState.errors.position?.message}>
            <input autoComplete="organization-title" className={fieldStyles.control} {...register("position")} />
          </Field>
          <Field label="E-mail" required error={formState.errors.email?.message}>
            <input type="email" autoComplete="email" className={fieldStyles.control} {...register("email")} />
          </Field>
          <Field
            label="Пароль"
            required
            hint={`Минимум ${PASSWORD_MIN} символов`}
            error={formState.errors.password?.message}
          >
            <PasswordInput autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label="Повторите пароль" required error={formState.errors.password_confirm?.message}>
            <PasswordInput autoComplete="new-password" {...register("password_confirm")} />
          </Field>

          <div className={styles.actions}>
            <Button type="submit" block disabled={submitting}>
              {submitting ? "Отправляем…" : "Зарегистрироваться"}
            </Button>
          </div>

          <div className={styles.links}>
            <Link className={styles.link} to="/login">
              Уже есть аккаунт — войти
            </Link>
          </div>
        </form>
      )}
    </PageShell>
  );
}
