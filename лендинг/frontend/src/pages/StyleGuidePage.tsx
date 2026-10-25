import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ComicHeading,
  Dialog,
  EmptyState,
  Field,
  Halftone,
  Kicker,
  PageShell,
  Pagination,
  Select,
  SkeletonBlock,
  Spinner,
  StaffNavigation,
  Starburst,
  STAGE_LABELS,
  Textarea,
  type Stage,
} from "../shared/ui";
import { brandIcons } from "../shared/assets/icons";
import styles from "./StyleGuidePage.module.css";

const TOKEN_SWATCHES = [
  { name: "red", value: "#D50032" },
  { name: "red-dk", value: "#A80027" },
  { name: "ink", value: "#2B2B2E" },
  { name: "grey", value: "#A7A9AC" },
  { name: "light", value: "#E9EAEB" },
  { name: "paper", value: "#FFFFFF" },
  { name: "green", value: "#3E9B2E" },
  { name: "amber", value: "#F2A900" },
] as const;

const STAFF_NAV_ITEMS = [
  { to: "/style", label: "Реестр", end: true },
  { to: "/style?shell=public", label: "Анкета" },
  { to: "/style?shell=staff", label: "Справочник" },
];

function TokenSection() {
  return (
    <section className={styles.section} aria-labelledby="style-tokens">
      <Kicker>Токены</Kicker>
      <ComicHeading level={2} id="style-tokens">
        Палитра кампании
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.swatches}>
          {TOKEN_SWATCHES.map((token) => (
            <span key={token.name} className={styles.swatch}>
              <span className={styles.swatchColor} style={{ background: token.value }} />
              <span className={styles.swatchName}>{token.name}</span>
              <span className={styles.swatchValue}>{token.value}</span>
            </span>
          ))}
        </div>
        <p className={styles.note}>
          Тень --shadow: 6px 6px 0 var(--ink) · Радиус --r: 4px · Шрифт: Montserrat 500–900 (self-hosted)
        </p>
      </div>
    </section>
  );
}

function TypographySection() {
  return (
    <section className={styles.section} aria-labelledby="style-type">
      <Kicker>Типографика</Kicker>
      <ComicHeading level={2} id="style-type" accent="без лишнего">
        Заголовки
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.typeSample}>
          <ComicHeading level={1}>Влейся в команду</ComicHeading>
          <ComicHeading level={2} accent="свой вкус">
            Выбери
          </ComicHeading>
          <ComicHeading level={3}>Практика и штат</ComicHeading>
          <ComicHeading level={4}>Мелкий акцент</ComicHeading>
        </div>
        <p className={styles.note}>
          Uppercase 900 только для коротких заголовков и кнопок. Данные людей (ФИО, должности) — обычный
          регистр.
        </p>
      </div>
    </section>
  );
}

function ButtonSection() {
  return (
    <section className={styles.section} aria-labelledby="style-buttons">
      <Kicker>Кнопки</Kicker>
      <ComicHeading level={2} id="style-buttons">
        Нажми меня
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.row}>
          <Button>Отправить анкету</Button>
          <Button variant="secondary">Очистить</Button>
          <Button variant="ghost">Отмена</Button>
        </div>
        <div className={styles.row}>
          <Button size="sm">Сохранить</Button>
          <Button size="sm" variant="secondary">
            В архив
          </Button>
          <Button size="sm" variant="ghost">
            Подробнее
          </Button>
          <Button disabled>Отправляем…</Button>
        </div>
        <div className={styles.row}>
          <Button block>Во всю ширину</Button>
        </div>
      </div>
    </section>
  );
}

function FormSection() {
  const [stage, setStage] = useState<Stage>("new");
  return (
    <section className={styles.section} aria-labelledby="style-forms">
      <Kicker>Поля</Kicker>
      <ComicHeading level={2} id="style-forms" accent="анкету">
        Заполни
      </ComicHeading>
      <div className={styles.demoCard}>
        <Halftone />
        <div className={styles.grid2}>
          <Field label="Фамилия" hint="Как в паспорте" error="Напиши фамилию" required>
            <input defaultValue="" />
          </Field>
          <Field label="Имя" required>
            <input defaultValue="Иван" />
          </Field>
          <Select
            label="Вакансия"
            placeholder="— не определился —"
            options={[
              { value: "lab", label: "Лаборант" },
              { value: "rozliv", label: "Оператор розлива" },
              { value: "tech", label: "Технолог" },
            ]}
          />
          <Field label="Телефон" hint="В международном формате, например +7 926 123-45-67">
            <input defaultValue="+7" inputMode="tel" />
          </Field>
          <Textarea label="О себе" placeholder="Пара предложений о твоём опыте" />
          <Checkbox label="Согласен на обработку персональных данных" error="Без согласия анкету не принять" />
        </div>
        <p className={styles.note}>
          Этап (для staff-форм): <Badge stage={stage} />
        </p>
        <Select
          label="Демо-этап"
          options={(Object.keys(STAGE_LABELS) as Stage[]).map((value) => ({
            value,
            label: STAGE_LABELS[value],
          }))}
          value={stage}
          onChange={(event) => setStage(event.target.value as Stage)}
        />
      </div>
    </section>
  );
}

