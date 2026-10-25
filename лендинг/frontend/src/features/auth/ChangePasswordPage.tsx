import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Alert, Button, ComicHeading, Field, Halftone, Kicker, PageShell } from "../../shared/ui";
import { useAuth } from "./AuthContext";
import { PasswordInput } from "./PasswordInput";
import { changePasswordRequest, clearCsrfToken } from "./api";
import { PASSWORD_MIN, changePasswordSchema, type ChangePasswordFormValues } from "./schema";
import styles from "./auth.module.css";

/*
 * После 204 сервер отзывает ВСЕ сессии (T3 контракт: «потребовать новый login»),
 * поэтому refreshMe() вернёт null и уводим на /login с пометкой passwordChanged;
 * если бэкенд когда-либо сохранит сессию — идём в /candidates.
 */
export function ChangePasswordPage() {
  const { user, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: "", new_password: "", new_password_confirm: "" },
  });

  const onValid = async (values: ChangePasswordFormValues) => {
    setFailure(null);
    setSubmitting(true);
    const outcome = await changePasswordRequest(values.current_password, values.new_password);
    setSubmitting(false);
    if (outcome.ok) {
      clearCsrfToken();
      await queryClient.clear();
      const me = await refreshMe();
      if (me !== null && !me.must_change_password) {
        navigate("/candidates", { replace: true });
      } else {
        navigate("/login", { replace: true, state: { passwordChanged: true } });
      }
      return;
    }
    switch (outcome.kind) {
      case "invalid_credentials":
        setFailure("Неверный текущий пароль");
        break;
      case "rate_limited":
        setFailure(
          outcome.retryAfterSeconds !== null
            ? `Слишком много попыток. Подождите примерно ${outcome.retryAfterSeconds} с`
            : "Слишком много попыток. Подождите немного",
        );
        break;
      case "network":
        setFailure("Нет связи с сервером. Попробуйте ещё раз");
        break;
      case "http_error":
        setFailure(outcome.message);
        break;
    }
  };

  return (
    <PageShell variant="public">
      <div className={styles.hero}>
        <Halftone />
        <Kicker>Безопасность</Kicker>
        <div className={styles.heroHeading}>
          <ComicHeading level={1} accent="Смена">
            пароля
          </ComicHeading>
        </div>
        {user !== null ? (
          <p className={styles.greeting}>
            {user.last_name} {user.first_name}, {user.position}
          </p>
        ) : null}
      </div>

      <form className={styles.formCard} noValidate onSubmit={handleSubmit(onValid)}>
        {user?.must_change_password ? (
          <div className={styles.notice}>
            <Alert tone="warning" title="Сначала задайте новый пароль">
              Администратор выдал временный пароль. Придумайте собственный — до этого кабинет
              недоступен.
            </Alert>
          </div>
        ) : null}
        {failure !== null ? (
          <div className={styles.notice}>
            <Alert tone="error" title="Не удалось сменить пароль">
              {failure}
            </Alert>
          </div>
        ) : null}

        <Field label="Текущий пароль" required error={formState.errors.current_password?.message}>
          <PasswordInput autoComplete="current-password" {...register("current_password")} />
        </Field>
        <Field
          label="Новый пароль"
          required
          hint={`Минимум ${PASSWORD_MIN} символов`}
          error={formState.errors.new_password?.message}
        >
          <PasswordInput autoComplete="new-password" {...register("new_password")} />
        </Field>
        <Field
          label="Повторите новый пароль"
          required
          error={formState.errors.new_password_confirm?.message}
        >
          <PasswordInput autoComplete="new-password" {...register("new_password_confirm")} />
        </Field>

        <div className={styles.actions}>
          <Button type="submit" block disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сменить пароль"}
          </Button>
        </div>

        <div className={styles.links}>
          <Link className={styles.link} to="/login">
            К экрану входа
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
