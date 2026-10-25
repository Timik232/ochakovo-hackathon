import type { ReactNode } from "react";
import { Button, PageShell, StaffNavigation } from "../../shared/ui";
import { useAuth } from "./AuthContext";
import styles from "./StaffShell.module.css";

/*
 * Оболочка авторизованных разделов: PageShell(staff, 1440px) + StaffNavigation
 * («Кандидаты», «Админ» только для роли admin) + имя сотрудника и выход.
 * Публичные страницы и /style остаются вне этой оболочки.
 */
export function StaffShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  const items = [
    { to: "/candidates", label: "Кандидаты", end: false },
    { to: "/vacancies", label: "Вакансии", end: false },
  ];
  if (user?.role === "admin") {
    items.push({ to: "/admin/employees", label: "Админ", end: false });
  }

  return (
    <PageShell
      variant="staff"
      brandTo="/candidates"
      nav={<StaffNavigation items={items} ariaLabel="Разделы кабинета" />}
      headerExtra={
        <div className={styles.session}>
          {user !== null ? (
            <span className={styles.who} title={user.position}>
              {user.last_name} {user.first_name}
            </span>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => void logout()}>
            Выйти
          </Button>
        </div>
      }
    >
      {children}
    </PageShell>
  );
}
