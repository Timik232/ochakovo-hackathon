import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  ComicHeading,
  EmptyState,
  Pagination,
  SkeletonBlock,
} from "../../shared/ui";
import { formatMoscow } from "../candidates/format";
import { useAuth } from "../auth/AuthContext";
import { AdminNav } from "./AdminNav";
import { ConfirmDialog, type ConfirmDraft } from "./ActionDialogs";
import {
  approveEmployee,
  disableEmployee,
  fetchEmployees,
  reactivateEmployee,
  rejectEmployee,
  resetEmployeePassword,
} from "./api";
import { ResetPasswordDialog } from "./ActionDialogs";
import { EMPLOYEES_KEY } from "./queries";
import { ROLE_LABELS, STATE_LABELS, STATE_TAB_LABELS } from "./labels";
import {
  EMPLOYEE_STATES,
  employeesApiQuery,
  parseEmployeeFilters,
  serializeEmployeeFilters,
} from "./urlState";
import type { AdminEmployee, EmployeeState } from "./types";
import styles from "./EmployeesPage.module.css";

function stateTone(state: EmployeeState): BadgeTone {
  if (state === "active") {
    return "success";
  }
  if (state === "pending") {
    return "attention";
  }
  return state === "rejected" ? "new" : "muted";
}

export function EmployeesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseEmployeeFilters(searchParams), [searchParams]);
  const [qInput, setQInput] = useState(filters.q);
  const [draft, setDraft] = useState<ConfirmDraft | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminEmployee | null>(null);
  const { user } = useAuth();

  const applyFilters = (patch: Partial<typeof filters>, replace = false) => {
    const next = { ...filters, ...patch };
    const query = serializeEmployeeFilters(next);
    setSearchParams(query === "" ? new URLSearchParams() : new URLSearchParams(query), {
      replace,
      preventScrollReset: true,
    });
  };

  useEffect(() => {
    setQInput(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (qInput === filters.q) {
      return;
    }
    const timer = setTimeout(() => {
      applyFilters({ q: qInput, page: 1 }, true);
    }, 350);
    return () => clearTimeout(timer);
  }, [qInput, filters.q]);

  const apiQuery = useMemo(() => employeesApiQuery(filters), [filters]);
  const listQuery = useQuery({
    queryKey: [...EMPLOYEES_KEY, apiQuery],
    queryFn: () => fetchEmployees(filters),
  });

  const queryClient = useQueryClient();

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  const confirmApprove = (employee: AdminEmployee) => {
    setDraft({
      title: "Подтвердить доступ",
      body: `Допустить ${employee.last_name} ${employee.first_name} (${employee.email}) к работе с кандидатами?`,
      confirmLabel: "Подтвердить",
      run: () => approveEmployee(employee.id),
    });
  };

  const confirmReject = (employee: AdminEmployee) => {
    setDraft({
      title: "Отклонить регистрацию",
      body: `Отклонить заявку ${employee.last_name} ${employee.first_name} (${employee.email})? Учётная запись сохранится, доступ не выдаётся.`,
      confirmLabel: "Отклонить",
      run: () => rejectEmployee(employee.id),
    });
  };

  const confirmDisable = (employee: AdminEmployee) => {
    const self = user?.id === employee.id;
    setDraft({
      title: "Отключить сотрудника",
      body: `Отключить ${employee.last_name} ${employee.first_name} (${employee.email})?`,
      warning: self
        ? "Вы отключаете себя: все ваши сеансы завершатся сразу после подтверждения."
        : "Все активные сеансы сотрудника будут немедленно завершены — он выйдет из системы на всех устройствах.",
      confirmLabel: "Отключить",
      run: () => disableEmployee(employee.id),
    });
  };

  const confirmReactivate = (employee: AdminEmployee) => {
    setDraft({
      title: "Вернуть сотрудника",
      body: `Вернуть ${employee.last_name} ${employee.first_name} (${employee.email}) к работе?`,
      confirmLabel: "Вернуть",
      run: () => reactivateEmployee(employee.id),
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <ComicHeading level={1}>
          Сотрудники{listQuery.data ? <span> · {total}</span> : null}
        </ComicHeading>
        <AdminNav />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Статусы сотрудников">
        {EMPLOYEE_STATES.map((state) => (
          <button
            key={state}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={filters.state === state}
            aria-pressed={filters.state === state}
            onClick={() => applyFilters({ state, page: 1 })}
          >
            {STATE_TAB_LABELS[state]}
          </button>
        ))}
      </div>

      <div className={styles.toolbar} role="search" aria-label="Поиск сотрудников">
        <div className={styles.searchWrap}>
          <label className={styles.searchLabel} htmlFor="employees-q">
            Поиск
          </label>
          <input
            id="employees-q"
            className={styles.searchInput}
            type="search"
            value={qInput}
            placeholder="Фамилия, имя или e-mail"
            onChange={(event) => setQInput(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.section}>
        {listQuery.isPending ? (
          <>
            <SkeletonBlock height={52} label="Загружаем список" />
            <SkeletonBlock height={320} label="Загружаем строки" />
          </>
        ) : listQuery.isError ? (
          <Alert tone="error" title="Не удалось загрузить список">
            {listQuery.error instanceof Error ? listQuery.error.message : "Проверьте подключение"}
          </Alert>
        ) : total === 0 ? (
          <EmptyState
            title={filters.state === "pending" ? "Заявок на допуск нет" : "В этом статусе пусто"}
            description={
              filters.q.trim() !== ""
                ? "По этому запросу ничего не нашлось. Измените запрос или сбросьте его."
                : "Новые регистрации будут появляться здесь, пока сотрудник не получит доступ."
            }
          />
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.tableCaption}>
                Сотрудники · {STATE_TAB_LABELS[filters.state]} — страница {listQuery.data?.page} из{" "}
                {Math.max(1, Math.ceil(total / (listQuery.data?.page_size ?? 20)))}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Сотрудник</th>
                  <th scope="col">Должность</th>
                  <th scope="col">Роль</th>
                  <th scope="col">Статус</th>
                  <th scope="col">Регистрация</th>
                  <th scope="col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((employee) => (
                  <tr key={employee.id}>
                    <td className={styles.nameCell}>
                      <span className={styles.name}>
                        {employee.last_name} {employee.first_name}
                        {user?.id === employee.id ? (
                          <span className={styles.selfMark}> · это вы</span>
                        ) : null}
                      </span>
                      <span className={styles.email}>{employee.email}</span>
                    </td>
                    <td>{employee.position}</td>
                    <td>{ROLE_LABELS[employee.role] ?? employee.role}</td>
                    <td>
                      <Badge tone={stateTone(employee.state as EmployeeState)}>
                        {STATE_LABELS[employee.state as EmployeeState]}
                      </Badge>
                    </td>
                    <td className={styles.dateCell}>{formatMoscow(employee.created_at)}</td>
                    <td className={styles.actionsCell}>
                      <EmployeeActions
                        employee={employee}
                        onApprove={confirmApprove}
                        onReject={confirmReject}
                        onDisable={confirmDisable}
                        onReactivate={confirmReactivate}
                        onReset={setResetTarget}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className={styles.cards} aria-label="Сотрудники">
              {items.map((employee) => (
                <li key={employee.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={styles.name}>
                      {employee.last_name} {employee.first_name}
                    </span>
                    <Badge tone={stateTone(employee.state as EmployeeState)}>
                      {STATE_LABELS[employee.state as EmployeeState]}
                    </Badge>
                  </div>
                  <dl className={styles.cardFields}>
                    <div>
                      <dt>E-mail</dt>
                      <dd>{employee.email}</dd>
                    </div>
                    <div>
                      <dt>Должность</dt>
                      <dd>{employee.position}</dd>
                    </div>
                    <div>
                      <dt>Роль</dt>
                      <dd>{ROLE_LABELS[employee.role] ?? employee.role}</dd>
                    </div>
                    <div>
                      <dt>Регистрация</dt>
                      <dd>{formatMoscow(employee.created_at)}</dd>
                    </div>
                  </dl>
                  <EmployeeActions
                    employee={employee}
                    onApprove={confirmApprove}
                    onReject={confirmReject}
                    onDisable={confirmDisable}
                    onReactivate={confirmReactivate}
                    onReset={setResetTarget}
                  />
                </li>
              ))}
            </ul>
            <p className={styles.total} aria-live="polite">
              Найдено: {total}
            </p>
            <Pagination
              page={filters.page}
              pageSize={listQuery.data?.page_size ?? 20}
              total={total}
              onPageChange={(page) => applyFilters({ page })}
              label="Страницы списка сотрудников"
            />
          </>
        )}
      </div>

      <ConfirmDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onDone={() => {
          setDraft(null);
          void queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
        }}
      />

      <ResetPasswordDialog
        open={resetTarget !== null}
        targetName={
          resetTarget !== null ? `${resetTarget.last_name} ${resetTarget.first_name}` : ""
        }
        onClose={() => setResetTarget(null)}
        onSubmit={async (password) => {
          const target = resetTarget;
          if (target === null) {
            return;
          }
          await resetEmployeePassword(target.id, password);
          void queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
        }}
      />
    </div>
  );
}

function EmployeeActions({
  employee,
  onApprove,
  onReject,
  onDisable,
  onReactivate,
  onReset,
}: {
  employee: AdminEmployee;
  onApprove: (employee: AdminEmployee) => void;
  onReject: (employee: AdminEmployee) => void;
  onDisable: (employee: AdminEmployee) => void;
  onReactivate: (employee: AdminEmployee) => void;
  onReset: (employee: AdminEmployee) => void;
}) {
  const state = employee.state as EmployeeState;
  return (
    <div className={styles.actions}>
      {state === "pending" || state === "rejected" ? (
        <Button size="sm" variant="primary" onClick={() => onApprove(employee)}>
          Подтвердить
        </Button>
      ) : null}
      {state === "pending" ? (
        <Button size="sm" variant="secondary" onClick={() => onReject(employee)}>
          Отклонить
        </Button>
      ) : null}
      {state === "active" ? (
        <>
          <Button size="sm" variant="secondary" onClick={() => onReset(employee)}>
            Временный пароль
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDisable(employee)}>
            Отключить
          </Button>
        </>
      ) : null}
      {state === "disabled" ? (
        <Button size="sm" variant="primary" onClick={() => onReactivate(employee)}>
          Вернуть
        </Button>
      ) : null}
    </div>
  );
}
