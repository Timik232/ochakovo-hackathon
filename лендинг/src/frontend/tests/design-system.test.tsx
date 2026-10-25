import axe from "axe-core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  PageShell,
  Pagination,
  SkeletonBlock,
  Spinner,
  STAGE_LABELS,
  StaffNavigation,
  type Stage,
} from "../src/shared/ui";
import { StyleGuidePage } from "../src/pages/StyleGuidePage";

describe("Button", () => {
  it("активируется с клавиатуры Enter и Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Отправить</Button>);
    const button = screen.getByRole("button", { name: "Отправить" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("заблокированная кнопка не срабатывает и сообщает состояние", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} aria-live="polite">
        Отправляем…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Отправляем…" }) as HTMLButtonElement;
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Field", () => {
  it("связывает label, hint и error с контролом", () => {
    render(
      <Field label="Фамилия" hint="Как в паспорте" error="Напиши фамилию" required>
        <input defaultValue="" />
      </Field>,
    );
    const input = screen.getByLabelText(/фамилия/i);
    expect(input).toHaveAccessibleDescription("Как в паспорте Напиши фамилию");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("Напиши фамилию")).toBeInTheDocument();
  });

  it("checkbox связывает ошибку с input", () => {
    render(
      <Checkbox label="Согласен на обработку данных" error="Без согласия не принять" />,
    );
    const box = screen.getByLabelText("Согласен на обработку данных");
    expect(box).toHaveAccessibleDescription("Без согласия не принять");
    expect(box).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Alert", () => {
  it("ошибка и предупреждение объявляются с role=alert", () => {
    const { rerender } = render(<Alert tone="error">Проверь связь</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Проверь связь");
    rerender(<Alert tone="warning">Возраст</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Возраст");
  });

  it("информация и успех объявляются с role=status", () => {
    const { rerender } = render(<Alert tone="info">Приём открыт</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Приём открыт");
    rerender(<Alert tone="success">Анкета принята</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Анкета принята");
  });
});

describe("Badge", () => {
  it("отображает русские подписи всех восьми этапов", () => {
    for (const [stage, label] of Object.entries(STAGE_LABELS) as Array<[Stage, string]>) {
      const { unmount } = render(<Badge stage={stage} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("разные этапы получают разные оформления, архив — отдельный тон", () => {
    const { container: withNew } = render(<Badge stage="new" />);
    const { container: withHired } = render(<Badge stage="hired" />);
    const { container: archived } = render(<Badge tone="outline">В архиве</Badge>);
    expect(withNew.firstElementChild?.className).not.toBe(withHired.firstElementChild?.className);
    expect(archived.firstElementChild).toHaveTextContent("В архиве");
  });
});

describe("Pagination", () => {
  it("рендерит страницы и переключает их", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={20} total={95} onPageChange={onPageChange} />);
    const nav = screen.getByRole("navigation", { name: "Пагинация" });
    expect(within(nav).getByRole("button", { name: "Страница 5" })).toBeEnabled();
    expect(within(nav).getByText("21–40 из 95")).toBeInTheDocument();
    await user.click(within(nav).getByRole("button", { name: "Страница 3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("блокирует края и ставит aria-current на активной странице", () => {
    render(<Pagination page={1} pageSize={20} total={95} onPageChange={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Пагинация" });
    expect(within(nav).getByRole("button", { name: "Предыдущая страница" })).toBeDisabled();
    expect(within(nav).getByRole("button", { name: "Следующая страница" })).toBeEnabled();
    expect(within(nav).getByRole("button", { name: "Страница 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("длинные списки сворачиваются многоточиями", () => {
    render(<Pagination page={4} pageSize={20} total={500} onPageChange={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Пагинация" });
    const gaps = within(nav).getAllByText("…");
    expect(gaps).toHaveLength(2);
    expect(within(nav).getByRole("button", { name: "Страница 25" })).toBeInTheDocument();
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Удалить кандидата</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Удалить кандидата?"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Удалить</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </>
        }
      >
        Действие необратимо.
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("переносит фокус внутрь, запирает Tab и возвращает фокус по Escape", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Удалить кандидата" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Удалить кандидата?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Удалить" }));

    const cancel = within(dialog).getByRole("button", { name: "Отмена" });
    cancel.focus();
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Удалить" }));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("закрывается по Escape даже без интерактивных элементов внутри", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={onClose} title="Тест">
        Тело
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <Dialog open={false} onClose={onClose} title="Тест">
        Тело
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PageShell и StaffNavigation", () => {
  it("текстовая идентификация «Очаково / Кадры», skip-link и контент в main", () => {
    render(
      <PageShell variant="public">
        <p>Контент анкеты</p>
      </PageShell>,
    );
    expect(screen.getByRole("link", { name: "Очаково Кадры — на главную" })).toHaveTextContent(
      "Очаково",
    );
    expect(screen.getByRole("link", { name: "К содержанию" })).toHaveAttribute("href", "#content");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "content");
    expect(within(main).getByText("Контент анкеты")).toBeInTheDocument();
  });

  it("public и staff варианты получают разные классы ширины", () => {
    const { container: pub } = render(
      <PageShell variant="public">
        <p>x</p>
      </PageShell>,
    );
    const { container: staff } = render(
      <PageShell variant="staff">
        <p>x</p>
      </PageShell>,
    );
    expect(pub.firstElementChild?.className).not.toBe(staff.firstElementChild?.className);
  });

  it("активный пункт навигации получает aria-current", () => {
    render(
      <MemoryRouter initialEntries={["/registry"]}>
        <StaffNavigation
          items={[
            { to: "/registry", label: "Реестр" },
            { to: "/help", label: "Справка" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Реестр" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Справка" })).not.toHaveAttribute("aria-current");
  });
});

describe("Состояния: EmptyState и Spinner", () => {
  it("EmptyState показывает заголовок, описание и действие", () => {
    render(
      <EmptyState
        title="Кандидатов нет"
        description="Измени фильтры или добавь кандидата вручную"
        action={<Button>Добавить кандидата</Button>}
      />,
    );
    expect(screen.getByText("Кандидатов нет")).toBeVisible();
    expect(screen.getByText("Измени фильтры или добавь кандидата вручную")).toBeVisible();
    expect(screen.getByRole("button", { name: "Добавить кандидата" })).toBeEnabled();
  });

  it("Spinner и SkeletonBlock объявляют статус для скринридеров", () => {
    render(
      <div>
        <Spinner />
        <Spinner label="Загружаем реестр" />
        <SkeletonBlock height={80} label="Карточка кандидата" />
      </div>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.getByText("Загружаем реестр")).toBeVisible();
    expect(screen.getByRole("status", { name: "Карточка кандидата" })).toBeVisible();
  });
});

describe("Fixture /style: доступность", () => {
  it("axe не находит serious/critical нарушений", async () => {
    render(
      <MemoryRouter initialEntries={["/style"]}>
        <Routes>
          <Route element={<StyleGuidePage />} path="/style" />
        </Routes>
      </MemoryRouter>,
    );
    const results = await axe.run(document.body, {
      resultTypes: ["violations"],
    });
    const blocking = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  }, 20000);
});
