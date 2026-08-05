import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function enterLocal(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Попробовать без регистрации|Try without/i }).click();
  await expect(page.getByText(/Доброе утро|Добрый день|Добрый вечер|Good morning|Good afternoon|Good evening/i)).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('classic review: flip card and grade', async ({ page }) => {
  await enterLocal(page);

  // Seeded folder has new cards — open study picker from day card CTA.
  await page.getByRole('button', { name: /Продолжить|Повторить|Continue|Review/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Классическ|Classic/i }).click();

  const flip = page.locator('.flip-card').first();
  await expect(flip).toBeVisible({ timeout: 10_000 });
  await flip.click();
  await expect(page.locator('.grade-row')).toBeVisible();

  const gradeBtn = page.locator('.grade-row .grade-btn').first();
  await expect(gradeBtn).toBeVisible();
  await gradeBtn.click();

  // Either next card, lesson end, or progress counter advanced.
  await expect(
    page.locator('.flip-card, .lesson-reward, .review-done, .progress-seg.is-done').first()
  ).toBeVisible({ timeout: 10_000 });
});

test('local data persists after creating a folder and reloading', async ({ page }) => {
  await enterLocal(page);

  const folderName = await page.evaluate(async () => {
    const { store } = await import('/js/core/state.js');
    const f = await store.createFolder({ name: 'PersistProbe', color: '#336699' });
    await store.createCard({
      folder_id: f.id,
      front: 'persist-front',
      back: 'persist-back',
      description: '',
    });
    return f.name;
  });

  await page.reload();
  await expect(page.getByText(folderName)).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText(/Доброе утро|Добрый день|Добрый вечер|Good morning|Good afternoon|Good evening/i)
  ).toBeVisible();
});

test('settings: sync section shows local-only note in demo mode', async ({ page }) => {
  await enterLocal(page);
  await page.getByRole('button', { name: /Настройки|Settings/i }).click();
  await expect(page.getByRole('heading', { name: /Настройки|Settings/i })).toBeVisible();
  await expect(
    page.getByText(/Очередь синхронизации|Sync queue/i)
  ).toBeVisible();
  await expect(
    page.getByText(/только в облачном|cloud mode only/i)
  ).toBeVisible();
});

test('settings: JSON import restores a folder', async ({ page }) => {
  await enterLocal(page);

  const fixture = {
    v: 3,
    folders: [{ id: 'imp-folder', name: 'Imported E2E', color: '#112233', created_at: 1 }],
    cards: [{
      id: 'imp-card',
      folder_id: 'imp-folder',
      front: 'import-front',
      back: 'import-back',
      description: '',
      created_at: 1,
    }],
    settings: {},
    boxes: [],
    notes: [],
  };
  const tmp = path.join(__dirname, 'tmp-import.json');
  fs.writeFileSync(tmp, JSON.stringify(fixture));

  try {
    await page.getByRole('button', { name: /Настройки|Settings/i }).click();
    await expect(page.getByText(/Данные|Data/i).first()).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept*="json"]');
    await fileInput.setInputFiles(tmp);

    await expect(page.getByText(/Импорт завершён|Import complete/i)).toBeVisible({ timeout: 10_000 });
    // Re-open home via nav
    await page.getByRole('button', { name: /Папки|Folders/i }).click();
    await expect(page.getByText('Imported E2E')).toBeVisible({ timeout: 10_000 });
  } finally {
    fs.unlinkSync(tmp);
  }
});
