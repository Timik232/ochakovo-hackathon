import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./ComicHeading.module.css";

export interface ComicHeadingProps {
  level: 1 | 2 | 3 | 4;
  children: ReactNode;
  accent?: ReactNode;
  onDark?: boolean;
  id?: string;
}

export function ComicHeading({ level, children, accent, onDark = false, id }: ComicHeadingProps) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  return (
    <Tag id={id} className={cx(styles.comic, styles[`h${level}`], onDark && styles.onDark)}>
      {children}
      {accent !== undefined ? (
        <>
          {" "}
          <span className={styles.r}>{accent}</span>
        </>
      ) : null}
    </Tag>
  );
}
