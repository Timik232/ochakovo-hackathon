import { Link } from "react-router";
import { PublicFooter } from "./ApplyPage";
import buttonStyles from "../../shared/ui/Button/Button.module.css";
import { ComicHeading, PageShell, Starburst } from "../../shared/ui";
import { cx } from "../../shared/lib/cx";
import styles from "./SuccessPage.module.css";

/*
 * Страница одноразовая и без PII: содержимое нейтральное и для только что
 * отправившего, и для того, кто обновил URL без отправки.
 */
export function SuccessPage() {
  return (
    <PageShell variant="public" footer={<PublicFooter />}>
      <div className={styles.card}>
        <div className={styles.dots} aria-hidden="true" />
        <p className={styles.kickerWhite}>Анкета отправлена</p>
        <Starburst variant="ink" className={styles.burst}>
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
        </Starburst>
        <ComicHeading level={1} onDark accent="принята!">
          Анкета
        </ComicHeading>
        <p className={styles.text}>Анкета у нас. HR «Очаково» свяжется с тобой в ближайшие дни.</p>
        <p className={styles.note}>
          Если ты только что отправил анкету — она у нас. Страница подтверждения одноразовая.
        </p>
        <Link to="/" className={cx(buttonStyles.button, buttonStyles.secondary, styles.homeCta)}>
          На главную
        </Link>
      </div>
    </PageShell>
  );
}
