import { el } from '../../ui/ui.js';
import { buildFlipFace } from '../../ui/card-face.js';
import { haptic } from '../../ui/helpers.js';

function isTextEntryTarget(node) {
  if (!node || !(node instanceof Element)) return false;
  if (node.closest('.modal-overlay')) return true;
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node.isContentEditable) return true;
  return !!node.closest('[contenteditable="true"]');
}

/**
 * Интерактивная карточка повторения: бесконечное переворачивание по клику/тапу.
 */
export function createFlipCard(card, firstSide, opts) {
  opts = opts || {};
  const backSide = firstSide === 'front' ? 'back' : 'front';
  let gradesShown = false;

  const flip = el('div', {
    class: 'flip-card', role: 'button', tabindex: '0',
    'aria-label': 'Карточка — нажмите, чтобы перевернуть',
  }, [
    buildFlipFace(firstSide, card, false),
    buildFlipFace(backSide, card, true),
  ]);

  const hint = el('div', { class: 'flip-hint' }, 'Нажмите на карточку, чтобы перевернуть');
  const grades = el('div', { class: 'grade-row' });
  const swipeWrap = el('div', { class: 'flip-swipe-wrap' }, [flip]);
  const swipeArea = el('div', { class: 'flip-swipe-area' }, [
    swipeWrap,
    el('div', { class: 'swipe-glow swipe-glow-left', 'aria-hidden': 'true' }),
    el('div', { class: 'swipe-glow swipe-glow-right', 'aria-hidden': 'true' }),
  ]);
  const box = el('div', { class: 'flip-scene' }, [swipeArea, hint, grades]);

  requestAnimationFrame(() => {
    sizeFlipCard(flip);
    flip.focus({ preventScroll: true });
  });

  function toggleFlip() {
    flip.classList.toggle('flipped');
    haptic(6);
    if (!gradesShown) {
      gradesShown = true;
      hint.style.opacity = '0';
      if (opts.onFirstFlip) opts.onFirstFlip();
    }
  }

  flip.addEventListener('click', () => {
    if (box.dataset.swipeHandled) {
      box.dataset.swipeHandled = '';
      return;
    }
    toggleFlip();
  });

  box.tabIndex = -1;
  const onKey = e => {
    if (!opts.stageContains || !opts.stageContains(box)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (isTextEntryTarget(e.target)) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleFlip();
    }
    if (gradesShown && opts.onGradeKey && ['1', '2'].includes(e.key)) {
      opts.onGradeKey(e.key, grades);
    }
    if (gradesShown && opts.onGradeDir) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        opts.onGradeDir('left', grades);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        opts.onGradeDir('right', grades);
      }
    }
  };
  document.addEventListener('keydown', onKey);

  return { box, flip, swipeWrap, grades, hint, getVisibleSide: () => (flip.classList.contains('flipped') ? backSide : firstSide) };
}

export function sizeFlipCard(flipEl) {
  const faces = flipEl.querySelectorAll('.flip-face');
  let maxNeeded = 320;
  faces.forEach(face => {
    const scrollBox = face.querySelector('.flip-face-scroll');
    if (!scrollBox) return;
    maxNeeded = Math.max(maxNeeded, scrollBox.scrollHeight + 28 * 2 + 26);
  });
  const viewportMax = Math.max(320, Math.round(window.innerHeight * 0.72));
  flipEl.style.height = Math.min(maxNeeded, viewportMax) + 'px';
}
