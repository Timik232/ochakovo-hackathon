import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { Field } from "../Field";
import styles from "../Field/Field.module.css";
import type { FieldProps } from "../Field";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    Pick<FieldProps, "label" | "hint" | "error" | "required"> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, id, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea ref={ref} id={id} className={cx(styles.control, styles.textarea)} {...rest} />
    </Field>
  );
});
