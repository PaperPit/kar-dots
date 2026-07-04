import { haptic } from './helpers.js';

const THRESH = 52;
const LOCK_THRESH = 10;
const AXIS_RATIO = 1.15;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function dragTransform(tx) {
  const tilt = Math.max(-10, Math.min(10, tx * 0.045));
  return `translateX(${tx}px) rotate(${tilt}deg)`;
}

function clearDrag(el, box) {
  if (!el) return;
  el.classList.remove('swipe-dragging', 'swipe-animating');
  el.style.transform = '';
  el.style.opacity = '';
  if (box) {
    box.dataset.swipeDir = '';
    box.style.removeProperty('--swipe-glow');
  }
}

function setDragHint(box, dx) {
  if (!box) return;
  const abs = Math.abs(dx);
  const intensity = Math.min(abs / maxDrag(), 1);
  if (abs >= 12) {
    box.style.setProperty('--swipe-glow', String(0.3 + intensity * 0.7));
    if (dx < 0) box.dataset.swipeDir = 'left';
    else box.dataset.swipeDir = 'right';
  } else {
    box.dataset.swipeDir = '';
    box.style.removeProperty('--swipe-glow');
  }
}

function animateTo(el, box, tx, opacity, duration, onDone) {
  el.classList.remove('swipe-dragging');
  el.classList.add('swipe-animating');
  el.style.transform = dragTransform(tx);
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
  setTimeout(finish, duration + 50);
}

/** Плавный уход карточки влево/вправо (кнопки и свайпы). */
export function animateCardExit(el, dir, onDone, box) {
  if (!el) { onDone(); return; }
  const off = (dir === 'right' ? 1 : -1) * (window.innerWidth * 0.55 + 48);
  if (reduceMotion()) {
    clearDrag(el, box);
    onDone();
    return;
  }
  haptic(8);
  animateTo(el, box, off, 0, 320, () => {
    clearDrag(el, box);
    onDone();
  });
}

function springBack(el, box) {
  if (reduceMotion()) {
    clearDrag(el, box);
    return;
  }
  animateTo(el, box, 0, 1, 400, () => clearDrag(el, box));
}

/**
 * Горизонтальные свайпы для оценки на touch (после переворота).
 * ← не знаю, → знаю
 */
export function attachSwipeGrades(box, opts) {
  const layer = () => opts.cardEl || box.querySelector('.flip-swipe-wrap');

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let axis = null;
  let dragX = 0;

  function setDrag(dx, el) {
    dragX = dx;
    const tx = withResistance(dx);
    el.style.transform = dragTransform(tx);
    const fade = Math.min(Math.abs(tx) / (maxDrag() * 1.6), 0.12);
    el.style.opacity = String(1 - fade);
    setDragHint(box, tx);
  }

  function markHandled() {
    box.dataset.swipeHandled = '1';
  }

  function commitSwipe(dir) {
    const el = layer();
    if (!el) return;
    markHandled();
    animateCardExit(el, dir, () => opts.onSwipe(dir), box);
  }

  box.addEventListener('touchstart', e => {
    if (!opts.enabled()) return;
    if (e.touches.length !== 1) return;
    const el = layer();
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
    const el = layer();
    if (!el) return;

    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

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
    const el = layer();
    if (!el) return;

    if (axis !== 'horizontal') {
      axis = null;
      return;
    }

    const dx = e.changedTouches[0].clientX - startX;
    axis = null;

    if (Math.abs(dx) > 8) markHandled();

    if (Math.abs(dx) >= THRESH) {
      commitSwipe(dx > 0 ? 'right' : 'left');
      return;
    }
    springBack(el, box);
  }

  box.addEventListener('touchend', onTouchEnd, { passive: true });
  box.addEventListener('touchcancel', () => {
    if (!tracking) return;
    const wasHorizontal = axis === 'horizontal';
    tracking = false;
    axis = null;
    const el = layer();
    if (!el) return;
    if (wasHorizontal) springBack(el, box);
    else clearDrag(el, box);
  }, { passive: true });
}
