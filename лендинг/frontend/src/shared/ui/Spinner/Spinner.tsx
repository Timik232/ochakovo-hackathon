import styles from "./Spinner.module.css";

export interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = "Загрузка…" }: SpinnerProps) {
  return (
    <span className={styles.spinner} role="status">
      <span className={styles.chip} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
