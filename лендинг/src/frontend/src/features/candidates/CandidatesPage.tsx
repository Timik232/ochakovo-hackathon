import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  ComicHeading,
  Dialog,
  EmptyState,
  Kicker,
  Pagination,
  Select,
  SkeletonBlock,
  STAGE_LABELS,
} from "../../shared/ui";
import {
  bulkCandidates,
  downloadBlob,
  exportCandidatesCsv,
  fetchCandidates,
  type BulkActionInput,
} from "./api";
import { formatMoscow, fullName, STAGE_VALUES } from "./format";
import {
  CANDIDATES_KEY,
  useCandidatesCount,
  useStaffOptions,
  useVacancies,
  staffNameMap,
  vacancyTitleMap,
} from "./hooks";
import { QrDialog } from "./QrDialog";
import {
  isDefaultListFilters,
  listApiQuery,
  parseListFilters,
  serializeListFilters,
  type CandidateListFilters,
} from "./urlState";
import type { CandidatePage, CandidateView, Stage } from "./types";
import { cx } from "../../shared/lib/cx";
import buttonStyles from "../../shared/ui/Button/Button.module.css";
import styles from "./CandidatesPage.module.css";

const SORT_OPTIONS = [
  { value: "created_at.desc", label: "Сначала добавленные" },
  { value: "created_at.asc", label: "Сначала старые" },
  { value: "last_name.asc", label: "Фамилия А–Я" },
  { value: "last_name.desc", label: "Фамилия Я–А" },
  { value: "status.asc", label: "По этапу" },
  { value: "updated_at.desc", label: "По изменению" },
] as const;

const STAGE_CHIP_LABELS: Record<Stage, string> = STAGE_LABELS;

