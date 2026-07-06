/** Re-exports для обратной совместимости — новый код может импортировать из icons/brand/tts/study-budget. */
export {
  svgNode, ghostBox, emptyFoldersBox, emptyCardsBox, scarecrowBox, featherIcon,
  folderIconNode, folderSwatch, boxSwatch, crowTombIcon, crowBox, cupBox, trophyBox,
  lessonRewardBox, initials, textPreview,
} from './icons.js';
export { brandMark, modalHead } from './brand.js';
export { detectSpeechLang, speakText, speakSequence, speakCardSide } from './tts.js';
export { newBudget, spendNewBudget, refundNewBudget } from './study-budget.js';

import { el } from './ui.js';
import { shuffle } from '../lib/shuffle.js';

export { shuffle };

export function haptic(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {}
}

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function countUp(node, to, ms) {
  to = Number(to) || 0;
  if (prefersReducedMotion() || to <= 0) { node.textContent = String(to); return; }
  ms = ms || 520;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = String(Math.round(eased * to));
    if (t < 1) requestAnimationFrame(tick);
    else node.textContent = String(to);
  }
  requestAnimationFrame(tick);
}
