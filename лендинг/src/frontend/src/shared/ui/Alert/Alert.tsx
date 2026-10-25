import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Alert.module.css";

export type AlertTone = "info" | "success" | "error" | "warning";

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children: ReactNode;
}

export function Alert({ tone = "info", title, children }: AlertProps) {
  const isAssertive = tone === "error" || tone === "warning";
  return (
    <div className={cx(styles.alert, styles[tone])} role={isAssertive ? "alert" : "status"}>
      {title !== undefined ? <p className={styles.title}>{title}</p> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
