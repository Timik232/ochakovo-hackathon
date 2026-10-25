import { cx } from "../../lib/cx";
import styles from "./Halftone.module.css";

export function Halftone({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx(styles.halftone, className)} />;
}
