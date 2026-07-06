import { store } from '../core/state.js';
import { playUiClickSound, normalizeUiClickSoundId } from './sounds.js';

const SKIP = new Set(['TEXTAREA', 'SELECT']);
const SKIP_INPUT = new Set(['text', 'number', 'email', 'password', 'search', 'url', 'range', 'file']);

function shouldPlayForTarget(node) {
  if (!node || node.closest?.('[data-ui-click="off"]')) return false;
  if (node.closest?.('.melody-picker-play')) return false;
  const tag = node.tagName;
  if (SKIP.has(tag)) return false;
  if (tag === 'INPUT') {
    const type = (node.type || 'text').toLowerCase();
    if (SKIP_INPUT.has(type)) return false;
  }
  if (node.isContentEditable || node.closest?.('[contenteditable="true"]')) return false;
  return !!node.closest(
    'button, a[href], [role="button"], [role="tab"], [role="option"], '
    + '.tab-btn, .nav-btn, .brand, .folder-card, .box-card, .grade-btn, .match-item, '
    + '.melody-picker-trigger, .melody-picker-option, .seg button, label.chk-wrap',
  );
}

let bound = false;

export function initUiClicks() {
  if (bound || typeof document === 'undefined') return;
  bound = true;

  document.addEventListener('click', (e) => {
    if (!shouldPlayForTarget(e.target)) return;
    const id = normalizeUiClickSoundId(store?.settings?.uiClickSound);
    if (id === 'none') return;
    playUiClickSound(id);
  }, true);
}
