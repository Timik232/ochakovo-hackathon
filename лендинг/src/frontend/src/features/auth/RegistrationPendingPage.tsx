import { Link, useNavigate } from "react-router";
import { Button, ComicHeading, Kicker, PageShell, Starburst } from "../../shared/ui";
import styles from "./auth.module.css";

/*
 * Статический экран ожидания допуска: без staff-навигации и без опроса
 * employee-endpoint'ов (pending-login сессию не создаёт — T3 контракт).
 */
export function RegistrationPendingPage() {
  const navigate = useNavigate();
  return (
    <PageShell variant="public">
      <div className={styles.pendingWrap}>
        <Kicker>Регистрация</Kicker>
        <div className={styles.heroHeading}>
          <ComicHeading level={1} accent="Ждём">
            подтверждения
          </ComicHeading>
        </div>
        <div className={styles.pendingCard}>
          <Starburst />
          <p>
            Регистрация отправлена. Администратор проверит учётную запись и откроет доступ
            к кабинету кандидатов.
          </p>
          <p>Как только доступ откроют — войдите тем же e-mail и паролем.</p>
          <div className={styles.actions}>
            <Button block onClick={() => navigate("/login")}>
              Перейти ко входу
            </Button>
          </div>
          <div className={styles.links}>
            <Link className={styles.link} to="/">
              На главную
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
