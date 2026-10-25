import { useState, type InputHTMLAttributes } from "react";
import fieldStyles from "../../shared/ui/Field/Field.module.css";
import styles from "./PasswordInput.module.css";

export interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  toggleLabelShow?: string;
  toggleLabelHide?: string;
}

/*
 * Поле пароля с доступным переключателем видимости: aria-pressed + меняющийся
 * aria-label. Field (T6) клонирует этот компонент и прокидывает id/aria-*.
 */
export function PasswordInput({
  toggleLabelShow = "Показать пароль",
  toggleLabelHide = "Скрыть пароль",
  className,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={styles.wrap}>
      <input
        type={visible ? "text" : "password"}
        className={[fieldStyles.control, className].filter(Boolean).join(" ")}
        {...rest}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={visible}
        aria-label={visible ? toggleLabelHide : toggleLabelShow}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? "скрыть" : "показать"}
      </button>
    </span>
  );
}
