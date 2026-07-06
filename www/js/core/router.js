import { store } from './state.js';
import { recordVisit } from '../lib/activity.js';
import { parseReviewRoute, isStudyMode } from '../lib/study-modes.js';
import { animateBootSplashOut } from '../lib/motion-ui.js';
import { cancelNavFallback } from '../ui/navigation.js';

export function parseHash(hash) {
  const parts = (hash || '#home').slice(1).split('/').filter(Boolean);
  return {
    name: parts[0] || 'home',
    arg: parts[1] || null,
    parts,
  };
}

export async function route() {
  try {
    const { name, arg, parts } = parseHash(location.hash);
    const reviewOpts = name === 'review' ? parseReviewRoute(parts) : null;
    if (!store) {
      const { renderAuth } = await import('../screens/auth/index.js');
      renderAuth();
      return;
    }

    const bootSplash = document.getElementById('bootSplash');
    if (bootSplash) animateBootSplashOut(bootSplash);

    await recordVisit();

    if (name === 'folder' && arg) {
      const { renderFolder } = await import('../screens/folder/index.js');
      await renderFolder(arg);
    } else if (name === 'box' && arg) {
      const { renderBox } = await import('../screens/box/index.js');
      await renderBox(arg);
    } else if (name === 'review') {
      const { folderId, cram, mode, cramLimit } = reviewOpts;
      const { renderReview } = await import('../screens/review/index.js');
      await renderReview(folderId, {
        cram: cram && !!folderId,
        mode: isStudyMode(mode) ? mode : 'flip',
        cramLimit: cramLimit > 0 ? cramLimit : null,
      });
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
  window.addEventListener('hashchange', () => {
    cancelNavFallback();
    route().catch(console.error);
  });
}
