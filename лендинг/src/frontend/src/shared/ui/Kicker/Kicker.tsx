import type { ReactNode } from "react";
import styles from "./Kicker.module.css";

export function Kicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}
