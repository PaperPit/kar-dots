import { test, expect } from '@playwright/test';
import { enterLocal } from './helpers.js';

test('note screen: no console/page errors after open', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await enterLocal(page);
  await page.waitForTimeout(500);

  await page.evaluate(async () => {
    const { store } = await import('/js/core/state.js');
    const n = await store.createNote({ title: 'ConsoleProbe', body: '# ConsoleProbe\nhello [[x]]' });
    location.hash = '#note/' + n.id;
  });

  await expect(page.locator('.note-cm, .cm-editor')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  const toastText = await page.locator('#toasts').innerText().catch(() => '');
  expect(toastText, 'unexpected toast: ' + toastText).not.toMatch(/Что-то пошло не так|Something went wrong|Ошибка экрана|Unrecognized extension/);
  expect(errors, errors.join('\n---\n')).toEqual([]);
});
