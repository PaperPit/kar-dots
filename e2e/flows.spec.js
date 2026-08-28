import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import initSqlJs from '../js/vendor/sql-asm.mjs';
import { zipSync } from '../js/vendor/fflate.mjs';
import { enterLocal } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIELD_SEP = '\x1f';
let sqlModulePromise = null;
async function getSqlModule() {
  if (!sqlModulePromise) sqlModulePromise = initSqlJs();
  return sqlModulePromise;
}

async function buildMinimalApkgBytes() {
  const SQL = await getSqlModule();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE col (
      id integer primary key, crt integer not null, mod integer not null,
      scm integer not null, ver integer not null, dty integer not null,
      usn integer not null, ls integer not null, conf text not null,
      models text not null, decks text not null, dconf text not null, tags text not null
    );
    CREATE TABLE notes (
      id integer primary key, guid text not null, mid integer not null,
      mod integer not null, usn integer not null, tags text not null,
      flds text not null, sfld text not null, csum integer not null,
      flags integer not null, data text not null
    );
    CREATE TABLE cards (
      id integer primary key, nid integer not null, did integer not null, ord integer not null,
      mod integer not null, usn integer not null, type integer not null, queue integer not null,
      due integer not null, ivl integer not null, factor integer not null, reps integer not null,
      lapses integer not null, left integer not null, odue integer not null,
      odid integer not null, flags integer not null, data text not null
    );
  `);

  const deckName = 'English Basics';
  const fieldNames = ['Front', 'Back'];

  const models = {
    1: { id: 1, name: 'Basic', flds: fieldNames.map((name, ord) => ({ name, ord })) },
  };
  const decks = { 1: { id: 1, name: deckName } };

  db.run(
    `INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'{}',?,?,'{}','{}')`,
    [JSON.stringify(models), JSON.stringify(decks)],
  );

  let cardId = 1;
  const notes = [
    { id: 1, mid: 1, fields: ['Hello', 'Привет'] },
    { id: 2, mid: 1, fields: ['World', 'Мир'] },
  ];

  for (const n of notes) {
    const flds = n.fields.join(FIELD_SEP);
    db.run(
      `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [n.id, `g${n.id}`, n.mid, 0, 0, '', flds, n.fields[0] || '', 0, 0, ''],
    );
    db.run(
      `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cardId++, n.id, 1, 0, 0, 0, 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, 0, ''],
    );
  }

  const exported = db.export();
  db.close();
  return zipSync({ 'collection.anki2': exported });
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

test('settings: Cloudflare sync section in local mode', async ({ page }) => {
  await enterLocal(page);
  await page.getByRole('button', { name: /Настройки|Settings/i }).click();
  await expect(page.getByRole('heading', { name: /Настройки|Settings/i })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Синхронизация Cloudflare|Cloudflare sync/i })
  ).toBeVisible();
  await expect(page.locator('.settings-sync-note')).toBeVisible();
  await expect(
    page.locator('.settings-sync-note')
  ).toContainText(/Cloudflare|D1/i);
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

test('settings: Anki .apkg import creates folders and cards (v1)', async ({ page }) => {
  await enterLocal(page);

  const tmpApkg = path.join(__dirname, `tmp-${Date.now()}-${Math.random()}.apkg`);
  const apkgBytes = await buildMinimalApkgBytes();
  fs.writeFileSync(tmpApkg, apkgBytes);

  try {
    await page.getByRole('button', { name: /Настройки|Settings/i }).click();
    await expect(page.getByText(/Данные|Data/i).first()).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept*="apkg"]');
    await fileInput.setInputFiles(tmpApkg);

    await expect(page.getByText(/Импортировано\s+\d+\s+карточек|Imported\s+\d+\s+cards/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Папки|Folders/i }).click();
    await expect(page.getByText('English Basics')).toBeVisible({ timeout: 10_000 });
  } finally {
    fs.unlinkSync(tmpApkg);
  }
});

test('language: switches interface to English', async ({ page }) => {
  await enterLocal(page);
  await page.getByRole('button', { name: /Настройки|Settings/i }).click();
  await expect(page.getByRole('heading', { name: /Язык|Language/i })).toBeVisible();

  await page.getByRole('button', { name: /English/i }).click();

  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10_000 });
});
