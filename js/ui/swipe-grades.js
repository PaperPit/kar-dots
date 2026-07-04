import { haptic } from './helpers.js';

const THRESH = 52;
const LOCK_THRESH = 10;
const AXIS_RATIO = 1.15;

/**
 * Горизонтальные свайпы для оценки на touch-устройствах (после первого переворота).
 * ← не знаю, → знаю
 */
export function attachSwipeGrades(box, opts) {
  const card = () => opts.cardEl || box.querySelector('.flip-card');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let axis = null;
  let dragX = 0;

  function cardTransform(el, tx) {
    if (el.classList.contains('flipped')) return `rotateY(180deg) translateX(${tx}px)`;
    return `translateX(${tx}px)`;
  }

  function maxDrag() {
    return Math.min(window.innerWidth * 0.42, 220);
  }

  function withResistance(dx) {
    const cap = maxDrag();
    const abs = Math.abs(dx);
    if (abs <= cap) return dx;
    const sign = Math.sign(dx);
    return sign * (cap + (abs - cap) * 0.22);
  }

  function setDrag(dx, el) {
    dragX = dx;
    const tx = withResistance(dx);
    const fade = Math.min(Math.abs(tx) / (maxDrag() * 1.6), 0.14);
    el.style.transform = cardTransform(el, tx);
    el.style.opacity = String(1 - fade);
  }

  function clearDrag(el) {
    dragX = 0;
    el.classList.remove('swipe-dragging', 'swipe-animating');
    el.style.transform = '';
    el.style.opacity = '';
  }

  function markHandled() {
    box.dataset.swipeHandled = '1';
  }

  function animateTo(el, tx, opacity, duration, onDone) {
    el.classList.remove('swipe-dragging');
    el.classList.add('swipe-animating');
    el.style.transform = cardTransform(el, tx);
    el.style.opacity = String(opacity);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      onDone();
    };
    const onEnd = e => {
      if (e.target !== el || e.propertyName !== 'transform') return;
      finish();
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, duration + 40);
  }

  function springBack(el) {
    if (reduceMotion || !dragX) {
      clearDrag(el);
      return;
    }
    animateTo(el, 0, 1, 380, () => clearDrag(el));
  }

  function exitSwipe(el, dir, onDone) {
    const off = (dir === 'right' ? 1 : -1) * (window.innerWidth * 0.55 + 40);
    if (reduceMotion) {
      clearDrag(el);
      onDone();
      return;
    }
    animateTo(el, off, 0, 300, () => {
      clearDrag(el);
      onDone();
    });
  }

  function commitSwipe(dir) {
    const el = card();
    if (!el) return;
    markHandled();
    haptic(8);
    exitSwipe(el, dir, () => opts.onSwipe(dir));
  }

  box.addEventListener('touchstart', e => {
    if (!opts.enabled()) return;
    if (e.touches.length !== 1) return;
    const el = card();
    if (!el) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    axis = null;
    dragX = 0;
    el.classList.remove('swipe-animating');
  }, { passive: true });

  box.addEventListener('touchmove', e => {
    if (!tracking || !opts.enabled()) return;
    if (e.touches.length !== 1) return;
    const el = card();
    if (!el) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - startX;
    const dy = y - startY;

    if (!axis) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < LOCK_THRESH && ady < LOCK_THRESH) return;
      if (adx >= ady * AXIS_RATIO) axis = 'horizontal';
      else if (ady >= adx * AXIS_RATIO) {
        axis = 'vertical';
        tracking = false;
        return;
      } else return;
    }

    if (axis !== 'horizontal') return;
    e.preventDefault();
    el.classList.add('swipe-dragging');
    setDrag(dx, el);
  }, { passive: false });

  function onTouchEnd(e) {
    if (!tracking || !opts.enabled()) return;
    tracking = false;
    const el = card();
    if (!el) return;

    if (axis !== 'horizontal') {
      axis = null;
      return;
    }

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    axis = null;

    if (Math.abs(dx) > 8) markHandled();

    if (Math.abs(dx) >= THRESH) {
      commitSwipe(dx > 0 ? 'right' : 'left');
      return;
    }
    springBack(el);
  }

  box.addEventListener('touchend', onTouchEnd, { passive: true });
  box.addEventListener('touchcancel', () => {
    if (!tracking) return;
    const wasHorizontal = axis === 'horizontal';
    tracking = false;
    axis = null;
    const el = card();
    if (!el) return;
    if (wasHorizontal) springBack(el);
    else clearDrag(el);
  }, { passive: true });
}
