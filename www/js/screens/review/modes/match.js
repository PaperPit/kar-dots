import { el, stripHtml } from '../../../ui/ui.js';
import { shuffle, haptic } from '../../../ui/helpers.js';
import { playAnswerFeedbackFromStore } from '../../../lib/sounds.js';
import { flashMatchPair, flashMatchHint } from '../../../ui/answer-feedback.js';

const BATCH_SIZE = 4;
const MIN_BATCH = 2;
/** Размер раунда «пары» в режиме «Микс» (считается за 1 шаг прогресса). */
const COMBO_MATCH_BATCH = 5;

function cardSideText(card, side) {
  return stripHtml(side === 'front' ? card.front : card.back).trim();
}

/**
 * Раунд «пары»: слева — показываемая сторона, справа — ответ.
 */
export function createMatchRound(cards, ctx) {
  const promptSide = ctx.promptSide === 'back' ? 'back' : 'front';
  const answerSide = promptSide === 'front' ? 'back' : 'front';
  const mistakes = new Set();
  let selectedTerm = null;
  let selectedDef = null;
  const paired = new Map();

  const promptColClass = promptSide === 'front' ? 'match-col-terms' : 'match-col-defs';
  const answerColClass = promptSide === 'front' ? 'match-col-defs' : 'match-col-terms';
  const termsCol = el('div', { class: `match-col ${promptColClass}` });
  const defsCol = el('div', { class: `match-col ${answerColClass}` });
  const hint = el('p', {
    class: 'study-hint match-hint',
  }, promptSide === 'front'
    ? 'Нажмите термин, затем перевод'
    : 'Нажмите перевод, затем термин');

  const answers = shuffle(cards.map(c => ({
    cardId: c.id,
    text: cardSideText(c, answerSide) || '(пусто)',
  })));

  function promptBtn(card) {
    const isPaired = paired.has(card.id);
    return el('button', {
      type: 'button',
      'data-id': card.id,
      class: 'match-item match-term'
        + (selectedTerm === card.id ? ' is-selected' : '')
        + (isPaired ? ' is-paired' : ''),
      disabled: isPaired,
      onclick: () => selectTerm(card.id),
    }, cardSideText(card, promptSide) || '(пусто)');
  }

  function answerBtn(item) {
    const isPaired = [...paired.values()].includes(item.cardId);
    return el('button', {
      type: 'button',
      'data-id': item.cardId,
      class: 'match-item match-def'
        + (selectedDef === item.cardId ? ' is-selected' : '')
        + (isPaired ? ' is-paired' : ''),
      disabled: isPaired,
      onclick: () => selectDef(item.cardId),
    }, item.text);
  }

  function renderBoard() {
    termsCol.innerHTML = '';
    defsCol.innerHTML = '';
    cards.forEach(c => termsCol.append(promptBtn(c)));
    answers.forEach(d => defsCol.append(answerBtn(d)));
  }

  function tryPair() {
    if (!selectedTerm || !selectedDef) return;
    const termEl = termsCol.querySelector(`[data-id="${selectedTerm}"]`);
    const defEl = defsCol.querySelector(`[data-id="${selectedDef}"]`);
    if (selectedTerm === selectedDef) {
      playAnswerFeedbackFromStore(true);
      haptic(8);
      flashMatchPair(termEl, defEl, true, () => {
        paired.set(selectedTerm, selectedDef);
        selectedTerm = null;
        selectedDef = null;
        hint.textContent = paired.size === cards.length
          ? 'Все пары собраны!'
          : 'Отлично! Продолжайте';
        flashMatchHint(hint, true);
        renderBoard();
        if (paired.size === cards.length) {
          setTimeout(() => {
            const results = cards.map(c => ({
              card: c,
              know: !mistakes.has(c.id),
            }));
            ctx.onRoundComplete(results);
          }, 480);
        }
      });
      return;
    }
    mistakes.add(selectedTerm);
    playAnswerFeedbackFromStore(false);
    haptic(4);
    flashMatchPair(termEl, defEl, false, () => {
      selectedTerm = null;
      selectedDef = null;
      hint.textContent = 'Не та пара — попробуйте снова';
      flashMatchHint(hint, false);
      renderBoard();
    });
  }

  function selectTerm(id) {
    if (paired.has(id)) return;
    selectedTerm = selectedTerm === id ? null : id;
    selectedDef = null;
    renderBoard();
  }

  function selectDef(id) {
    if ([...paired.values()].includes(id)) return;
    selectedDef = selectedDef === id ? null : id;
    if (selectedTerm) tryPair();
    else renderBoard();
  }

  renderBoard();

  const box = el('div', { class: 'study-match-card' }, [
    el('p', { class: 'match-round-label' }, `Соберите пары · ${cards.length}`),
    hint,
    el('div', { class: 'match-board' }, [termsCol, defsCol]),
  ]);

  return { box, destroy() {} };
}

export function pickMatchBatch(queue, minSize = MIN_BATCH, batchSize = BATCH_SIZE, promptSide = 'front') {
  const answerSide = promptSide === 'back' ? 'front' : 'back';
  const batch = [];
  const skipped = [];
  for (let i = 0; i < queue.length && batch.length < batchSize; i++) {
    const c = queue[i];
    if (cardSideText(c, answerSide)) batch.push(c);
    else skipped.push(c);
  }
  if (batch.length >= minSize) return { batch, skipped };
  if (batch.length === 1) return { batch, skipped, single: true };
  return { batch: [], skipped, single: false };
}

export { BATCH_SIZE, MIN_BATCH, COMBO_MATCH_BATCH };
