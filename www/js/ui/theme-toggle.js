import { el } from './ui.js';
import { svgNode } from './helpers.js';
import { getTheme, toggleTheme } from '../lib/theme.js';

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 6.5 6.5 0 0 0 21 14.5Z"/></svg>';

function syncToggle(btn, theme) {
  const dark = theme === 'dark';
  btn.classList.toggle('is-dark', dark);
  btn.setAttribute('aria-checked', dark ? 'true' : 'false');
  btn.title = dark ? 'Светлая тема' : 'Тёмная тема';
}

/** Анимированный переключатель светлой / тёмной темы. */
export function createThemeToggle() {
  const theme = getTheme();
  const track = el('span', { class: 'theme-toggle-track' }, [
    el('span', { class: 'theme-toggle-icon theme-toggle-sun' }, svgNode(SUN)),
    el('span', { class: 'theme-toggle-icon theme-toggle-moon' }, svgNode(MOON)),
  ]);
  const knob = el('span', { class: 'theme-toggle-knob' });
  track.append(knob);

  const btn = el('button', {
    type: 'button',
    class: 'theme-toggle',
    role: 'switch',
    'aria-label': 'Тема оформления',
  }, track);

  syncToggle(btn, theme);

  btn.addEventListener('click', () => {
    const next = toggleTheme();
    syncToggle(btn, next);
  });

  return btn;
}
