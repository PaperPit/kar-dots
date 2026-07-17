import { expect, test } from '@playwright/test';

async function enterLocal(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать без регистрации' }).click();
  await expect(page.getByRole('heading', { name: /Сегодня к повторению|Кар!|КАР-р-р|Поля ждут/ })).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('local mode opens seeded home', async ({ page }) => {
  await enterLocal(page);
  await expect(page.getByText('Первая папка')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Новая коробка' })).toBeVisible();
});

test('settings screen is reachable from local mode', async ({ page }) => {
  await enterLocal(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  await expect(page.getByText(/Алгоритм|Повторение|Данные/).first()).toBeVisible();
});

test('review mode picker opens from home', async ({ page }) => {
  await enterLocal(page);
  await page.getByRole('button', { name: /Повторить|Повторение/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Классика|Ввод|Пропуски|Пары/).first()).toBeVisible();
});

test('local mode survives reload', async ({ page }) => {
  await enterLocal(page);
  await page.reload();
  await expect(page.getByText('Первая папка')).toBeVisible();
});