export function CandidatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => parseListFilters(searchParams), [searchParams]);
  const [qInput, setQInput] = useState(filters.q);
  const [qrOpen, setQrOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkDraft, setBulkDraft] = useState<BulkActionInput | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvPending, setCsvPending] = useState(false);

  const applyFilters = (patch: Partial<CandidateListFilters>, replace = false) => {
    const next = { ...filters, ...patch };
    const query = serializeListFilters(next);
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

  const apiQuery = useMemo(() => listApiQuery(filters), [filters]);
  const listQuery = useQuery({
    queryKey: [...CANDIDATES_KEY, apiQuery],
    queryFn: () => fetchCandidates(filters),
  });
  const activeCountQuery = useCandidatesCount("0");
  const archivedCountQuery = useCandidatesCount("1");
  const { data: vacancies } = useVacancies();
  const { data: staffOptions } = useStaffOptions();
  const vacancyTitles = vacancyTitleMap(vacancies);
  const staffNames = staffNameMap(staffOptions);

  const queryClient = useQueryClient();
  const bulkMutation = useMutation({
    mutationFn: (input: BulkActionInput) => bulkCandidates(input),
    onSuccess: () => {
      setBulkDraft(null);
      setSelected(new Set());
      setBulkError(null);
      void queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY });
    },
    onError: (error) => {
      setBulkDraft(null);
      setBulkError(error instanceof Error ? error.message : "Не удалось выполнить операцию");
    },
  });

  const [stageError, setStageError] = useState<string | null>(null);
  const stageMutation = useMutation({
    mutationFn: (vars: { candidate: CandidateView; stage: Stage }) =>
      bulkCandidates({ ids: [vars.candidate.id], action: "stage", stage: vars.stage }),
    onMutate: ({ candidate, stage }) => {
      const key = [...CANDIDATES_KEY, apiQuery];
      const previous = queryClient.getQueryData<CandidatePage>(key);
      if (previous !== undefined) {
        queryClient.setQueryData<CandidatePage>(key, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === candidate.id ? { ...item, status: stage } : item,
          ),
        });
      }
      return { key, previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      setStageError(error instanceof Error ? error.message : "Не удалось изменить этап");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY });
    },
  });

  const changeStage = (candidate: CandidateView, stage: Stage) => {
    if (stage === candidate.status) {
      return;
    }
    setStageError(null);
    stageMutation.mutate({ candidate, stage });
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const pageIds = items.map((item) => item.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const downloadCsv = async () => {
    setCsvPending(true);
    setCsvError(null);
    try {
      const { blob, fileName } = await exportCandidatesCsv(filters);
      downloadBlob(blob, fileName);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Не удалось выгрузить CSV");
    } finally {
      setCsvPending(false);
    }
  };

  const toggleStatus = (status: Stage) => {
    const next = filters.status.includes(status)
      ? filters.status.filter((value) => value !== status)
      : [...filters.status, status];
    applyFilters({ status: next, page: 1 });
  };

  const activeVacancies = (vacancies ?? []).filter((vacancy) => vacancy.is_active);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Kicker>База кандидатов</Kicker>
          <ComicHeading level={1} accent="«Очаково»">
            Кандидаты
          </ComicHeading>
        </div>
        <div className={styles.headerActions}>
          <Button size="sm" variant="ghost" onClick={() => setQrOpen(true)}>
            QR-код анкеты
          </Button>
          <Link
            to="/vacancies"
            className={cx(buttonStyles.button, buttonStyles.buttonSm, buttonStyles.ghost)}
          >
            Вакансии
          </Link>
          <Button size="sm" variant="secondary" onClick={() => void downloadCsv()} disabled={csvPending}>
            {csvPending ? "Готовим файл…" : "Скачать CSV"}
          </Button>
          <Button size="sm" onClick={() => navigate("/candidates/new")}>
            + Добавить кандидата
          </Button>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Разделы реестра">
        <button
          type="button"
          role="tab"
          aria-selected={filters.archived === "0"}
          className={styles.tab}
          onClick={() => applyFilters({ archived: "0", page: 1 })}
        >
          Активные
          <span className={styles.tabCount}>{activeCountQuery.data ?? "…"}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filters.archived === "1"}
          className={cx(styles.tab, styles.tabArchive)}
          onClick={() => applyFilters({ archived: "1", page: 1 })}
        >
          Архив
          <span className={styles.tabCount}>{archivedCountQuery.data ?? "…"}</span>
        </button>
      </div>

      {csvError ? (
        <div className={styles.section}>
          <Alert tone="error" title="CSV не выгрузился">
            {csvError}
          </Alert>
        </div>
      ) : null}

      {stageError ? (
        <div className={styles.section}>
          <Alert tone="error" title="Этап не изменился">
            {stageError}
          </Alert>
        </div>
      ) : null}

      <div className={styles.toolbar} role="search" aria-label="Фильтры реестра">
        <div className={styles.searchWrap}>
          <label className={styles.searchLabel} htmlFor="candidates-q">
            Поиск
          </label>
          <input
            id="candidates-q"
            className={styles.searchInput}
            type="search"
            value={qInput}
            placeholder="Фамилия, имя, телефон, e-mail, город"
            onChange={(event) => setQInput(event.target.value)}
          />
        </div>
        <div className={styles.toolbarSelects}>
          <Select
            label="Вакансия"
            options={activeVacancies.map((vacancy) => ({ value: vacancy.id, label: vacancy.title }))}
            placeholder="Все вакансии"
            value={filters.vacancyId[0] ?? ""}
            onChange={(event) =>
              applyFilters({
                vacancyId: event.target.value === "" ? [] : [event.target.value],
                page: 1,
              })
            }
          />
          <Select
            label="Сортировка"
            options={[...SORT_OPTIONS]}
            value={`${filters.sort}.${filters.direction}`}
            onChange={(event) => {
              const [sort, direction] = event.target.value.split(".");
              applyFilters({
                sort: sort as CandidateListFilters["sort"],
                direction: direction as CandidateListFilters["direction"],
              });
            }}
          />
        </div>
        <div className={styles.chips}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={filters.hot}
            onClick={() => applyFilters({ hot: !filters.hot, page: 1 })}
          >
            Горячие
          </button>
          {STAGE_VALUES.map((status) => (
            <button
              key={status}
              type="button"
              className={styles.chip}
              aria-pressed={filters.status.includes(status)}
              onClick={() => toggleStatus(status)}
            >
              {STAGE_CHIP_LABELS[status]}
            </button>
          ))}
          {isDefaultListFilters(filters) ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setSearchParams(new URLSearchParams(), { preventScrollReset: true })
              }
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>

      {bulkError ? (
        <div className={styles.section}>
          <Alert tone="error" title="Массовая операция не выполнена">
            {bulkError}
          </Alert>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className={styles.bulkBar} role="region" aria-label="Массовые операции">
          <span className={styles.bulkCount}>Выбрано: {selected.size}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkDraft({ ids: [...selected], action: "archive" })}
          >
            В архив
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkDraft({ ids: [...selected], action: "restore" })}
          >
            Вернуть из архива
          </Button>
          <select
            className={styles.bulkSelect}
            aria-label="Изменить этап выбранным"
            value=""
            onChange={(event) => {
              if (event.target.value !== "") {
                setBulkDraft({ ids: [...selected], action: "stage", stage: event.target.value as Stage });
              }
            }}
          >
            <option value="">Изменить этап…</option>
            {STAGE_VALUES.map((status) => (
              <option key={status} value={status}>
                {STAGE_CHIP_LABELS[status]}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Снять выделение
          </Button>
        </div>
      ) : null}

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
            title={filters.archived === "1" ? "В архиве пока пусто" : "Кандидатов пока нет"}
            description={
              isDefaultListFilters(filters)
                ? "Добавьте кандидата вручную или предложите ему заполнить анкету по QR-коду."
                : "Под эти фильтры ничего не подошло. Сбросьте фильтры или измените запрос."
            }
            action={
              isDefaultListFilters(filters) ? (
                <Button size="sm" onClick={() => navigate("/candidates/new")}>
                  Добавить кандидата
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSearchParams(new URLSearchParams())}
                >
                  Сбросить фильтры
                </Button>
              )
            }
          />
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.tableCaption}>
                Реестр кандидатов — страница {listQuery.data?.page} из{" "}
                {Math.max(1, Math.ceil(total / (listQuery.data?.page_size ?? 20)))}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.checkCell}>
                    <input
                      type="checkbox"
                      aria-label="Выбрать всех на странице"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">ФИО</th>
                  <th scope="col">Вакансия</th>
                  <th scope="col">Телефон</th>
                  <th scope="col">Возраст</th>
                  <th scope="col">Этап</th>
                  <th scope="col">Ответственный</th>
                  <th scope="col">Дата добавления</th>
                </tr>
              </thead>
              <tbody>
                {items.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    checked={selected.has(candidate.id)}
                    onToggle={() => toggleSelected(candidate.id)}
                    onStageChange={(stage) => changeStage(candidate, stage)}
                    stagePending={stageMutation.isPending && stageMutation.variables?.candidate.id === candidate.id}
                    vacancyTitle={vacancyTitles.get(candidate.vacancy_id ?? "") ?? null}
                    responsibleName={candidate.responsible_id ? staffNames.get(candidate.responsible_id) : undefined}
                  />
                ))}
              </tbody>
            </table>
            <ul className={styles.cards} aria-label="Кандидаты">
              {items.map((candidate) => (
                <li key={candidate.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <input
                      type="checkbox"
                      aria-label={`Выбрать ${fullName(candidate)}`}
                      checked={selected.has(candidate.id)}
                      onChange={() => toggleSelected(candidate.id)}
                    />
                    <Link className={styles.cardName} to={`/candidates/${candidate.id}`}>
                      {candidate.hot ? <span className={styles.hotMark} aria-label="Горячий кандидат">★</span> : null}
                      {fullName(candidate)}
                    </Link>
                    <StageSelect
                      candidate={candidate}
                      onChange={(stage) => changeStage(candidate, stage)}
                      pending={stageMutation.isPending && stageMutation.variables?.candidate.id === candidate.id}
                    />
                  </div>
                  <dl className={styles.cardFields}>
                    <div>
                      <dt>Вакансия</dt>
                      <dd>{vacancyTitles.get(candidate.vacancy_id ?? "") ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Телефон</dt>
                      <dd>
                        <a href={`tel:${candidate.phone}`}>{candidate.phone}</a>
                      </dd>
                    </div>
                    <div>
                      <dt>Дата добавления</dt>
                      <dd>{formatMoscow(candidate.created_at)}</dd>
                    </div>
                  </dl>
                  {candidate.archived_at !== null ? <Badge tone="outline">В архиве</Badge> : null}
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
              label="Страницы реестра кандидатов"
            />
          </>
        )}
      </div>

      <QrDialog open={qrOpen} onClose={() => setQrOpen(false)} />

      <BulkConfirmDialog
        draft={bulkDraft}
        pending={bulkMutation.isPending}
        onCancel={() => setBulkDraft(null)}
        onConfirm={(input) => bulkMutation.mutate(input)}
      />
    </div>
  );
}

function StageSelect({
  candidate,
  onChange,
  pending,
}: {
  candidate: CandidateView;
  onChange: (stage: Stage) => void;
  pending: boolean;
}) {
  return (
    <select
      className={styles.stageSelect}
      data-s={candidate.status}
      value={candidate.status}
      disabled={pending}
      aria-label={`Этап — ${fullName(candidate)}`}
      onChange={(event) => onChange(event.target.value as Stage)}
    >
      {STAGE_VALUES.map((status) => (
        <option key={status} value={status}>
          {STAGE_CHIP_LABELS[status]}
        </option>
      ))}
    </select>
  );
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
  onStageChange,
  stagePending,
  vacancyTitle,
  responsibleName,
}: {
  candidate: CandidateView;
  checked: boolean;
  onToggle: () => void;
  onStageChange: (stage: Stage) => void;
  stagePending: boolean;
  vacancyTitle: string | null;
  responsibleName: string | undefined;
}) {
  return (
    <tr>
      <td className={styles.checkCell}>
        <input
          type="checkbox"
          aria-label={`Выбрать ${fullName(candidate)}`}
          checked={checked}
          onChange={onToggle}
        />
      </td>
      <td className={styles.nameCell}>
        <Link className={styles.rowLink} to={`/candidates/${candidate.id}`}>
          {candidate.hot ? <span className={styles.hotMark} aria-label="Горячий кандидат">★</span> : null}
          {fullName(candidate)}
        </Link>
        {candidate.archived_at !== null ? <Badge tone="outline">В архиве</Badge> : null}
      </td>
      <td>{vacancyTitle ?? "—"}</td>
      <td>
        <a href={`tel:${candidate.phone}`}>{candidate.phone}</a>
      </td>
      <td>{candidate.age ?? "—"}</td>
      <td>
        <StageSelect candidate={candidate} onChange={onStageChange} pending={stagePending} />
      </td>
      <td>{responsibleName ?? "—"}</td>
      <td className={styles.dateCell}>{formatMoscow(candidate.created_at)}</td>
    </tr>
  );
}

const BULK_ACTION_TITLES: Record<BulkActionInput["action"], string> = {
  archive: "Перенести в архив",
  restore: "Вернуть из архива",
  stage: "Изменить этап",
};

function BulkConfirmDialog({
  draft,
  pending,
  onCancel,
  onConfirm,
}: {
  draft: BulkActionInput | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (input: BulkActionInput) => void;
}) {
  if (draft === null) {
    return null;
  }
  const stageLabel = draft.stage !== undefined ? STAGE_LABELS[draft.stage] : null;
  return (
    <Dialog
      open
      onClose={onCancel}
      title={BULK_ACTION_TITLES[draft.action]}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button size="sm" onClick={() => onConfirm(draft)} disabled={pending}>
            {pending ? "Выполняем…" : "Подтвердить"}
          </Button>
        </>
      }
    >
      {draft.action === "stage" ? (
        <p>
          Изменить этап на «{stageLabel}» для {draft.ids.length} выбранных кандидатов?
        </p>
      ) : (
        <p>
          {BULK_ACTION_TITLES[draft.action]} {draft.ids.length} выбранных кандидатов?
        </p>
      )}
    </Dialog>
  );
}

