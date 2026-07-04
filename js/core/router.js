import { store } from './state.js';
import { recordVisit } from '../lib/activity.js';

export async function route() {
  try {
    const h = (location.hash || '#home').slice(1);
    const parts = h.split('/').filter(Boolean);
    const name = parts[0];
    const arg = parts[1];
    const cram = parts[2] === 'cram';
    if (!store) {
      const { renderAuth } = await import('../screens/auth/index.js');
      renderAuth();
      return;
    }

    const bootSplash = document.getElementById('bootSplash');
    if (bootSplash) bootSplash.remove();

    await recordVisit();

    if (name === 'folder' && arg) {
      const { renderFolder } = await import('../screens/folder/index.js');
      await renderFolder(arg);
    } else if (name === 'review') {
      const { renderReview } = await import('../screens/review/index.js');
      await renderReview(arg || null, { cram: cram && !!arg });
    } else if (name === 'settings') {
      const { renderSettings } = await import('../screens/settings/index.js');
      await renderSettings();
    } else {
      const { renderHome } = await import('../screens/home/index.js');
      await renderHome();
    }
  } catch (e) {
    console.error('Route error:', e);
    const { toast } = await import('../ui/ui.js');
    toast('Ошибка экрана: ' + e.message, 'error');
  }
}

export function initRouter() {
  window.addEventListener('hashchange', () => { route().catch(console.error); });
}
