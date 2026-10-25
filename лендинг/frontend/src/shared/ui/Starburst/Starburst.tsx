import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Starburst.module.css";

export interface StarburstProps {
  variant?: "paper" | "ink";
  animated?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Starburst({ variant = "paper", animated = false, className, children }: StarburstProps) {
  return (
    <div className={cx(styles.burst, styles[variant], animated && styles.animated, className)}>
      {children}
    </div>
  );
}
