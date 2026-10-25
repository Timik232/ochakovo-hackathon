# Дизайн-система «Влейся в команду» — Очаково / Кадры

Единый источник значений — прототип v4 (`ochakovo-career/public/app.css`), перенесённый в
`src/shared/styles/tokens.css`. Правила ниже обязательны для всех страниц T7–T10.

## 1. Токены

`src/shared/styles/tokens.css` (CSS custom properties на `:root`).

### Цвета

| Токен | Значение | Назначение |
|---|---|---|
| `--red` | `#D50032` | основной бренд: шапка, первичные кнопки, активные элементы |
| `--red-dk` | `#A80027` | затемнение красного (hover-градиенты, тень на тёмном) |
| `--red-hover` | `#ED1446` | hover первичной кнопки |
| `--ink` | `#2B2B2E` | текст, рамки 3px, жёсткие тени |
| `--grey` | `#A7A9AC` | вторичный/отключённый текст, этап «Отказ» |
| `--light` | `#E9EAEB` | фон страниц |
| `--paper` | `#FFF` | карточки, поля, светлые бейджи |
| `--green` | `#3E9B2E` | успех, этап «Принят» |
| `--amber` | `#F2A900` | предупреждение, focus-обводка, «Собеседование»/«Предложение» |
| `--red-wash` | `#FFF2F5` | подложка ошибки поля / алерта |
| `--amber-wash` | `#FFF4D6` | подложка warning-алерта |
| `--green-wash` | `#F0F7EE` | подложка success-алерта |

### Тени, радиусы, рамки

| Токен | Значение | Где применять |
|---|---|---|
| `--shadow` | `6px 6px 0 var(--ink)` | карточки, панели |
| `--shadow-sm` | `4px 4px 0 var(--ink)` | кнопки, баблы (v4 `.btn`) |
| `--shadow-xs` | `3px 3px 0 var(--ink)` | мелкие элементы (кнопка size sm) |
| `--r` | `4px` | базовый радиус кнопок/полей/карточек |
| `--r-pill` | `999px` | «пилюля» бейджей/тегов |
| `--r-bubble` | `22px` | баблы игровых сцен (не используются, задел) |
| `--border` | `3px solid var(--ink)` | контур карточек/кнопок/полей |
| `--border-sm` | `2px solid var(--ink)` | тонкий контур (бейджи, chip) |

Тени всегда без blur («комиксная» жёсткость). Не заменять на `box-shadow` с размытием.

### Типографика

- Стек: `--f: "Montserrat", Arial, sans-serif` (в v4 первым идёт Proxima Nova — она не
  лицензирована, поэтому self-hosted Montserrat; NB: Arial — системный fallback, не грузится по сети).
- Начертания: 500 текст, 700 ошибки/подзаголовки, 800 лейблы/навигация, 900 заголовки/кнопки.
- Шрифты подключены в `src/shared/styles/fonts.ts` (импорты `@fontsource/montserrat`:
  cyrillic+latin × 500/700/800/900). Внешних запросов нет — woff2 лежат в бандле.

### Отступы, фокус, слои, ширины

- Отступы: `--space-1..16` — шкала с шагом 4px (4, 8, 12 … 64).
- Фокус: `--focus-outline: 3px solid var(--amber)` с `outline-offset: 2px` — только
  `:focus-visible`, янтарная обводка видна и на красном фоне.
- Слои: `--z-header: 20`, `--z-dialog: 98`, `--z-toast: 99` (значения v4).
- Ширины: `--w-public: 430px`, `--w-staff: 1440px`, `--w-min: 360px`.

## 2. Ширины и адаптив

| Контур | Макс. ширина контента | Мин. поддержка |
|---|---|---|
| Публичные страницы (`PageShell variant="public"`) | 430px | 360px без горизонтального скролла |
| Кабинет сотрудника (`PageShell variant="staff"`) | 1440px | 360px без горизонтального скролла |

Правила:

- Публичный контур — «мобильная анкета»: одна колонка, ничего шире 430px.
- Шапка (`PageShell`) на ≤700px переходит в две строки: бренд + навигация на всю ширину.
- Проверка «нет горизонтального скролла»: `document.scrollWidth <= document.clientWidth`
  при ширине окна 360px (см. evidence `task-6-computed.json`).
- Избегать фиксированных ширин >320px у контролов; `min-width: 0` для flex-потомков.

## 3. Инвентарь компонентов

Все — в `src/shared/ui`, публичный API через barrel `src/shared/ui/index.ts`.
У каждого компонента своя папка с `*.module.css`.

