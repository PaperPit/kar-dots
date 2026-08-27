import { expect } from '@playwright/test';

const HOME_GREETING =
  /Доброе утро|Добрый день|Добрый вечер|Good morning|Good afternoon|Good evening/i;

const LOCAL_CTA =
  /Продолжить на этом устройстве|Continue on this device|Попробовать без регистрации|Try without/i;

/**
 * Local-first: boot usually opens home without auth.
 * If the auth screen is shown (e.g. after sign-out), click the local CTA.
 */
export async function enterLocal(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('kar_mode');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  const home = page.getByText(HOME_GREETING);
  try {
    await home.waitFor({ state: 'visible', timeout: 8_000 });
    return;
  } catch {
    /* auth screen or slow boot */
  }
  const btn = page.getByRole('button', { name: LOCAL_CTA });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  }
  await expect(home).toBeVisible({ timeout: 15_000 });
}
