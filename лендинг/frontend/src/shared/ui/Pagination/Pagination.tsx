import { cx } from "../../lib/cx";
import { pageWindow } from "./pageWindow";
import styles from "./Pagination.module.css";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, label = "Пагинация" }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className={styles.nav} aria-label={label}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <span aria-hidden="true">←</span>
        <span className={styles.sr}>Предыдущая страница</span>
      </button>
      {pageWindow(page, pageCount).map((item, index) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            className={cx(styles.button, item === page && styles.current)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Страница ${item}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={`gap-${index}`} className={styles.gap} aria-hidden="true">
            …
          </span>
        ),
      )}
      <button
        type="button"
        className={styles.button}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
      >
        <span aria-hidden="true">→</span>
        <span className={styles.sr}>Следующая страница</span>
      </button>
      <p className={styles.status}>
        {total === 0 ? "Ничего не найдено" : `${from}–${to} из ${total}`}
      </p>
    </nav>
  );
}
