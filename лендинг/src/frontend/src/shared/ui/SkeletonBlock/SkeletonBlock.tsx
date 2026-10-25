import styles from "./SkeletonBlock.module.css";

export interface SkeletonBlockProps {
  height?: number;
  width?: number | string;
  label?: string;
}

export function SkeletonBlock({ height = 72, width = "100%", label = "Загрузка" }: SkeletonBlockProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={styles.skeleton}
      style={{ height, width }}
    />
  );
}
