import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1, "Заполните поле") });
type FormValues = z.infer<typeof schema>;

function NameForm({ onValid }: { onValid: (values: FormValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  return (
    <form noValidate onSubmit={handleSubmit(onValid)}>
      <label htmlFor="name">Имя</label>
      <input id="name" {...register("name")} />
      {errors.name ? <p role="alert">{errors.name.message}</p> : null}
      <button type="submit">Отправить</button>
    </form>
  );
}

describe("react-hook-form + zod 4 + @hookform/resolvers", () => {
  it("показывает ошибку zod и не вызывает submit", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<NameForm onValid={onValid} />);
    await user.click(screen.getByRole("button", { name: "Отправить" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Заполните поле");
    expect(onValid).not.toHaveBeenCalled();
  });

  it("передаёт валидные значения в onValid", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<NameForm onValid={onValid} />);
    await user.type(screen.getByLabelText("Имя"), "Иван");
    await user.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onValid).toHaveBeenCalledWith({ name: "Иван" }, expect.anything());
  });
});
