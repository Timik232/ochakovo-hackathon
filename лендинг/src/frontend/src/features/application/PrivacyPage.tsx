import { useQuery } from "@tanstack/react-query";
import { fetchPublicPrivacy } from "./api";
import { PublicFooter } from "./ApplyPage";
import type { PublicPrivacy } from "./types";
import {
  Alert,
  Badge,
  Button,
  ComicHeading,
  Kicker,
  PageShell,
  Spinner,
} from "../../shared/ui";
import styles from "./PrivacyPage.module.css";

export function PrivacyPage() {
  const privacyQuery = useQuery({
    queryKey: ["public", "privacy"],
    queryFn: async (): Promise<PublicPrivacy | null> => fetchPublicPrivacy(),
    retry: false,
  });

  const privacy = privacyQuery.data ?? null;

  return (
    <PageShell variant="public" footer={<PublicFooter />}>
      <Kicker>Документы</Kicker>
      <ComicHeading level={1} accent="данных">
        Политика обработки
      </ComicHeading>

      {privacyQuery.isPending ? (
        <div className={styles.loading}>
          <Spinner label="Загружаем политику…" />
        </div>
      ) : privacyQuery.isError ? (
        <Alert tone="error" title="Не получилось загрузить политику">
          Проверь интернет и попробуй ещё раз.
          <div className={styles.retry}>
            <Button size="sm" variant="secondary" onClick={() => void privacyQuery.refetch()}>
              Попробовать ещё раз
            </Button>
          </div>
        </Alert>
      ) : privacy === null ? (
        <div className={styles.card}>
          <Alert tone="info" title="Политика публикуется при открытии приёма">
            Как только «Очаково» откроет приём анкет, здесь появится действующая редакция
            политики обработки данных.
          </Alert>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.badgeRow}>
            <Badge tone={privacy.collection_enabled ? "success" : "outline"}>
              {privacy.collection_enabled ? "Приём анкет открыт" : "Приём анкет закрыт"}
            </Badge>
            {privacy.revision !== null && privacy.revision !== undefined ? (
              <span className={styles.revision}>Редакция: {String(privacy.revision)}</span>
            ) : null}
          </div>

          {privacy.notice !== null && privacy.notice !== "" ? (
            <section className={styles.block}>
              <ComicHeading level={3}>Уведомление об обработке</ComicHeading>
              <p className={styles.text}>{privacy.notice}</p>
            </section>
          ) : null}

          {privacy.consent !== null && privacy.consent !== "" ? (
            <section className={styles.block}>
              <ComicHeading level={3}>Текст согласия</ComicHeading>
              <p className={styles.text}>{privacy.consent}</p>
            </section>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
