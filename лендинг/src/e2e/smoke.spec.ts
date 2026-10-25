import { expect, test } from "@playwright/test";

test.skip(true, "Полный тестовый стек (compose.test.yaml) подключается в T11");

test("приложение отвечает на корневом маршруте", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Очаково/);
});
