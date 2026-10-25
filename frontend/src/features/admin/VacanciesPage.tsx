import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  ComicHeading,
  Dialog,
  EmptyState,
  Field,
  Select,
  SkeletonBlock,
} from "../../shared/ui";
import { brandIcons } from "../../shared/assets/icons";
import { useAuth } from "../auth/AuthContext";
import { fetchPublicPrivacy } from "../application/api";
import { ConfirmDialog, type ConfirmDraft } from "./ActionDialogs";
import { createAdminVacancy, disableIntake, fetchAdminVacancies, setVacancyActive } from "./api";
import { slugFromTitle } from "./tempPassword";
import { INTAKE_STATE_KEY, VACANCIES_ADMIN_KEY } from "./queries";
import styles from "./VacanciesPage.module.css";

const ICON_OPTIONS = Object.keys(brandIcons).map((name) => ({ value: name, label: name }));

export function VacanciesPage() {
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: VACANCIES_ADMIN_KEY,
    queryFn: fetchAdminVacancies,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: VACANCIES_ADMIN_KEY });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setVacancyActive(id, isActive),
    onSuccess: invalidate,
    onError: (error) => {
      setToggleError(error instanceof Error ? error.message : "Не удалось изменить вакансию");
    },
  });

  const all = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const vacancies = showActiveOnly ? all.filter((vacancy) => vacancy.is_active) : all;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <ComicHeading level={1}>
          Вакансии{listQuery.data ? <span> · {vacancies.length}</span> : null}
        </ComicHeading>
      </div>

      {user?.role === "admin" ? <IntakePanel /> : null}

      {toggleError !== null ? (
        <Alert tone="error" title="Вакансия не изменена">
          {toggleError}
        </Alert>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.filterToggle} role="group" aria-label="Показ вакансий">
          <button
            type="button"
            className={styles.filterButton}
            aria-pressed={showActiveOnly}
            onClick={() => setShowActiveOnly(true)}
          >
            Активные
          </button>
          <button
            type="button"
            className={styles.filterButton}
            aria-pressed={!showActiveOnly}
            onClick={() => setShowActiveOnly(false)}
          >
            Все
          </button>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          + Добавить вакансию
        </Button>
      </div>

      <div className={styles.section}>
        {listQuery.isPending ? (
          <>
            <SkeletonBlock height={52} label="Загружаем справочник" />
            <SkeletonBlock height={280} label="Загружаем строки" />
          </>
        ) : listQuery.isError ? (
          <Alert tone="error" title="Не удалось загрузить вакансии">
            {listQuery.error instanceof Error ? listQuery.error.message : "Проверьте подключение"}
          </Alert>
        ) : vacancies.length === 0 ? (
          <EmptyState
            title={showActiveOnly ? "Активных вакансий нет" : "Справочник пуст"}
            description="Добавьте вакансию — она появится в анкете на сайте сразу после сохранения."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Добавить вакансию
              </Button>
            }
          />
        ) : (
          <table className={styles.table}>
            <caption className={styles.tableCaption}>
              Справочник вакансий{showActiveOnly ? " · активные" : " · все"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Вакансия</th>
                <th scope="col">Подразделение</th>
                <th scope="col">Оплата</th>
                <th scope="col">График</th>
                <th scope="col">Статус</th>
                <th scope="col">Действие</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((vacancy) => (
                <tr key={vacancy.id}>
                  <td className={styles.nameCell}>
                    <span className={styles.nameRow}>
                      <img
                        className={styles.icon}
                        src={brandIcons[vacancy.icon as keyof typeof brandIcons] ?? brandIcons.can}
                        alt=""
                        width={28}
                        height={28}
                      />
                      <span>
                        <span className={styles.name}>{vacancy.title}</span>
                        <span className={styles.slug}>{vacancy.slug}</span>
                      </span>
                    </span>
                  </td>
                  <td>{vacancy.dept || "—"}</td>
                  <td>{vacancy.pay || "—"}</td>
                  <td>{vacancy.schedule || "—"}</td>
                  <td>
                    <Badge tone={vacancy.is_active ? "success" : "muted"}>
                      {vacancy.is_active ? "Активна" : "Отключена"}
                    </Badge>
                  </td>
                  <td className={styles.actionsCell}>
                    <Button
                      size="sm"
                      variant={vacancy.is_active ? "ghost" : "primary"}
                      disabled={toggleMutation.isPending}
                      onClick={() =>
                        toggleMutation.mutate({ id: vacancy.id, isActive: !vacancy.is_active })
                      }
                    >
                      {vacancy.is_active ? "Отключить" : "Включить"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddVacancyDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          invalidate();
        }}
      />
    </div>
  );
}

function IntakePanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ConfirmDraft | null>(null);

  const stateQuery = useQuery({
    queryKey: INTAKE_STATE_KEY,
    queryFn: fetchPublicPrivacy,
  });

  const intakeEnabled = stateQuery.data?.collection_enabled === true;

  const confirmDisable = () => {
    setDraft({
      title: "Остановить приём анкет",
      body: "Новые анкеты с сайта перестанут приниматься сразу после подтверждения. Уже отправленные данные сохраняются.",
      warning:
        "Приём анкет остановится для всех посетителей. Обратное включение возможно только через CLI командой privacy-activate — кнопки «включить» в интерфейсе нет.",
      confirmLabel: "Остановить приём",
      run: () => disableIntake(),
    });
  };

  return (
    <section className={styles.intake} aria-label="Приём анкет">
      <div className={styles.intakeInfo}>
        <h2 className={styles.intakeTitle}>Приём анкет</h2>
        <p className={styles.intakeText}>
          {stateQuery.isPending
            ? "Уточняем текущее состояние…"
            : stateQuery.isError
              ? "Не удалось получить состояние приёма."
              : intakeEnabled
                ? "Приём анкет включён: посетители могут отправлять заявки с сайта."
                : "Приём анкет уже остановлен: публичная анкета закрыта, новые заявки не принимаются. Включение — только через CLI."}
        </p>
      </div>
      <div className={styles.intakeState}>
        {stateQuery.isPending ? (
          <Badge tone="light">Проверяем…</Badge>
        ) : stateQuery.isError ? (
          <Badge tone="attention">Неизвестно</Badge>
        ) : intakeEnabled ? (
          <Badge tone="success">Включён</Badge>
        ) : (
          <Badge tone="muted">Остановлен</Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={stateQuery.isPending || stateQuery.isError || !intakeEnabled}
          onClick={confirmDisable}
        >
          Остановить приём
        </Button>
      </div>
      <ConfirmDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onDone={() => {
          setDraft(null);
          void queryClient.invalidateQueries({ queryKey: INTAKE_STATE_KEY });
        }}
      />
    </section>
  );
}

function AddVacancyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [pay, setPay] = useState("");
  const [schedule, setSchedule] = useState("");
  const [icon, setIcon] = useState("can");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDept("");
    setPay("");
    setSchedule("");
    setIcon("can");
    setSlug("");
    setSlugTouched(false);
    setPending(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const effectiveSlug = slugTouched ? slug : slugFromTitle(title);
  const slugValid = /^[a-z0-9][a-z0-9-]*$/.test(effectiveSlug) && effectiveSlug.length <= 40;

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await createAdminVacancy({
        slug: effectiveSlug,
        title: title.trim(),
        dept: dept.trim(),
        pay: pay.trim(),
        schedule: schedule.trim(),
        icon,
      });
      reset();
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить вакансию");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) {
          close();
        }
      }}
      title="Новая вакансия"
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={close} disabled={pending}>
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={pending || title.trim() === "" || !slugValid}
          >
            {pending ? "Сохраняем…" : "Добавить вакансию"}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Название" required htmlFor="vacancy-title">
          <input
            id="vacancy-title"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={150}
          />
        </Field>
        <div className={styles.formGrid}>
          <Field label="Подразделение" htmlFor="vacancy-dept">
            <input
              id="vacancy-dept"
              className={styles.input}
              value={dept}
              onChange={(event) => setDept(event.target.value)}
              maxLength={150}
            />
          </Field>
          <Field label="Оплата" htmlFor="vacancy-pay">
            <input
              id="vacancy-pay"
              className={styles.input}
              value={pay}
              onChange={(event) => setPay(event.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label="График" htmlFor="vacancy-schedule">
            <input
              id="vacancy-schedule"
              className={styles.input}
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Select
            label="Иконка"
            options={ICON_OPTIONS}
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
          />
        </div>
        <div className={styles.slugRow}>
          <Field
            label="Код (слаг)"
            htmlFor="vacancy-slug"
            hint="Постоянный адрес вакансии, изменить будет нельзя."
            error={!slugValid && effectiveSlug !== "" ? "Только латиница, цифры и дефис" : undefined}
          >
            <input
              id="vacancy-slug"
              className={styles.slugInput}
              value={effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              maxLength={40}
            />
          </Field>
          <img
            className={styles.iconPreview}
            src={brandIcons[icon as keyof typeof brandIcons] ?? brandIcons.can}
            alt=""
            width={40}
            height={40}
          />
        </div>
        {error !== null ? (
          <Alert tone="error" title="Вакансия не сохранена">
            {error}
          </Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