| Компонент | Пропсы (кратко) | Примечания |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost`, `size: md \| sm`, `block`, стандартные button-пропсы, `ref` | md = мин. высота 44px, sm = 36px; нажатие — сдвиг + уменьшение тени; `type="button"` по умолчанию |
| `Field` | `label`, `hint`, `error`, `required`; `children` — один контрол (`input`/`select`/`textarea`) | Связывает label/hint/error с контролом через `id`/`aria-describedby`/`aria-invalid`/`aria-required`; контроль (и `register` RHF) остаётся у вызывающего |
| `Select` | `options: {value,label,disabled?}[]`, `placeholder`, поля Field | Стрелка-каретка CSS-ом |
| `Textarea` | поля Field, `min-height 96px`, `resize: vertical` | |
| `Checkbox` | `label`, `error`, `checked`, `onCheckedChange` | Обёртка-`label` 24px, `accent-color: var(--red)`, клик-зона ≥44px |
| `Alert` | `tone: info \| success \| error \| warning`, `title`, `children` | `role=alert` для error/warning, `role=status` для info/success |
| `Dialog` | `open`, `onClose`, `title`, `children`, `footer`, `closeOnBackdrop` | Focus trap (Tab/Shift+Tab), Escape, возврат фокуса на триггер, `aria-modal`, блокировка скролла body |
| `Badge` | `stage: application \| new \| review \| interview \| offer \| hired \| reject \| withdrawn` или `tone` + `children` | Метки: Анкета, Новый, Рассматриваем, Собеседование, Предложение, Принят, Отказ, Снял кандидатуру; `tone="outline"` — «В архиве» |
| `Pagination` | `page`, `pageSize`, `total`, `onPageChange` | Кнопки 44px, `aria-current="page"`, статус «N–M из X», эллипсис >7 страниц (`pageWindow`) |
| `PageShell` | `variant: public \| staff`, `navSlot`, `headerExtra`, `footerSlot`, `decor?: "halftone"` | Красная шапка с рамкой 3px, текст-бренд «ОЧАКОВО / КАДРЫ», skip-link, `main#content` |
| `StaffNavigation` | `items: {to,label,end?}[]` | `aria-current` через NavLink |
| `ComicHeading` | `level: 1–4`, `accent`, `onDark`, `id` | Комикс-заголовок; красный акцент — `<ComicHeading level={2}>Влейся <span className={comicRedClass}>в команду</span></ComicHeading>` |
| `Kicker` | `children` | 12px/800/letterspacing, красный, uppercase |
| `Starburst` | `variant: paper \| ink`, `animated?` | Декор; анимация только с `animated` и только без reduced-motion |
| `Halftone` | — | Декор-точки; родитель обязан быть `position: relative`, контент — выше слоем |
| `EmptyState` | `title`, `description`, `icon`, `action` | Пустые списки/фильтры |
| `Spinner` | `label` (по умолчанию «Загрузка…») | `role=status`; при reduced-motion квадрат статичен |
| `SkeletonBlock` | `height`, `width`, `label` | `role=status` + `aria-label`; shimmer отключается при reduced-motion |

Иконки позиций: `src/shared/assets/icons` (`brandIcons`: bottle, can, crate, funnel, hops,
kettle, tank, wheat). PNG из прототипа, предоставлены владельцем проекта. `logo.png` не
используется: в приложении — текстовая идентификация «ОЧАКОВО / КАДРЫ».

## 4. Комикс-стиль vs обычный текст

**ВЕРХНИЙ РЕГИСТР (900) — только короткие заголовки и кнопки:**

- `ComicHeading` — заголовки секций/страниц (до ~40 символов).
- Подписи кнопок (`Button` сам приводит текст к uppercase).
- `Kicker` — надзаголовок-рубрика.
- Лейблы полей и навигация — uppercase 800 (как в v4), но это служебные 1–2 слова.

**Никогда не uppercase:**

- Данные людей: ФИО, комментарии, заметки, письма — только обычный регистр.
- Длинные абзацы, описания вакансий, тексты ошибок в алертах.
- Не увеличивать 900-й вес для текста — только заголовки/кнопки.

Красный текст с чернильной тенью (`comicRedClass`) — только внутри ComicHeading/лапки
декоративных акцентов, не для рабочих ссылок.

## 5. Декоративные паттерны

- `Halftone` (растр-точки) и лучи/градиенты фона — **только за контентом**:
  родитель `position: relative`, декор `aria-hidden` и `z-index: 0`, контент выше.
- **Никогда не размещать растр под текстом полей ввода** (input/select/textarea) —
  шум точек снижает читаемость и контраст.
- `Starburst` — акцент на hero-блоках и пустых состояниях; не перекрывает текст.
- Плотность точек/цвет растра не менять локально — значения из модулей компонентов.

## 6. Контракт доступности

- **Цели нажатия ≥44×44px** (кнопки md, пагинация, чекбоксы через клик-зону label).
- **Видимый фокус**: `:focus-visible` — янтарная обводка 3px, offset 2px. Не убирать
  `outline` без замены.
- **Клавиатура**: все интерактивные элементы — нативные (`button`, `a`, `input`) либо
  `Dialog` с trap; Escape закрывает диалог, фокус возвращается на триггер.
- **`prefers-reduced-motion`**: отключаются press-сдвиг кнопок, breathe-анимация
  Starburst, вращение Spinner (квадрат статичен), shimmer скелетонов, все transitions
  (глобально в reset.css).
- **Роли**: ошибки — `role=alert`; статусы загрузки — `role=status`; диалог —
  `role=dialog aria-modal`; текущая страница — `aria-current`.
- Проверка регресса: `tests/design-system.test.tsx` (axe на fixture `/style` —
  0 нарушений уровня serious/critical).

## 7. Шрифты

- Пакет `@fontsource/montserrat`, импорты в `src/shared/styles/fonts.ts`:
  `@fontsource/montserrat/{cyrillic,latin}-{500,700,800,900}.css` — 8 файлов,
  каждый тащит только свой subset+weight.
- Подключение в `src/main.tsx` строго ДО `app.css`.
- Внешних CDN/запросов шрифтов в рантайме нет (проверяется отсутствием ссылок на
  fonts.googleapis и т.п. в `dist/`).
- Добавление веса = добавить одну строку импорта subset-weight, не глобальный css.

## 8. Fixture `/style`

- Дев/тест-маршрут (`import.meta.env.DEV`), в prod-бандл не попадает (проверено).
- `?shell=public` — узкий контур 430px, по умолчанию staff 1440px.
- Назначение: визуальная проверка компонентов + скриншоты evidence + axe.
