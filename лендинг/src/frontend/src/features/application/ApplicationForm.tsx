import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { submitApplication } from "./api";
import {
  EDU_LEVEL_OPTIONS,
  EMPLOYMENT_OPTIONS,
  HONEYPOT_FIELD,
  WHO_OPTIONS,
  applicationSchema,
  buildPayload,
  gradYearOptions,
  todayMoscow,
  type ApplicationFormValues,
} from "./schema";
import type { PublicPrivacy, PublicVacancy } from "./types";
import { randomUUID } from "../../shared/lib/uuid";
import fieldStyles from "../../shared/ui/Field/Field.module.css";
import { Alert, Button, Checkbox, ComicHeading, Field, Select, Textarea } from "../../shared/ui";
import styles from "./ApplyPage.module.css";

const CONSENT_FALLBACK =
  "Согласен на обработку персональных данных для связи по вакансиям и практике.";

const SHIFTS_OPTIONS = ["Только дневные", "Можно с ночными", "Без разницы"] as const;

function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionNum} aria-hidden="true">
        {n}
      </span>
      <ComicHeading level={3}>{title}</ComicHeading>
    </div>
  );
}

interface Notice {
  tone: "error" | "warning" | "info";
  title: string;
  text?: string;
  retry?: boolean;
}

export interface ApplicationFormProps {
  vacancies: PublicVacancy[];
  vacanciesPending: boolean;
  vacanciesError: boolean;
  onVacanciesRetry: () => void;
  privacy: PublicPrivacy;
  preselectSlug: string;
  event: string;
  onIntakeClosed: () => void;
  onPolicyRefresh: () => Promise<unknown>;
}

