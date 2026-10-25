import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { apiClient } from "../../api/client";
import { fetchPublicVacancies } from "../application/api";
import type { PublicVacancy } from "../application/types";
import { Alert, Button, EmptyState, Spinner, Starburst } from "../../shared/ui";
import { cx } from "../../shared/lib/cx";
import {
  HeroBottle,
  HeroFlash,
  LandingArtDefs,
  PillarIcon,
  StickerArrow,
  StickerCap,
  StickerHeart,
  StickerSpark,
  VacancyArt,
} from "./landingArt";
import {
  FACTS,
  HH_VACANCIES_HREF,
  LADDER,
  OCHAKOVO_RABOTA_HREF,
  PERKS,
  PILLARS,
  TICKER_SLOGANS,
  scheduleChips,
  vacancyArtAria,
  vacancyMeta,
} from "./landingContent";
import styles from "./LandingPage.module.css";

const NAV_LINKS = [
  { href: "#why", label: "Почему мы" },
  { href: "#jobs", label: "Профессии" },
  { href: "#perks", label: "Условия" },
  { href: "#grow", label: "Рост" },
] as const;

function healthText(state: "pending" | "error" | "ok"): string {
  if (state === "pending") return "Проверка сервиса…";
  if (state === "error") return "Сервис недоступен";
  return "Сервис работает";
}

function SectionTitle({ accent, tail, children }: { accent: string; tail?: string; children: ReactNode }) {
  return (
    <h2 className={styles.h2}>
      {children} <span className={styles.r}>{accent}</span>
      {tail ? ` ${tail}` : null}
    </h2>
  );
}

function CountUpFact({ from, to, suffix }: { from: number; to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const canAnimate =
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      "IntersectionObserver" in window;
    if (!canAnimate) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / 1100);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(from + (to - from) * eased));
          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [from, to]);

  return (
    <b ref={ref}>
      {value}
      {suffix}
    </b>
  );
}

