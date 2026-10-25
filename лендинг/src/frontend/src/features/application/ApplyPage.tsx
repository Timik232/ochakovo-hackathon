import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { fetchPublicPrivacy, fetchPublicVacancies } from "./api";
import { ApplicationForm } from "./ApplicationForm";
import type { PublicPrivacy, PublicVacancy } from "./types";
import {
  Alert,
  Button,
  ComicHeading,
  Halftone,
  Kicker,
  PageShell,
  Spinner,
  Starburst,
} from "../../shared/ui";
import styles from "./ApplyPage.module.css";

export function PublicFooter({ status }: { status?: ReactNode }) {
  return (
    <div className={styles.footerInner}>
      <span>«Очаково» / Кадры</span>
      <Link to="/privacy" className={styles.footerLink}>
        Политика обработки данных
      </Link>
      {status}
    </div>
  );
}

export function ApplyPage() {
  const [searchParams] = useSearchParams();
  const preselectSlug = searchParams.get("v") ?? "";
  const event = (searchParams.get("e") ?? "").slice(0, 100);
  const [forcedClosed, setForcedClosed] = useState(false);

  const privacyQuery = useQuery({
    queryKey: ["public", "privacy"],
    queryFn: async (): Promise<PublicPrivacy | null> => fetchPublicPrivacy(),
    retry: false,
  });
  const vacanciesQuery = useQuery({
    queryKey: ["public", "vacancies"],
    queryFn: async (): Promise<PublicVacancy[]> => fetchPublicVacancies(),
    retry: false,
  });

  const privacy = privacyQuery.data ?? null;
  const intakeClosed =
    forcedClosed ||
    (privacyQuery.isSuccess && (privacy === null || !privacy.collection_enabled));

  return (
    <PageShell variant="public" footer={<PublicFooter />}>
      <div className={styles.hero}>
        <Halftone />
        <Kicker>Анкета кандидата · 2 минуты</Kicker>
        <div className={styles.heroHeading}>
          <Starburst variant="paper">
            <ComicHeading level={1} accent="«Очаково»">
              Влейся в команду
            </ComicHeading>
          </Starburst>
        </div>
        {event !== "" ? (
          <p className={styles.stamp}>
            <span className={styles.stampDot} aria-hidden="true" />
            Мероприятие: {event}
          </p>
        ) : null}
        <p className={styles.bubble}>
          Твой потенциал — <b>наш любимый ингредиент</b>. Расскажи о себе, и HR «Очаково»
          свяжется с тобой.
        </p>
      </div>

      {privacyQuery.isPending ? (
        <div className={styles.loading}>
          <Spinner label="Загружаем анкету…" />
        </div>
      ) : privacyQuery.isError ? (
        <Alert tone="error" title="Не получилось загрузить анкету">
          Проверь интернет и попробуй ещё раз.
          <div className={styles.noticeRetry}>
            <Button size="sm" variant="secondary" onClick={() => void privacyQuery.refetch()}>
              Попробовать ещё раз
            </Button>
          </div>
        </Alert>
      ) : intakeClosed ? (
        <div className={styles.closedCard}>
          <Alert tone="info" title="Приём анкет закрыт">
            Сейчас мы не принимаем новые анкеты. Как только приём откроется — эта страница
            оживёт. Подробнее —{" "}
            <Link to="/privacy" className={styles.policyLink}>
              политика обработки данных
            </Link>
            .
          </Alert>
        </div>
      ) : privacy !== null ? (
        <ApplicationForm
          vacancies={vacanciesQuery.data ?? []}
          vacanciesPending={vacanciesQuery.isPending}
          vacanciesError={vacanciesQuery.isError}
          onVacanciesRetry={() => void vacanciesQuery.refetch()}
          privacy={privacy}
          preselectSlug={preselectSlug}
          event={event}
          onIntakeClosed={() => setForcedClosed(true)}
          onPolicyRefresh={async () => {
            await privacyQuery.refetch();
          }}
        />
      ) : null}
    </PageShell>
  );
}
