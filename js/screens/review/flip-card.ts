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

const sizedImgListeners = new WeakSet<HTMLImageElement>();

function previewCardMaxHeight(flipEl: HTMLElement): number | null {
  const previewWrap = flipEl.closest('.card-preview-wrap');
  if (!previewWrap) return null;
  const modalBox = flipEl.closest('.modal-box') as HTMLElement | null;
  const modalH = modalBox?.clientHeight || Math.round(window.innerHeight * 0.88);
  // Заголовок, подпись, hint, кнопка «Закрыть», отступы модалки
  return Math.max(200, Math.min(340, modalH - 220));
}

/** Высота карточки так, чтобы hint + кнопки «Знаю/Не знаю» оставались в viewport. */
function reviewCardMaxHeight(flipEl: HTMLElement, isDesktop: boolean): number {
  const swipeArea = flipEl.closest('.flip-swipe-area') as HTMLElement | null;
  const topEl = swipeArea || flipEl;
  const top = topEl.getBoundingClientRect().top;
  // hint (~36) + grade-row (~64–80) + отступы main/safe-area
  const reserveBelow = isDesktop ? 130 : 120;
  const available = Math.floor(window.innerHeight - top - reserveBelow);
  const minBase = isDesktop ? 240 : 200;
  const hardCap = Math.round(window.innerHeight * (isDesktop ? 0.52 : 0.46));
  return Math.max(minBase, Math.min(hardCap, available));
}

/** Подогнать высоту карточки и сжать фото, чтобы слово/перевод всегда были видны. */
export function sizeFlipCard(flipEl: HTMLElement) {
  const isDesktop = window.matchMedia('(min-width: 720px)').matches;
  const previewMax = previewCardMaxHeight(flipEl);
  const inPreview = previewMax != null;

  let cardH: number;
  let imgCap: number;
  if (inPreview) {
    cardH = previewMax!;
    imgCap = isDesktop ? 160 : 130;
  } else {
    cardH = reviewCardMaxHeight(flipEl, isDesktop);
    imgCap = isDesktop ? 200 : 150;
  }
  flipEl.style.height = cardH + 'px';
  flipEl.style.maxHeight = cardH + 'px';

  flipEl.querySelectorAll('.flip-face').forEach((face) => {
    const scroll = face.querySelector('.flip-face-scroll') as HTMLElement | null;
    if (!scroll) return;
    const img = scroll.querySelector(':scope > img') as HTMLImageElement | null;
    if (!img) return;
    let textH = 0;
    scroll.querySelectorAll(':scope > :not(img)').forEach((node) => {
      textH += (node as HTMLElement).offsetHeight;
    });
    const chip = (face.querySelector('.flip-side-chip') as HTMLElement | null)?.offsetHeight || 0;
    const facePad = inPreview ? (isDesktop ? 56 : 40) : (isDesktop ? 64 : 44);
    const gaps = inPreview ? 16 : 20;
    const room = cardH - facePad - chip - textH - gaps;
    const maxImg = Math.max(56, Math.min(imgCap, room));
    img.style.maxHeight = `${maxImg}px`;
  });

  flipEl.querySelectorAll('img').forEach((node) => {
    const img = node as HTMLImageElement;
    if (img.complete || sizedImgListeners.has(img)) return;
    sizedImgListeners.add(img);
    const remeasure = () => sizeFlipCard(flipEl);
    img.addEventListener('load', remeasure, { once: true });
    img.addEventListener('error', remeasure, { once: true });
  });
}
