import { el, sanitizeRich, stripHtml } from './ui.js';

/** Лицевая сторона: термин + опциональная картинка. */
export function buildFrontContent(card) {
  const parts = [];
  if (card.front_img) parts.push(el('img', { src: card.front_img, alt: '' }));
  const plain = stripHtml(card.front);
  if (plain) {
    const sizeCls = plain.length > 160 ? ' long' : plain.length > 60 ? ' small' : '';
    const wordNode = el('div', { class: 'word' + sizeCls });
    wordNode.innerHTML = sanitizeRich(card.front);
    parts.push(wordNode);
  }
  return parts;
}

/** Оборот: определение (жирное, по центру) + описание (мельче, по ширине). */
export function buildBackContent(card) {
  const parts = [];
  if (card.back_img) parts.push(el('img', { src: card.back_img, alt: '' }));

  const defPlain = stripHtml(card.back);
  if (defPlain) {
    const longCls = defPlain.length > 120 ? ' long' : '';
    const defNode = el('div', { class: 'card-definition' + longCls });
    defNode.textContent = defPlain;
    parts.push(defNode);
  }

  const desc = (card.description || '').trim();
  if (desc) {
    const descNode = el('div', { class: 'card-description' });
    descNode.innerHTML = sanitizeRich(desc);
    parts.push(descNode);
  }

  if (!parts.length) {
    parts.push(el('div', { class: 'card-definition muted' }, '(пусто)'));
  }
  return parts;
}

export function buildFaceScroll(side, card) {
  const content = side === 'front' ? buildFrontContent(card) : buildBackContent(card);
  return el('div', { class: 'flip-face-scroll' }, content);
}

export function buildFlipFace(side, card, isBackFace) {
  return el('div', { class: 'flip-face' + (isBackFace ? ' backside' : '') }, [
    buildFaceScroll(side, card),
  ]);
}

/** Плоский текст описания для textarea. */
export function descriptionPlain(card) {
  return String(card.description || '').trim();
}
