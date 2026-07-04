import * as SRS from '../lib/srs.js';
import { el } from '../../ui/ui.js';
import { buildFlipFace } from '../../ui/card-face.js';

/**
 * Интерактивная карточка повторения: бесконечное переворачивание по клику/тапу.
 */
export function createFlipCard(card, firstSide, opts) {
  opts = opts || {};
  const backSide = firstSide === 'front' ? 'back' : 'front';
  let gradesShown = false;

  const flip = el('div', { class: 'flip-card' }, [
    buildFlipFace(firstSide, card, false),
    buildFlipFace(backSide, card, true),
  ]);

  const hint = el('div', { class: 'flip-hint' }, 'Нажмите на карточку, чтобы перевернуть');
  const grades = el('div', { class: 'grade-row' });
  const box = el('div', { class: 'flip-scene' }, [flip, hint, grades]);

  requestAnimationFrame(() => sizeFlipCard(flip));

  function toggleFlip() {
    flip.classList.toggle('flipped');
    if (!gradesShown) {
      gradesShown = true;
      hint.style.opacity = '0';
      if (opts.onFirstFlip) opts.onFirstFlip();
    }
  }

  flip.addEventListener('click', toggleFlip);

  box.tabIndex = -1;
  const onKey = e => {
    if (!opts.stageContains || !opts.stageContains(box)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleFlip();
    }
    if (gradesShown && ['1', '2', '3', '4'].includes(e.key) && opts.onGradeKey) {
      opts.onGradeKey(e.key, grades);
    }
  };
  document.addEventListener('keydown', onKey);

  return { box, flip, grades, hint };
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
