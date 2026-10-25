import { z } from "zod";

/*
 * Стафф-формы — нейтральный тон («вы», «Проверьте…»), без «ты» из публичной анкеты.
 * Пароль: 12–128, как в backend Password = Field(min_length=12, max_length=128).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Укажите e-mail")
  .max(254, "Слишком длинный e-mail")
  .refine((value) => EMAIL_RE.test(value), "Проверьте e-mail");

const passwordMin = (message: string) =>
  z.string().min(1, message).min(PASSWORD_MIN, `Минимум ${PASSWORD_MIN} символов`).max(PASSWORD_MAX, `Не больше ${PASSWORD_MAX} символов`);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Введите пароль"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: emailField,
    first_name: z.string().trim().min(1, "Укажите имя").max(100, "Не больше 100 символов"),
    last_name: z.string().trim().min(1, "Укажите фамилию").max(100, "Не больше 100 символов"),
    position: z.string().trim().min(1, "Укажите должность").max(150, "Не больше 150 символов"),
    password: passwordMin("Придумайте пароль"),
    password_confirm: z.string().min(1, "Повторите пароль"),
  })
  .refine((values) => values.password === values.password_confirm, {
    path: ["password_confirm"],
    message: "Пароли не совпадают",
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Введите текущий пароль"),
    new_password: passwordMin("Придумайте новый пароль"),
    new_password_confirm: z.string().min(1, "Повторите новый пароль"),
  })
  .refine((values) => values.new_password === values.new_password_confirm, {
    path: ["new_password_confirm"],
    message: "Пароли не совпадают",
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