export function ApplicationForm({
  vacancies,
  vacanciesPending,
  vacanciesError,
  onVacanciesRetry,
  privacy,
  preselectSlug,
  event,
  onIntakeClosed,
  onPolicyRefresh,
}: ApplicationFormProps) {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice | null>(null);
  const idempotencyKeyRef = useRef<string>(randomUUID());
  const inFlightRef = useRef(false);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const preselectAppliedRef = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      last_name: "",
      first_name: "",
      middle_name: "",
      age: "",
      who: "",
      phone: "",
      telegram: "",
      email: "",
      edu_level: "",
      school: "",
      specialty: "",
      grad_year: "",
      vacancy_id: "",
      employment: "",
      start_date: "",
      shifts: "",
      resume_url: "",
      experience: "",
      about: "",
      consent: false,
    },
  });

  const ageRaw = watch("age");
  const ageNumber = Number(ageRaw);
  const showAgeNote = ageRaw.trim() !== "" && Number.isFinite(ageNumber) && ageNumber >= 1 && ageNumber < 18;

  useEffect(() => {
    if (preselectAppliedRef.current || preselectSlug === "" || vacancies.length === 0) {
      return;
    }
    const hit = vacancies.find((vacancy) => vacancy.slug === preselectSlug);
    if (hit !== undefined && getValues("vacancy_id") === "") {
      setValue("vacancy_id", hit.id);
    }
    preselectAppliedRef.current = true;
  }, [preselectSlug, vacancies, getValues, setValue]);

  const onValid = async (values: ApplicationFormValues) => {
    if (inFlightRef.current) {
      return;
    }
    if ((honeypotRef.current?.value ?? "").trim() !== "") {
      navigate("/apply/success", { replace: true });
      return;
    }
    inFlightRef.current = true;
    setNotice(null);
    try {
      const result = await submitApplication(
        buildPayload(values, event, privacy.revision),
        idempotencyKeyRef.current,
      );
      if (result.ok) {
        idempotencyKeyRef.current = randomUUID();
        navigate("/apply/success", { replace: true });
        return;
      }
      switch (result.kind) {
        case "validation": {
          const formFieldNames = new Set(
            Object.keys(values) as Array<keyof ApplicationFormValues>,
          );
          const foreign: string[] = [];
          for (const [name, message] of Object.entries(result.fieldErrors)) {
            if (formFieldNames.has(name as keyof ApplicationFormValues)) {
              setError(name as keyof ApplicationFormValues, { type: "server", message });
            } else {
              foreign.push(message);
            }
          }
          setNotice({
            tone: "error",
            title: "Проверь выделенные поля",
            text: foreign.length > 0 ? foreign.join(" ") : undefined,
          });
          break;
        }
        case "rate_limited":
          setNotice({
            tone: "error",
            title: "Слишком много анкет с этого устройства. Попробуй позже.",
            text:
              result.retryAfterSeconds !== null
                ? `Подожди примерно ${result.retryAfterSeconds} с и попробуй снова.`
                : "Подожди немного и попробуй снова.",
          });
          break;
        case "intake_closed":
          onIntakeClosed();
          break;
        case "revision_changed":
          await onPolicyRefresh();
          // Backend checks idempotency replay BEFORE the revision gate: the same key
          // with a changed payload (new privacy_revision) would 409 IDEMPOTENCY_CONFLICT.
          // A re-consented submit is a genuinely new payload → new key.
          idempotencyKeyRef.current = randomUUID();
          setValue("consent", false, { shouldDirty: true });
          setNotice({
            tone: "warning",
            title: "Политика обработки данных обновилась",
            text: "Прочитай новую редакцию и подтверди согласие ещё раз — всё, что ты заполнил, осталось на месте.",
          });
          break;
        case "network":
          setNotice({
            tone: "error",
            title: "Не получилось отправить",
            text: "Проверь интернет и нажми «Отправить ещё раз» — поля заполнены, анкета никуда не пропала.",
            retry: true,
          });
          break;
        case "http_error":
          setNotice({
            tone: "error",
            title: result.message,
            text: "Попробуй ещё раз чуть позже.",
            retry: true,
          });
          break;
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const consentLabel: ReactNode = (
    <>
      {privacy.consent ?? CONSENT_FALLBACK}{" "}
      <Link to="/privacy" className={styles.policyLink}>
        Подробнее — в политике
      </Link>
    </>
  );

  return (
    <form className={styles.formCard} noValidate onSubmit={handleSubmit(onValid)}>
      {notice !== null ? (
        <div className={styles.notice}>
          <Alert tone={notice.tone} title={notice.title}>
            {notice.text}
            {notice.retry === true ? (
              <div className={styles.noticeRetry}>
                <Button size="sm" variant="secondary" type="submit">
                  Отправить ещё раз
                </Button>
              </div>
            ) : null}
          </Alert>
        </div>
      ) : null}

      <section className={styles.section}>
        <SectionHead n={1} title="Выбери вакансию" />
        {vacanciesError ? (
          <Alert tone="error" title="Не удалось загрузить вакансии">
            Проверь интернет и обнови список — без вакансии анкету не отправить.
            <div className={styles.noticeRetry}>
              <Button size="sm" variant="secondary" type="button" onClick={onVacanciesRetry}>
                Загрузить ещё раз
              </Button>
            </div>
          </Alert>
        ) : null}
        <fieldset className={styles.vacsGroup}>
          <legend className={styles.chipsLegend}>
            Вакансия<i className={fieldStyles.mark} aria-hidden="true">{" *"}</i>
          </legend>
          <div className={styles.vacs}>
            {vacancies.length === 0 && vacanciesPending ? (
              <p className={styles.vacsPending}>Загружаем вакансии…</p>
            ) : (
              vacancies.map((vacancy) => (
                <label key={vacancy.id} className={styles.vac}>
                  <input
                    type="radio"
                    value={vacancy.id}
                    disabled={vacanciesPending || vacanciesError}
                    {...register("vacancy_id")}
                  />
                  <span>
                    {vacancy.icon !== "" ? (
                      <i className={styles.vacIco} aria-hidden="true">
                        <img src={`/img/${vacancy.icon}.png`} alt="" />
                      </i>
                    ) : null}
                    <b>{vacancy.title}</b>
                    <small>{[vacancy.dept, vacancy.pay].filter(Boolean).join(" · ")}</small>
                  </span>
                </label>
              ))
            )}
          </div>
          {errors.vacancy_id !== undefined ? (
            <p className={fieldStyles.error} role="alert">
              {errors.vacancy_id.message}
            </p>
          ) : null}
        </fieldset>
      </section>

      <section className={styles.section}>
        <SectionHead n={2} title="Кто ты" />
        <Field label="Фамилия" required error={errors.last_name?.message}>
          <input
            className={fieldStyles.control}
            type="text"
            autoComplete="family-name"
            placeholder="Смирнова"
            maxLength={100}
            {...register("last_name")}
          />
        </Field>
        <Field label="Имя" required error={errors.first_name?.message}>
          <input
            className={fieldStyles.control}
            type="text"
            autoComplete="given-name"
            placeholder="Анна"
            maxLength={100}
            {...register("first_name")}
          />
        </Field>
        <Field label="Отчество" error={errors.middle_name?.message}>
          <input
            className={fieldStyles.control}
            type="text"
            autoComplete="additional-name"
            placeholder="Сергеевна"
            maxLength={100}
            {...register("middle_name")}
          />
        </Field>
        <Field label="Возраст" required error={errors.age?.message}>
          <input
            className={fieldStyles.control}
            type="number"
            inputMode="numeric"
            min={14}
            max={80}
            placeholder="19"
            {...register("age")}
          />
        </Field>
        {showAgeNote && errors.age === undefined ? (
          <p className={styles.ageNote} role="status">
            На стажировку и работу берём с 18 лет.
          </p>
        ) : null}
        <fieldset className={styles.chipsGroup} aria-label="Кто ты сейчас">
          <legend className={styles.chipsLegend}>
            Кто ты сейчас<i className={fieldStyles.mark} aria-hidden="true">{" *"}</i>
          </legend>
          <div className={styles.chips}>
            {WHO_OPTIONS.map((option) => (
              <label key={option.value} className={styles.chip}>
                <input type="radio" value={option.value} {...register("who")} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.who !== undefined ? (
            <p className={fieldStyles.error} role="alert">
              {errors.who.message}
            </p>
          ) : null}
        </fieldset>
        <Field
          label="Телефон"
          required
          hint="Формат: +7 900 000-00-00"
          error={errors.phone?.message}
        >
          <input
            className={fieldStyles.control}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 900 000-00-00"
            maxLength={32}
            {...register("phone")}
          />
        </Field>
        <Field
          label="Telegram"
          hint="Ник в Telegram, если тебе туда удобнее"
          error={errors.telegram?.message}
        >
          <input
            className={fieldStyles.control}
            type="text"
            autoComplete="off"
            placeholder="@nickname"
            maxLength={64}
            {...register("telegram")}
          />
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          <input
            className={fieldStyles.control}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="anna@mail.ru"
            maxLength={254}
            {...register("email")}
          />
        </Field>
        <Select
          label="Уровень образования"
          placeholder="— выбери —"
          options={[...EDU_LEVEL_OPTIONS]}
          error={errors.edu_level?.message}
          {...register("edu_level")}
        />
        <Field
          label="Учебное заведение"
          hint="Вуз, колледж или школа"
          error={errors.school?.message}
        >
          <input
            className={fieldStyles.control}
            type="text"
            placeholder="МГУПП, РХТУ им. Менделеева, колледж…"
            maxLength={200}
            {...register("school")}
          />
        </Field>
        <Field label="Направление / специальность" error={errors.specialty?.message}>
          <input
            className={fieldStyles.control}
            type="text"
            placeholder="Биотехнология, пищевые производства…"
            maxLength={200}
            {...register("specialty")}
          />
        </Field>
        <Select
          label="Год выпуска"
          placeholder="— год —"
          options={[...gradYearOptions()]}
          error={errors.grad_year?.message}
          {...register("grad_year")}
        />
      </section>

      <section className={styles.section}>
        <SectionHead n={3} title="Чего хочешь" />
        <fieldset className={styles.chipsGroup}>
          <legend className={styles.chipsLegend}>Что интересно</legend>
          <div className={styles.chips}>
            {EMPLOYMENT_OPTIONS.map((option) => (
              <label key={option.value} className={styles.chip}>
                <input type="radio" value={option.value} {...register("employment")} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.employment !== undefined ? (
            <p className={fieldStyles.error} role="alert">
              {errors.employment.message}
            </p>
          ) : null}
        </fieldset>
        <Field
          label="Когда готов приступить"
          error={errors.start_date?.message}
        >
          <input
            className={fieldStyles.control}
            type="date"
            min={todayMoscow()}
            {...register("start_date")}
          />
        </Field>
        <fieldset className={styles.chipsGroup}>
          <legend className={styles.chipsLegend}>Смены</legend>
          <div className={styles.chips}>
            {SHIFTS_OPTIONS.map((option) => (
              <label key={option} className={styles.chip}>
                <input type="radio" value={option} {...register("shifts")} />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {errors.shifts !== undefined ? (
            <p className={fieldStyles.error} role="alert">
              {errors.shifts.message}
            </p>
          ) : null}
        </fieldset>
        <Field
          label="Ссылка на резюме"
          hint="https:// — ссылка на hh.ru, Яндекс Диск или Google Drive"
          error={errors.resume_url?.message}
        >
          <input
            className={fieldStyles.control}
            type="url"
            inputMode="url"
            placeholder="https://hh.ru/resume/…"
            maxLength={500}
            {...register("resume_url")}
          />
        </Field>
        <Textarea
          label="Опыт работы"
          placeholder="Где работал, практика, подработки. Если опыта нет — так и напиши, это нормально"
          maxLength={2000}
          error={errors.experience?.message}
          {...register("experience")}
        />
        <Textarea
          label="Пара слов о себе"
          placeholder="Чем увлекаешься, что хочешь попробовать на заводе"
          maxLength={2000}
          error={errors.about?.message}
          {...register("about")}
        />
      </section>

      <div className={styles.honey} aria-hidden="true">
        <input
          ref={honeypotRef}
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className={styles.consentBlock}>
        <Checkbox label={consentLabel} error={errors.consent?.message} {...register("consent")} />
        {privacy.revision !== null && privacy.revision !== undefined ? (
          <p className={styles.revision}>Редакция политики: {String(privacy.revision)}</p>
        ) : null}
      </div>

      <div className={styles.submitRow}>
        <Button type="submit" block className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? "Отправляем…" : "Отправить анкету"}
        </Button>
        <p className={styles.requiredNote}>
          Поля со <span className={styles.requiredStar} aria-hidden="true">*</span>звёздочкой
          обязательны
        </p>
      </div>
    </form>
  );
}
