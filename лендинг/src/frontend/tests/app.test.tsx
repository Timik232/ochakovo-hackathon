import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../src/app/providers";
import { RootPage } from "../src/pages/RootPage";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<RootPage />} path="/" />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("App shell", () => {
  it("рендерит маршрутизацию и провайдеры", async () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: /Влейся в команду «Очаково»/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Сервис работает")).toBeInTheDocument();
  });

  it("структура лендинга соответствует прототипу v4", async () => {
    renderApp();

    expect(screen.getByRole("navigation", { name: "Разделы лендинга" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Почему мы" })).toHaveAttribute("href", "#why");
    expect(screen.getByRole("link", { name: "Профессии" })).toHaveAttribute("href", "#jobs");
    expect(screen.getByRole("link", { name: "Условия" })).toHaveAttribute("href", "#perks");
    expect(screen.getByRole("link", { name: "Рост" })).toHaveAttribute("href", "#grow");

    expect(screen.getAllByText("Время сменить карьерный вкус")).toHaveLength(2);
    expect(screen.getAllByText("Не краш, но стабильный партнёр")).toHaveLength(2);
    expect(screen.getAllByText("Влейся в команду «Очаково»").length).toBeGreaterThanOrEqual(2);

    expect(screen.getByRole("heading", { name: /Работа без лишнего в составе/i })).toBeInTheDocument();
    expect(screen.getByText("Что думают о заводе")).toBeInTheDocument();
    expect(screen.getByText("Что отвечаем мы")).toBeInTheDocument();
    expect(screen.getByText("Наша цель")).toBeInTheDocument();

    expect(screen.getAllByText("Как есть").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Стабильно").length).toBeGreaterThan(0);

    expect(screen.getByRole("heading", { name: /Выбери свой вкус карьеры/i })).toBeInTheDocument();
    expect(screen.getByText("Оплачиваемая практика с марта–апреля до июля–августа. После — можно остаться в штате.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Хочу в лабораторию" })).toHaveAttribute(
      "href",
      "/apply?v=lab",
    );

    expect(screen.getByRole("heading", { name: /Что в составе/i })).toBeInTheDocument();
    expect(screen.getByText("Всё, что ты получаешь на практике, — честно и в рублях.")).toBeInTheDocument();
    expect(screen.getByText("Общежитие")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /Расти, даже если ты не дрожжи/i })).toBeInTheDocument();
    expect(screen.getByText("Практика")).toBeInTheDocument();
    expect(screen.getByText("Мастер")).toBeInTheDocument();

    expect(screen.getByText("Комбинат открылся к Олимпиаде-80")).toBeInTheDocument();
    expect(screen.getByText("1978")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Время сменить карьерный вкус/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Заполнить анкету за 2 минуты" })).toHaveAttribute(
      "href",
      "/apply",
    );
    const hh = screen.getByRole("link", { name: "Вакансии на hh.ru" });
    expect(hh).toHaveAttribute("href", "https://hh.ru/employer/871");
    expect(hh).toHaveAttribute("target", "_blank");
    expect(hh).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("link", { name: "ochakovo.ru/rabota" })).toHaveAttribute(
      "href",
      "https://ochakovo.ru/rabota/",
    );
    expect(screen.getByRole("link", { name: "Политика обработки данных" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(await screen.findByText("Сервис работает")).toBeInTheDocument();
  });
});
