import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Field.module.css";

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement;
}

/*
 * Обёртка поля для React Hook Form: контроль остаётся у вызывающего
 * (register прокидывается в children), Field только связывает label/hint/error
 * с контролом через id/aria-*, как .field в v4.
 */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        ...(error !== undefined ? { "aria-invalid": true } : {}),
        ...(required ? { "aria-required": true } : {}),
      })
    : children;

  return (
    <div className={cx(styles.field, error !== undefined && styles.bad, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? (
          <i className={styles.mark} aria-hidden="true">
            {" *"}
          </i>
        ) : null}
      </label>
      {hint !== undefined ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {control}
      {error !== undefined ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
