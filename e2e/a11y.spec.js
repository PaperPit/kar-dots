import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { enterLocal } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.use({ bypassCSP: true });

async function installAxe(page) {
  const axeUrl = import.meta.resolve('axe-core/axe.min.js');
  const axePath = fileURLToPath(axeUrl);
  if (!fs.existsSync(axePath)) throw new Error(`axe-core not found at ${axePath}`);
  await page.addScriptTag({ path: axePath });
  // Make sure axe is ready.
  await page.waitForFunction(() => typeof window.axe?.run === 'function', { timeout: 10_000 });
}

async function runAxe(page, rootSelector) {
  return page.evaluate(async (sel) => {
    const { impact } = window.axe;
    const target = (sel ? document.querySelector(sel) : null) || document.body;
    const res = await window.axe.run(target, {
      resultTypes: ['violations'],
    });
    const criticalOnly = res.violations.filter((v) => v.impact === 'critical');
    return criticalOnly.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes?.slice(0, 3).map((n) => n.target) ?? [],
    }));
  }, rootSelector);
}

test('a11y gate: no critical/serious violations on home/review/settings', async ({ page }) => {
  // HOME
  await enterLocal(page);
  await installAxe(page);
  const homeViolations = await runAxe(page, 'body');
  expect(homeViolations, homeViolations.length ? homeViolations : 'home: no violations').toEqual([]);

  // REVIEW (classic modal + grade UI)
  await page.getByRole('button', { name: /Продолжить|Повторить|Continue|Review/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Классическ|Classic/i }).click();
  const reviewViolations = await runAxe(page, '.review');
  expect(reviewViolations, reviewViolations.length ? reviewViolations : 'review: no violations').toEqual([]);

  // SETTINGS
  await page.getByRole('button', { name: /Настройки|Settings/i }).click();
  const settingsViolations = await runAxe(page, 'body');
  expect(settingsViolations, settingsViolations.length ? settingsViolations : 'settings: no violations').toEqual([]);
});

