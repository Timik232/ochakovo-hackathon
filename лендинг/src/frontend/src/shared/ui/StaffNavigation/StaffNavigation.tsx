import { NavLink } from "react-router";
import { cx } from "../../lib/cx";
import styles from "./StaffNavigation.module.css";

export interface StaffNavItem {
  to: string;
  label: string;
  end?: boolean;
}

export interface StaffNavigationProps {
  items: ReadonlyArray<StaffNavItem>;
  ariaLabel?: string;
}

export function StaffNavigation({ items, ariaLabel = "Основная навигация" }: StaffNavigationProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className={styles.nav}>
        {items.map((item) => (
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
