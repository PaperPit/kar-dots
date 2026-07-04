import { haptic } from './helpers.js';

const THRESH = 52;

/**
 * Горизонтальные свайпы для оценки на touch-устройствах (после первого переворота).
 * ← не знаю, → знаю
 */
export function attachSwipeGrades(box, opts) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  box.addEventListener('touchstart', e => {
    if (!opts.enabled()) return;
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  box.addEventListener('touchend', e => {
    if (!tracking || !opts.enabled()) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;

    const dir = dx > 0 ? 'right' : 'left';

    box.dataset.swipeHandled = '1';
    box.classList.remove('swipe-flash-left', 'swipe-flash-right');
    box.classList.add('swipe-flash-' + dir);
    haptic(8);
    opts.onSwipe(dir);
    setTimeout(() => box.classList.remove('swipe-flash-' + dir), 220);
  }, { passive: true });
}
