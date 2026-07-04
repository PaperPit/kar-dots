import { store } from './state.js';

export async function route() {
  const h = (location.hash || '#home').slice(1);
  const [name, arg] = h.split('/');
  if (!store) {
    const { renderAuth } = await import('../screens/auth/index.js');
    renderAuth();
    return;
  }

  const bootSplash = document.getElementById('bootSplash');
  if (bootSplash) bootSplash.remove();

  if (name === 'folder' && arg) {
    const { renderFolder } = await import('../screens/folder/index.js');
    await renderFolder(arg);
  } else if (name === 'review') {
    const { renderReview } = await import('../screens/review/index.js');
    await renderReview(arg || null);
  } else if (name === 'settings') {
    const { renderSettings } = await import('../screens/settings/index.js');
    renderSettings();
  } else {
    const { renderHome } = await import('../screens/home/index.js');
    await renderHome();
  }
}

export function initRouter() {
  window.addEventListener('hashchange', () => { route().catch(console.error); });
}
