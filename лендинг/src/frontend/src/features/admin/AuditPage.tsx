import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  Alert,
  Button,
  ComicHeading,
  EmptyState,
  Pagination,
  Select,
  SkeletonBlock,
} from "../../shared/ui";
import { useStaffOptions } from "../candidates/hooks";
import { formatMoscow } from "../candidates/format";
import { AdminNav } from "./AdminNav";
import { fetchAudit } from "./api";
import { auditActionLabel, AUDIT_ACTION_OPTIONS } from "./labels";
import { auditApiQuery, parseAuditFilters, serializeAuditFilters } from "./urlState";
import styles from "./AuditPage.module.css";

import { AUDIT_KEY } from "./queries";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseAuditFilters(searchParams), [searchParams]);

  const applyFilters = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    const query = serializeAuditFilters(next);
    setSearchParams(query === "" ? new URLSearchParams() : new URLSearchParams(query), {
      preventScrollReset: true,
    });
  };

  const apiQuery = useMemo(() => auditApiQuery(filters), [filters]);
  const listQuery = useQuery({
    queryKey: [...AUDIT_KEY, apiQuery],
    queryFn: () => fetchAudit(filters),
  });
  const { data: staffOptions } = useStaffOptions();
  const staffNames = useMemo(
    () => new Map((staffOptions ?? []).map((option) => [option.id, option.name])),
    [staffOptions],
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const page = listQuery.data?.page ?? 1;
  const pageSize = listQuery.data?.page_size ?? 20;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <ComicHeading level={1}>
          Журнал{listQuery.data ? <span> · {total}</span> : null}
        </ComicHeading>
        <AdminNav />
      </div>

      <div className={styles.toolbar} role="search" aria-label="Фильтры журнала">
        <Select
          label="Действие"
          options={AUDIT_ACTION_OPTIONS}
          placeholder="Все действия"
          value={filters.action}
          onChange={(event) =>
            applyFilters({ action: (event.target.value || "") as typeof filters.action })
          }
        />
        <Select
          label="Сотрудник"
          options={(staffOptions ?? []).map((option) => ({ value: option.id, label: option.name }))}
          placeholder="Все сотрудники"
          value={filters.actorId}
          onChange={(event) => applyFilters({ actorId: event.target.value })}
        />
        <div className={styles.dateField}>
          <label className={styles.dateLabel} htmlFor="audit-date-from">
            Период с
          </label>
          <input
            id="audit-date-from"
            className={styles.dateInput}
            type="date"
            value={filters.dateFrom}
            onChange={(event) => applyFilters({ dateFrom: event.target.value })}
          />
        </div>
        <div className={styles.dateField}>
          <label className={styles.dateLabel} htmlFor="audit-date-to">
            по
          </label>
          <input
            id="audit-date-to"
            className={styles.dateInput}
            type="date"
            value={filters.dateTo}
            onChange={(event) => applyFilters({ dateTo: event.target.value })}
          />
        </div>
        {serializeAuditFilters(filters) !== "" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSearchParams(new URLSearchParams(), { preventScrollReset: true })}
          >
            Сбросить фильтры
          </Button>
        ) : null}
      </div>

      <div className={styles.section}>
        {listQuery.isPending ? (
          <>
            <SkeletonBlock height={52} label="Загружаем журнал" />
            <SkeletonBlock height={320} label="Загружаем строки" />
          </>
        ) : listQuery.isError ? (
          <Alert tone="error" title="Не удалось загрузить журнал">
            {listQuery.error instanceof Error ? listQuery.error.message : "Проверьте подключение"}
          </Alert>
        ) : total === 0 ? (
          <EmptyState
            title="Событий нет"
            description="Под эти фильтры ничего не подошло или действия пока не выполнялись."
          />
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.tableCaption}>
                Журнал действий — страница {page} из {Math.max(1, Math.ceil(total / pageSize))}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Действие</th>
                  <th scope="col">Кто</th>
                  <th scope="col">Объект</th>
                  <th scope="col">Изменено</th>
                  <th scope="col">Время</th>
                </tr>
              </thead>
              <tbody>
                {items.map((event) => (
                  <tr key={event.id}>
                    <td className={styles.actionCell}>{auditActionLabel(event.action)}</td>
                    <td className={styles.monoCell}>
                      {staffNames.get(event.actor_id) ?? shortId(event.actor_id)}
                    </td>
                    <td className={styles.monoCell}>{shortId(event.entity_id)}</td>
                    <td>{event.changed_fields.length > 0 ? event.changed_fields.join(", ") : "—"}</td>
                    <td className={styles.dateCell}>{formatMoscow(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.total} aria-live="polite">
              Всего: {total}
            </p>
            <Pagination
              page={filters.page}
              pageSize={pageSize}
              total={total}
              onPageChange={(nextPage) => applyFilters({ page: nextPage })}
              label="Страницы журнала"
            />
          </>
        )}
      </div>
    </div>
  );
}
