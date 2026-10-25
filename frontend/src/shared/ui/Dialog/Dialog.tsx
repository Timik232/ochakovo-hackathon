import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import styles from "./Dialog.module.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  className,
}: DialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const container = dialogRef.current;
    if (container) {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? container).focus();
    }

    return () => {
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const container = dialogRef.current;
      if (container === null) {
        return;
      }
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      );
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={backdropRef}
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === backdropRef.current) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(styles.dialog, className)}
      >
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        {children !== undefined ? <div className={styles.content}>{children}</div> : null}
        {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
