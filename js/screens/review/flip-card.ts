import type { SrsCard } from "../../lib/srs.js";
import { el } from '../../ui/ui.js';
import { buildFlipFace } from '../../ui/card-face.js';
import { haptic } from '../../ui/helpers.js';


interface FlipCardOpts {
  stageContains?: (n: Node) => boolean;
  onFirstFlip?: () => void;
  onFlip?: (side: string) => void;
  onGradeKey?: (key: string, gradeRow: HTMLElement) => void;
  onGradeDir?: (dir: 'left' | 'right', gradeRow: HTMLElement) => void;
}

function isTextEntryTarget(node: EventTarget | null): boolean {
  if (!node || !(node instanceof HTMLElement)) return false;
  if (node.closest('.modal-overlay')) return true;
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node.isContentEditable) return true;
  return !!node.closest('[contenteditable="true"]');
}

/**
 * Интерактивная карточка повторения: бесконечное переворачивание по клику/тапу.
 */
export function createFlipCard(card: SrsCard, firstSide: 'front' | 'back', opts: FlipCardOpts = {}) {
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

  const hint = el('div', { class: 'flip-hint' }, 'коснитесь, чтобы увидеть перевод');
  const grades = el('div', { class: 'grade-row' }, undefined);
  const swipeWrap = el('div', { class: 'flip-swipe-wrap' }, [flip]);
  // декоративные слои-«стопка» позади карточки: создают ощущение колоды
  const swipeArea = el('div', { class: 'flip-swipe-area' }, [
    el('div', { class: 'flip-stack flip-stack-2', 'aria-hidden': 'true' }),
    el('div', { class: 'flip-stack flip-stack-1', 'aria-hidden': 'true' }),
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
    // перезапуск «нырка» (flipDip в review.css) на НЕ-3D обёртке при каждом перевороте
    swipeWrap.classList.remove('flip-dip');
    void swipeWrap.offsetWidth;
    swipeWrap.classList.add('flip-dip');
    haptic(6);
    if (!gradesShown) {
      gradesShown = true;
      hint.style.opacity = '0';
      if (opts.onFirstFlip) opts.onFirstFlip();
    }
    if (opts.onFlip) {
      opts.onFlip(flip.classList.contains('flipped') ? backSide : firstSide);
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
  const onKey = (e: KeyboardEvent) => {
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

export function sizeFlipCard(flipEl: HTMLElement) {
  const isDesktop = window.matchMedia('(min-width: 720px)').matches;
  const padY = isDesktop ? 36 : 28;
  const minBase = isDesktop ? 320 : 280;
  const vhFactor = isDesktop ? 0.8 : 0.72;
  const faces = flipEl.querySelectorAll('.flip-face');
  let maxNeeded = minBase;
  faces.forEach(face => {
    const scrollBox = face.querySelector('.flip-face-scroll');
    if (!scrollBox) return;
    maxNeeded = Math.max(maxNeeded, scrollBox.scrollHeight + padY * 2 + 26);
  });
  const viewportMax = Math.max(minBase, Math.round(window.innerHeight * vhFactor));
  flipEl.style.height = Math.min(maxNeeded, viewportMax) + 'px';
}
