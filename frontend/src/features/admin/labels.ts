import type { EmployeeState } from "./types";

export const STATE_LABELS: Record<EmployeeState, string> = {
  pending: "Ожидает допуска",
  active: "Допущен",
  rejected: "Отклонён",
  disabled: "Отключён",
};

export const STATE_TAB_LABELS: Record<EmployeeState, string> = {
  pending: "Ожидание",
  active: "Допущенные",
  rejected: "Отклонённые",
  disabled: "Отключённые",
};

export const ROLE_LABELS: Record<string, string> = {
  staff: "Сотрудник",
  admin: "Администратор",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  bootstrap_admin: "Создание администратора",
  promote_admin: "Назначение администратора",
  reset_password: "Сброс пароля",
  password_change: "Смена пароля",
  privacy_activate: "Активация политики",
  intake_disable: "Остановка приёма анкет",
  retention_delete: "Удаление по сроку хранения",
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  comment: "Комментарий",
  approve: "Допуск сотрудника",
  reject: "Отклонение сотрудника",
  disable: "Отключение сотрудника",
  reactivate: "Возврат сотрудника",
  register: "Регистрация",
  login: "Вход",
  logout: "Выход",
};

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
