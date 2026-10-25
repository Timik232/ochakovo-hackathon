import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import {
  Alert,
  Button,
  Checkbox,
  ComicHeading,
  Field,
  Kicker,
  STAGE_LABELS,
  Select,
  SkeletonBlock,
  Textarea,
} from "../../shared/ui";
import { createCandidate, fetchCandidate, updateCandidate } from "./api";
import {
  candidateFormSchema,
  EMPTY_FORM_VALUES,
  EDU_VALUES,
  EMPLOYMENT_VALUES,
  formToCreatePayload,
  formToPatchPayload,
  STAFF_SOURCES,
  STAGES,
  WHO_VALUES,
  type CandidateFormValues,
} from "./formSchema";
import { EDU_LABELS, EMPLOYMENT_LABELS, isoToLocalInput, WHO_LABELS } from "./format";
import { CANDIDATES_KEY, useStaffOptions, useVacancies } from "./hooks";
import { todayMoscow } from "../application/schema";
import { CandidatesApiError, type CandidateView } from "./types";
import styles from "./CandidateFormPage.module.css";

function phoneForDisplay(phone: string): string {
  return parsePhoneNumberFromString(phone, "RU")?.formatNational() ?? phone;
}

function valuesFromCandidate(candidate: CandidateView): CandidateFormValues {
  const orEmpty = (value: string | null | undefined) => value ?? "";
  return {
    last_name: candidate.last_name,
    first_name: candidate.first_name,
    middle_name: orEmpty(candidate.middle_name),
    phone: phoneForDisplay(candidate.phone),
    telegram: candidate.telegram ? candidate.telegram.replace(/^@/, "") : "",
    email: orEmpty(candidate.email),
    age: candidate.age !== null ? String(candidate.age) : "",
    who: orEmpty(candidate.who),
    edu_level: orEmpty(candidate.edu_level),
    school: orEmpty(candidate.school),
    specialty: orEmpty(candidate.specialty),
    grad_year: candidate.grad_year !== null ? String(candidate.grad_year) : "",
    vacancy_id: candidate.vacancy_id ?? "",
    position: orEmpty(candidate.position),
    city: orEmpty(candidate.city),
    employment: orEmpty(candidate.employment),
    start_date: candidate.start_date ?? "",
    shifts: orEmpty(candidate.shifts),
    resume_url: orEmpty(candidate.resume_url),
    experience: orEmpty(candidate.experience),
    about: orEmpty(candidate.about),
    event: orEmpty(candidate.event),
    status: candidate.status,
    source: candidate.source === "public_form" ? "other" : candidate.source,
    processing_basis: candidate.processing_basis,
    processing_basis_note: orEmpty(candidate.processing_basis_note),
    department: orEmpty(candidate.department),
    responsible_id: candidate.responsible_id ?? "",
    priority: candidate.priority,
    expected_salary: candidate.expected_salary ?? "",
    interview_at: isoToLocalInput(candidate.interview_at),
    next_contact_at: isoToLocalInput(candidate.next_contact_at),
    hot: candidate.hot,
    rating: String(candidate.rating),
    next_step: orEmpty(candidate.next_step),
  };
}

