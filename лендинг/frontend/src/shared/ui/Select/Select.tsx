import { forwardRef, type SelectHTMLAttributes } from "react";
import { Field } from "../Field";
import styles from "../Field/Field.module.css";
import type { FieldProps } from "../Field";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children">,
    Pick<FieldProps, "label" | "hint" | "error" | "required"> {
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, id, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select ref={ref} id={id} className={styles.control} {...rest}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
});
