import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./PageShell.module.css";

export interface PageShellProps {
  variant: "public" | "staff";
  brandTo?: string;
  nav?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  decor?: "none" | "halftone";
  children: ReactNode;
}

export function PageShell({ variant, brandTo = "/", nav, headerExtra, footer, decor = "none", children }: PageShellProps) {
  return (
    <div className={cx(styles.shell, styles[variant], decor === "halftone" && styles.decorHalftone)}>
      <a className={styles.skip} href="#content">
        К содержанию
      </a>
      <header className={styles.header}>
        <div className={styles.top}>
          <a className={styles.brand} href={brandTo} aria-label="Очаково Кадры — на главную">
            <span>Очаково</span>
            <span className={styles.brandSlash} aria-hidden="true">
              /
            </span>
            <span className={styles.brandAlt}>Кадры</span>
          </a>
          {nav !== undefined || headerExtra !== undefined ? (
            <div className={styles.navSlot}>
              {nav}
              {headerExtra}
            </div>
          ) : null}
        </div>
      </header>
      <main id="content" className={cx(styles.main, styles[`${variant}Main`])}>
        {children}
      </main>
      {footer !== undefined ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  );
}