export function CandidateFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const [conflict, setConflict] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const versionRef = useRef<number>(1);
  const hydratedRef = useRef(false);

  const candidateQuery = useQuery({
    queryKey: [...CANDIDATES_KEY, "detail", id],
    queryFn: () => fetchCandidate(id),
    enabled: isEdit && id !== "",
  });
  const { data: vacancies } = useVacancies();
  const { data: staffOptions } = useStaffOptions();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  // Черновик живёт в форме: гидрируем ровно один раз при загрузке карточки.
  // Повторные fetch (в т.ч. «Загрузить актуальную версию» после 409) меняют только
  // versionRef — введённые правки никогда не затираются.
  useEffect(() => {
    if (isEdit && !hydratedRef.current && candidateQuery.data) {
      hydratedRef.current = true;
      versionRef.current = candidateQuery.data.version;
      reset(valuesFromCandidate(candidateQuery.data));
    }
  }, [isEdit, candidateQuery.data, reset]);

  const loadFreshVersionKeepingDraft = async () => {
    try {
      const fresh = await fetchCandidate(id);
      versionRef.current = fresh.version;
      setConflict(
        "Актуальная версия карточки загружена, ваши правки сохранены в форме. Проверьте данные и нажмите «Сохранить изменения».",
      );
    } catch {
      setServerError("Не удалось загрузить актуальную версию. Попробуйте ещё раз.");
    }
  };

  const submit = handleSubmit(async (values) => {
    if (!isEdit && values.start_date !== "" && values.start_date < todayMoscow()) {
      setError("start_date", { message: "Дата начала работы не может быть в прошлом" });
      return;
    }
    setSubmitting(true);
    setServerError(null);
    setConflict(null);
    try {
      const saved = isEdit
        ? await updateCandidate(id, formToPatchPayload(values, versionRef.current))
        : await createCandidate(formToCreatePayload(values));
      void queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY });
      navigate(`/candidates/${saved.id}`);
    } catch (error) {
      if (error instanceof CandidatesApiError && error.isVersionConflict) {
        setConflict(
          "Карточку изменил другой сотрудник после того, как вы её открыли. Ваши правки сохранены в этой форме. Нажмите «Загрузить актуальную версию», затем сохраните снова.",
        );
      } else {
        setServerError(
          error instanceof Error ? error.message : "Не удалось сохранить. Попробуйте ещё раз.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (isEdit && candidateQuery.isPending) {
    return (
      <div className={styles.page}>
        <SkeletonBlock height={48} label="Загружаем карточку" />
        <SkeletonBlock height={420} label="Загружаем поля" />
      </div>
    );
  }

  if (isEdit && (candidateQuery.isError || candidateQuery.data === undefined)) {
    return (
      <div className={styles.page}>
        <Alert tone="error" title="Карточка не открылась">
          {candidateQuery.error instanceof Error
            ? candidateQuery.error.message
            : "Кандидат не найден."}
        </Alert>
        <div>
          <Button size="sm" variant="secondary" onClick={() => navigate("/candidates")}>
            К списку кандидатов
          </Button>
        </div>
      </div>
    );
  }

  const currentVacancyId = getValues("vacancy_id");
  const vacancyOptions = (vacancies ?? [])
    .filter((vacancy) => vacancy.is_active || vacancy.id === currentVacancyId)
    .map((vacancy) => ({ value: vacancy.id, label: vacancy.title }));

  const stageOptions = STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }));
  const whoOptions = WHO_VALUES.map((value) => ({ value, label: WHO_LABELS[value] ?? value }));
  const eduOptions = EDU_VALUES.map((value) => ({ value, label: EDU_LABELS[value] ?? value }));
  const employmentOptions = EMPLOYMENT_VALUES.map((value) => ({
    value,
    label: EMPLOYMENT_LABELS[value] ?? value,
  }));
  const responsibleOptions = (staffOptions ?? []).map((option) => ({
    value: option.id,
    label: option.name,
  }));

  return (
    <div className={styles.page}>
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link to={isEdit ? `/candidates/${id}` : "/candidates"}>
          ← {isEdit ? "К карточке" : "К кандидатам"}
        </Link>
      </nav>

      {!isEdit ? <Kicker>Стенд «Очаково» · ввод сотрудником</Kicker> : null}
      <ComicHeading level={1}>{isEdit ? "Редактировать кандидата" : "Новый кандидат"}</ComicHeading>
      {!isEdit ? (
        <p className={styles.headNote}>
          Для тех, кто подошёл к стенду, но не заполнил анкету сам: внеси данные и оставь заметку
          для HR.
        </p>
      ) : null}

      {conflict !== null ? (
        <Alert tone="warning" title="Карточка изменилась на сервере">
          {conflict}
          <div className={styles.conflictActions}>
            <Button size="sm" variant="secondary" onClick={() => void loadFreshVersionKeepingDraft()}>
              Загрузить актуальную версию
            </Button>
          </div>
        </Alert>
      ) : null}

      {serverError !== null ? (
        <Alert tone="error" title="Не удалось сохранить">
          {serverError}
        </Alert>
      ) : null}

      <form className={styles.layout} onSubmit={(event) => void submit(event)} noValidate>
        <div className={styles.formColumn}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Кандидат</h2>
          <div className={styles.fieldsGrid}>
            <Field label="Фамилия" required error={errors.last_name?.message}>
              <input className={styles.input} {...register("last_name")} />
            </Field>
            <Field label="Имя" required error={errors.first_name?.message}>
              <input className={styles.input} {...register("first_name")} />
            </Field>
            <Field label="Отчество" error={errors.middle_name?.message}>
              <input className={styles.input} {...register("middle_name")} />
            </Field>
            <Field label="Телефон" required hint="Формат +7…" error={errors.phone?.message}>
              <input className={styles.input} type="tel" {...register("phone")} />
            </Field>
            <Field label="Telegram" hint="Без @" error={errors.telegram?.message}>
              <input className={styles.input} {...register("telegram")} />
            </Field>
            <Field label="E-mail" error={errors.email?.message}>
              <input className={styles.input} type="email" {...register("email")} />
            </Field>
            <Field label="Возраст" hint="От 14 до 80" error={errors.age?.message}>
              <input className={styles.input} inputMode="numeric" {...register("age")} />
            </Field>
            <Select label="Кто такой" error={errors.who?.message} options={whoOptions} placeholder="Не указано" {...register("who")} />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Вакансия и пожелания</h2>
          <div className={styles.fieldsGrid}>
            <Select label="Вакансия" error={errors.vacancy_id?.message} options={vacancyOptions} placeholder="Не выбрана" {...register("vacancy_id")} />
            <Field label="Должность" error={errors.position?.message}>
              <input className={styles.input} {...register("position")} />
            </Field>
            <Field label="Город" error={errors.city?.message}>
              <input className={styles.input} {...register("city")} />
            </Field>
            <Select label="Образование" error={errors.edu_level?.message} options={eduOptions} placeholder="Не указано" {...register("edu_level")} />
            <Field label="Учебное заведение" error={errors.school?.message}>
              <input className={styles.input} {...register("school")} />
            </Field>
            <Field label="Специальность" error={errors.specialty?.message}>
              <input className={styles.input} {...register("specialty")} />
            </Field>
            <Field label="Год выпуска" error={errors.grad_year?.message}>
              <input className={styles.input} inputMode="numeric" {...register("grad_year")} />
            </Field>
            <Select label="Формат занятости" error={errors.employment?.message} options={employmentOptions} placeholder="Не указано" {...register("employment")} />
            <Field
              label="Готов начать с"
              hint={isEdit ? undefined : "Для нового кандидата — не в прошлом"}
              error={errors.start_date?.message}
            >
              <input className={styles.input} type="date" {...register("start_date")} />
            </Field>
            <Field label="Желаемая смена" error={errors.shifts?.message}>
              <input className={styles.input} {...register("shifts")} />
            </Field>
            <Field label="Ссылка на резюме" error={errors.resume_url?.message}>
              <input className={styles.input} type="url" {...register("resume_url")} />
            </Field>
            <Field label="Мероприятие" hint="Ярмарка вакансий, экскурсия и т.п." error={errors.event?.message}>
              <input className={styles.input} {...register("event")} />
            </Field>
            <Textarea label="Опыт работы" error={errors.experience?.message} {...register("experience")} />
            <Textarea label="О себе" error={errors.about?.message} {...register("about")} />
          </div>
        </section>

        </div>

        <aside className={styles.hrCard}>
          <h2 className={styles.hrTitle}>Для HR</h2>
          <div className={styles.hrStack}>
            <Select label="Этап" error={errors.status?.message} options={stageOptions} {...register("status")} />
            <fieldset className={styles.starsField}>
              <legend className={styles.starsLegend}>Впечатление</legend>
              <div className={styles.stars} role="radiogroup" aria-label="Оценка кандидата">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value} className={styles.star}>
                    <input
                      type="radio"
                      value={value}
                      aria-label={`Оценка ${value} из 5`}
                      onClick={(event) => {
                        if (getValues("rating") === String(value)) {
                          setValue("rating", "0", { shouldDirty: true });
                          event.currentTarget.checked = false;
                        }
                      }}
                      {...register("rating")}
                    />
                    <span aria-hidden="true">★</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.hotWrap}>
              <Checkbox label="Горячий кандидат — звонить первым" {...register("hot")} />
            </div>
            {!isEdit ? (
              <Select label="Источник" required error={errors.source?.message} options={[...STAFF_SOURCES]} {...register("source")} />
            ) : null}
            <Field label="Подразделение" error={errors.department?.message}>
              <input className={styles.input} {...register("department")} />
            </Field>
            <Select label="Ответственный" error={errors.responsible_id?.message} options={responsibleOptions} placeholder="Не назначен" {...register("responsible_id")} />
            <Select
              label="Приоритет"
              error={errors.priority?.message}
              options={[
                { value: "normal", label: "Обычный" },
                { value: "high", label: "Высокий" },
              ]}
              {...register("priority")}
            />
            <Field label="Ожидания по зарплате, ₽" error={errors.expected_salary?.message}>
              <input className={styles.input} inputMode="decimal" {...register("expected_salary")} />
            </Field>
            <Field label="Собеседование" hint="Время московское" error={errors.interview_at?.message}>
              <input className={styles.input} type="datetime-local" {...register("interview_at")} />
            </Field>
            <Field label="Следующий контакт" hint="Время московское" error={errors.next_contact_at?.message}>
              <input className={styles.input} type="datetime-local" {...register("next_contact_at")} />
            </Field>
            <Field label="Следующий шаг" error={errors.next_step?.message}>
              <input className={styles.input} {...register("next_step")} />
            </Field>
            {!isEdit ? (
              <>
                <Select
                  label="Основание"
                  required
                  error={errors.processing_basis?.message}
                  options={[
                    { value: "candidate_consent", label: "Согласие кандидата" },
                    { value: "other_documented_basis", label: "Иное документальное основание" },
                  ]}
                  {...register("processing_basis")}
                />
                <Textarea
                  label="Что за основание"
                  hint="Обязательно, если выбрано иное документальное основание"
                  error={errors.processing_basis_note?.message}
                  {...register("processing_basis_note")}
                />
              </>
            ) : null}
            <div className={styles.actions}>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Сохраняем…" : isEdit ? "Сохранить изменения" : "Добавить кандидата"}
              </Button>
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Отмена
              </Button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
