import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Badge.module.css";

export const STAGE_LABELS = {
  application: "Анкета",
  new: "Новый",
  review: "Рассматриваем",
  interview: "Собеседование",
  offer: "Предложение",
  hired: "Принят",
  reject: "Отказ",
  withdrawn: "Снял кандидатуру",
} as const;

export type Stage = keyof typeof STAGE_LABELS;

export type BadgeTone = "paper" | "light" | "new" | "attention" | "success" | "muted" | "outline";

const STAGE_TONES: Record<Stage, BadgeTone> = {
  application: "paper",
  new: "new",
  review: "light",
  interview: "attention",
  offer: "attention",
  hired: "success",
  reject: "muted",
  withdrawn: "outline",
};

export interface BadgeProps {
  stage?: Stage;
  tone?: BadgeTone;
  children?: ReactNode;
}

export function Badge({ stage, tone, children }: BadgeProps) {
  const resolvedTone = tone ?? (stage === undefined ? "paper" : STAGE_TONES[stage]);
  const label = stage === undefined ? children : STAGE_LABELS[stage];
  return <span className={cx(styles.badge, styles[resolvedTone])}>{label}</span>;
}