function VacancyCard({ vacancy }: { vacancy: PublicVacancy }) {
  const meta = vacancyMeta(vacancy.slug);
  const schedule = scheduleChips(vacancy.schedule);
  return (
    <article className={styles.job}>
      <div className={styles.art}>
        <span className={styles.place}>{vacancy.dept || "Очаково"}</span>
        <VacancyArt slug={vacancy.slug} label={vacancyArtAria(vacancy.slug)} />
      </div>
      <div className={styles.body}>
        <h3>{vacancy.title}</h3>
        {meta.description !== null ? <p className={styles.desc}>{meta.description}</p> : null}
        <div className={styles.facts}>
          <span className={styles.pay}>{vacancy.pay ?? "по договорённости"}</span>
          {schedule.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <Link
          to={`/apply?v=${encodeURIComponent(vacancy.slug)}`}
          className={cx(styles.btnInk, styles.btnSm, styles.jobCta)}
        >
          {meta.ctaLabel}
        </Link>
      </div>
    </article>
  );
}

export function LandingPage() {
  const healthQuery = useQuery({
    queryKey: ["health", "live"],
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/health/live");
      if (!data) {
        throw new Error("Пустой ответ сервиса");
      }
      return data;
    },
  });
  const vacanciesQuery = useQuery({
    queryKey: ["public", "vacancies"],
    queryFn: async (): Promise<PublicVacancy[]> => fetchPublicVacancies(),
    retry: false,
  });

  const healthState =
    healthQuery.isPending ? "pending" : healthQuery.isError || healthQuery.data.status !== "ok" ? "error" : "ok";

  const vacancies = vacanciesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#landing-main">
        Перейти к содержимому
      </a>
      <LandingArtDefs />

      <div className={`${styles.band} ${styles.red} ${styles.topBand}`}>
        <header className={styles.navPill}>
          <Link to="/" className={styles.brand} aria-label="Очаково — на главную">
            <img src="/img/logo.png" alt="Очаково. Натуральные напитки" />
          </Link>
          <nav aria-label="Разделы лендинга">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <Link to="/apply" className={styles.navCta}>
            Заполнить анкету
          </Link>
        </header>

        <section className={styles.stage} aria-labelledby="landing-title">
          <h1 className={styles.srOnly} id="landing-title">
            Влейся в команду «Очаково» — стажировки и работа для студентов и выпускников
          </h1>
          <div className={`${styles.w} ${styles.w1}`} aria-hidden="true">
            <span>Влейся</span>
          </div>
          <div className={styles.prod} aria-hidden="true">
            <HeroFlash className={styles.flash} />
            <HeroBottle className={styles.bottle} />
            <i className={`${styles.bub} ${styles.b1}`} />
            <i className={`${styles.bub} ${styles.b2}`} />
            <i className={`${styles.bub} ${styles.b3}`} />
            <i className={`${styles.bub} ${styles.b4}`} />
          </div>
          <div className={`${styles.w} ${styles.w2}`} aria-hidden="true">
            <em>в</em>
            <span>команду</span>
            <small>«Очаково»</small>
          </div>

          <StickerHeart className={`${styles.st} ${styles.stHeart}`} />
          <div className={`${styles.st} ${styles.stSay}`} aria-hidden="true">
            Твой потенциал — наш любимый ингредиент
          </div>
          <StickerArrow className={`${styles.st} ${styles.stArrow}`} />
          <StickerCap className={`${styles.st} ${styles.stCap}`} />
          <StickerSpark className={`${styles.st} ${styles.stSpark} ${styles.s1}`} />
          <StickerSpark className={`${styles.st} ${styles.stSpark} ${styles.s2}`} />

          <div className={styles.ctaRow}>
            <p>Стажировки и работа для студентов и выпускников. Практика оплачиваемая, всё официально по ТК.</p>
            <Link to="/apply" className={cx(styles.btnInk, styles.btnBig)}>
              Заполнить анкету
            </Link>
          </div>
        </section>
      </div>

      <div className={styles.ticker} aria-label="Слоганы кампании">
        <div className={styles.track}>
          {TICKER_SLOGANS.map((slogan) => (
            <span key={slogan}>{slogan}</span>
          ))}
          {TICKER_SLOGANS.map((slogan) => (
            <span key={`${slogan}-copy`} aria-hidden="true">
              {slogan}
            </span>
          ))}
        </div>
      </div>

      <main id="landing-main">
        <section className={styles.panel} id="why">
          <div className={styles.inner}>
            <SectionTitle accent="без лишнего в составе">Работа</SectionTitle>
            <div className={styles.idea}>
              <div className={styles.think}>
                <small>Что думают о заводе</small>
                «Завод — тяжело и серо. А правду о работе узнаю только на испытательном сроке»
              </div>
              <div className={styles.say}>
                <small>Что отвечаем мы</small>
                «Очаково» делает натуральные напитки без лишнего в составе. Так же говорим о работе: график, деньги
                и ночные смены — честно и до того, как ты отправишь заявку.
              </div>
            </div>
            <div className={styles.goal}>
              <span className={styles.tag}>Наша цель</span>
              <p>
                Чтобы студенты и выпускники хотели работать в «Очаково» не только ради зарплаты, а потому что здесь
                честно, стабильно, о тебе заботятся и есть куда расти.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.panel} style={{ paddingTop: 0 }}>
          <div className={styles.inner}>
            <ul className={styles.pillars}>
              {PILLARS.map((pillar) => (
                <li key={pillar.key} className={styles.pillar}>
                  <i className={styles.pillarIcon}>
                    <PillarIcon name={pillar.key} />
                  </i>
                  <b>{pillar.title}</b>
                  <p>{pillar.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.panel} id="jobs" style={{ paddingTop: 20 }}>
          <div className={styles.inner}>
            <SectionTitle accent="свой вкус" tail="карьеры">Выбери</SectionTitle>
            <p className={styles.intro}>
              Оплачиваемая практика с марта–апреля до июля–августа. После — можно остаться в штате.
            </p>

            {vacanciesQuery.isPending ? (
              <Spinner label="Загружаем вакансии…" />
            ) : vacanciesQuery.isError ? (
              <Alert tone="error" title="Не удалось загрузить вакансии">
                Проверь интернет и попробуй ещё раз.
                <div>
                  <Button size="sm" variant="secondary" onClick={() => void vacanciesQuery.refetch()}>
                    Попробовать ещё раз
                  </Button>
                </div>
              </Alert>
            ) : vacancies.length === 0 ? (
              <EmptyState
                title="Открытых вакансий пока нет"
                description="Но анкету уже можно оставить — вернёмся к ней, когда откроется приём."
                action={
                  <Link to="/apply" className={cx(styles.btnInk, styles.btnSm)}>
                    Заполнить анкету
                  </Link>
                }
              />
            ) : (
              <ul className={styles.jobs}>
                {vacancies.map((vacancy) => (
                  <li key={vacancy.id}>
                    <VacancyCard vacancy={vacancy} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.panel} id="perks" style={{ paddingTop: 20 }}>
          <div className={styles.inner}>
            <SectionTitle accent="в составе">Что</SectionTitle>
            <p className={styles.intro}>Всё, что ты получаешь на практике, — честно и в рублях.</p>
            <ul className={styles.perks}>
              {PERKS.map((perk) => (
                <li key={perk.title} className={styles.perk}>
                  <i>{perk.badge}</i>
                  <div>
                    <b>{perk.title}</b>
                    <span>{perk.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.panel} id="grow" style={{ paddingTop: 20 }}>
          <div className={styles.inner}>
            <SectionTitle accent="даже если ты не дрожжи">Расти,</SectionTitle>
            <p className={styles.intro}>
              Берём, чтобы учить и оставлять. Каждая ступень — понятная, с наставником рядом.
            </p>
            <ol className={styles.ladder}>
              {LADDER.map((step) => (
                <li key={step.n} className={styles.step} data-n={step.n}>
                  <b>{step.title}</b>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.panel} style={{ paddingTop: 20 }}>
          <div className={styles.inner}>
            <ul className={styles.factsRow}>
              {FACTS.map((fact) => (
                <li key={fact.label} className={styles.fact}>
                  {fact.kind === "count" ? (
                    <CountUpFact from={fact.from} to={fact.to} suffix={fact.suffix} />
                  ) : (
                    <b>{fact.value}</b>
                  )}
                  <span>{fact.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className={`${styles.band} ${styles.red}`}>
          <div className={`${styles.inner} ${styles.final}`}>
            <Starburst animated className={styles.burst}>
              <h2 className={styles.h2}>
                Время <span className={styles.r}>сменить</span> карьерный вкус
              </h2>
            </Starburst>
            <p>Оставь анкету — HR «Очаково» позвонит, расскажет про смены и пригласит на завод.</p>
            <div className={styles.ctas}>
              <Link to="/apply" className={styles.btnInk}>
                Заполнить анкету за 2 минуты
              </Link>
              <a
                className={styles.btnBigWhite}
                href={HH_VACANCIES_HREF}
                target="_blank"
                rel="noopener noreferrer"
              >
                Вакансии на hh.ru
              </a>
            </div>
          </div>
          <div className={styles.inner}>
            <footer className={styles.foot}>
              <img className={styles.logo} src="/img/logo.png" alt="Очаково" />
              <a href={OCHAKOVO_RABOTA_HREF} target="_blank" rel="noopener noreferrer">
                ochakovo.ru/rabota
              </a>
              <div className={styles.footNote}>
                <Link className={styles.footPolicy} to="/privacy">
                  Политика обработки данных
                </Link>
                <p className={styles.footHealth}>{healthText(healthState)}</p>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
