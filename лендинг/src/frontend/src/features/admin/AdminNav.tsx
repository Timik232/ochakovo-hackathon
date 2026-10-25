import { NavLink } from "react-router";
import { cx } from "../../shared/lib/cx";
import styles from "./AdminNav.module.css";

const ITEMS = [
  { to: "/admin/employees", label: "Сотрудники", end: true },
  { to: "/admin/audit", label: "Журнал", end: true },
] as const;

export function AdminNav() {
  return (
    <nav aria-label="Разделы администрирования">
      <ul className={styles.nav}>
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx(styles.item, isActive && styles.current)}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