function AlertSection() {
  return (
    <section className={styles.section} aria-labelledby="style-alerts">
      <Kicker>Алерты</Kicker>
      <ComicHeading level={2} id="style-alerts">
        Внимание
      </ComicHeading>
      <div className={styles.demoCard}>
        <Alert tone="info" title="Информация">
          Приём анкет идёт ежедневно, ответим в течение трёх рабочих дней.
        </Alert>
        <Alert tone="success" title="Готово">
          Анкета принята. Мы позвоним тебе на следующей неделе.
        </Alert>
        <Alert tone="warning" title="Возраст">
          На стажировку и работу берём с 18 лет.
        </Alert>
        <Alert tone="error" title="Ошибка">
          Не получилось отправить анкету. Проверь связь и попробуй ещё раз.
        </Alert>
      </div>
    </section>
  );
}

function BadgeSection() {
  return (
    <section className={styles.section} aria-labelledby="style-badges">
      <Kicker>Этапы</Kicker>
      <ComicHeading level={2} id="style-badges">
        Статусы кандидата
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.row}>
          {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
            <Badge key={stage} stage={stage} />
          ))}
          <Badge tone="outline">В архиве</Badge>
          <Badge tone="new">Горячий</Badge>
        </div>
      </div>
    </section>
  );
}

function DialogSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.section} aria-labelledby="style-dialog">
      <Kicker>Диалоги</Kicker>
      <ComicHeading level={2} id="style-dialog">
        Подтверди
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.row}>
          <Button onClick={() => setOpen(true)}>Удалить кандидата</Button>
        </div>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Удалить кандидата?"
          footer={
            <>
              <Button
                onClick={() => {
                  setOpen(false);
                }}
              >
                Удалить
              </Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Отмена
              </Button>
            </>
          }
        >
          Анкета, комментарии и история этапов будут удалены безвозвратно. Это действие доступно только
          администратору.
        </Dialog>
      </div>
    </section>
  );
}

function PaginationSection() {
  const [page, setPage] = useState(4);
  return (
    <section className={styles.section} aria-labelledby="style-pagination">
      <Kicker>Пагинация</Kicker>
      <ComicHeading level={2} id="style-pagination">
        Страницы реестра
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.row}>
          <Pagination page={page} pageSize={20} total={175} onPageChange={setPage} />
        </div>
      </div>
    </section>
  );
}

function DecorSection() {
  return (
    <section className={styles.section} aria-labelledby="style-decor">
      <Kicker>Декор</Kicker>
      <ComicHeading level={2} id="style-decor">
        Взрыв и растр
      </ComicHeading>
      <div className={styles.demoCard}>
        <div className={styles.hero}>
          <Starburst>
            <ComicHeading level={3}>Ты в деле!</ComicHeading>
          </Starburst>
        </div>
        <div className={styles.iconGrid}>
          {Object.entries(brandIcons).map(([name, src]) => (
            <span key={name} className={styles.iconCell}>
              <span className={styles.iconBadge}>
                <img src={src} alt="" />
              </span>
              {name}
            </span>
          ))}
        </div>
        <p className={styles.note}>
          Starburst/Halftone — только фоны декоративных зон, никогда под текстом input.
        </p>
      </div>
    </section>
  );
}

function StateSection() {
  return (
    <section className={styles.section} aria-labelledby="style-states">
      <Kicker>Состояния</Kicker>
      <ComicHeading level={2} id="style-states">
        Пусто и загрузка
      </ComicHeading>
      <div className={styles.demoCard}>
        <Spinner />
        <SkeletonBlock height={56} />
        <SkeletonBlock height={24} width="60%" label="Загрузка списка" />
        <EmptyState
          title="Пока никого"
          description="Как только кандидаты появятся, они покажутся здесь."
          icon="🥤"
          action={<Button variant="secondary">Обновить</Button>}
        />
      </div>
    </section>
  );
}

export function StyleGuidePage() {
  const [searchParams] = useSearchParams();
  const variant = searchParams.get("shell") === "public" ? "public" : "staff";
  return (
    <PageShell
      variant={variant}
      nav={<StaffNavigation items={STAFF_NAV_ITEMS} />}
      footer="«Очаково» — кадровый журнал. Демо-страница дизайн-системы, в навигации продакшена отсутствует."
    >
      <div className={styles.guide}>
        <Kicker>Дизайн-система · оболочка: {variant}</Kicker>
        <ComicHeading level={1} accent="в команду">
          Влейся
        </ComicHeading>
        <TokenSection />
        <TypographySection />
        <ButtonSection />
        <FormSection />
        <AlertSection />
        <BadgeSection />
        <DialogSection />
        <PaginationSection />
        <DecorSection />
        <StateSection />
      </div>
    </PageShell>
  );
}

export default StyleGuidePage;
