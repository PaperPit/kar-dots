import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast } from '../../ui/ui.js';
import { speakCardSide, lessonRewardBox } from '../../ui/helpers.js';
import { computeLessonStars } from '../../lib/lesson-stars.js';
import type { LessonStats } from '../../lib/lesson-stars.js';
import { playLessonCompleteFromStore } from '../../lib/sounds.js';
import { nav } from '../../ui/navigation.js';
import { cardDialog } from '../card-editor/index.js';
import { attachSwipeGrades } from '../../ui/swipe-grades.js';
import { cardHasCheckableAnswer, getExpectedAnswer } from '../../lib/answer-check.js';
import { canBuildCloze } from '../../lib/cloze.js';
import { speechRecognitionSupported } from '../../lib/speech-input.js';
import { createFlipModeCard } from './modes/flip.js';
import { sizeFlipCard } from './flip-card.js';
import { createTypeModeCard } from './modes/type.js';
import { createVoiceModeCard } from './modes/voice.js';
import { createClozeModeCard } from './modes/cloze.js';
import { createMatchRound, pickMatchBatch, MIN_BATCH, BATCH_SIZE, COMBO_MATCH_BATCH } from './modes/match.js';
import { finishProgressAnswered } from '../../lib/review-progress.js';
import {
  gradePayload, renderGrades, gradeMatchResults, submitGrade, dismissUndoToast,
} from './grading.js';
import { studyModePicker } from './mode-picker.js';

import type { GradeContext } from "./grading.js";
import type { Card } from "../../data/types.js";
import type { SrsCard } from "../../lib/srs.js";

export type ReviewMode = "flip" | "type" | "cloze" | "voice" | "match" | "combo";

export interface ReviewSessionContext extends GradeContext {
  total: number;
  sessionTotal: number;
  bar: HTMLElement;
  counter: HTMLElement;
  reshowAfterEdit?: () => void;
  currentDestroy: (() => void) | null;
  mode: ReviewMode;
  cramPromptSide?: "front" | "back";
  gradesVisible: boolean;
  editBtn: HTMLElement;
  speakBtn: HTMLElement;
  folderId?: string;
}

export function runReviewSession(ctx: ReviewSessionContext) {
  function syncCardInQueue(id: string, patch: Partial<SrsCard>) {
    for (let i = 0; i < ctx.queue.length; i++) {
      const item = ctx.queue[i];
      if (item && item.id === id) Object.assign(item, patch);
    }
  }

  function removeCardFromSession(cardId: string) {
    if (ctx.undoToastDismiss) { ctx.undoToastDismiss(); ctx.undoToastDismiss = null; }
    ctx.pendingUndo = null;
    if (ctx.showNextTimer) { clearTimeout(ctx.showNextTimer); ctx.showNextTimer = null; }

    const idx = ctx.queue.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const wasCurrent = idx === 0;
    ctx.queue.splice(idx, 1);
    ctx.total = Math.max(ctx.done, ctx.total - 1);

    clearStage();
    updateBar();
    toast('Карточка удалена', 'ok');
    if (!ctx.queue.length) finish();
    else if (wasCurrent) showNext(false);
  }

  function reviewCardDialogOpts(card: SrsCard) {
    return {
      review: true,
      onSaved: (patch: Partial<Card>) => {
        syncCardInQueue(card.id ?? "", patch as Partial<SrsCard>);
        toast('Карточка сохранена', 'ok');
        ctx.reshowAfterEdit?.();
      },
      onDeleted: () => removeCardFromSession(card.id ?? ""),
    };
  }

  function updateBar() {
    const shown = Math.min(ctx.answered, ctx.sessionTotal);
    const segs = ctx.bar.querySelectorAll('.progress-seg');
    if (segs.length) {
      segs.forEach((seg, i) => {
        seg.classList.remove('is-done', 'is-current');
        if (i < shown) seg.classList.add('is-done');
        else if (i === shown && shown < ctx.sessionTotal) seg.classList.add('is-current');
      });
    } else {
      ctx.bar.style.width = Math.round(shown / ctx.sessionTotal * 100) + '%';
    }
    ctx.counter.textContent = shown + ' / ' + ctx.sessionTotal;
  }

  function trackFlipFirstTry(card: SrsCard, know: boolean) {
    if (ctx.sessionFirstTry.has(card.id ?? "")) return false;
    ctx.sessionFirstTry.add(card.id ?? "");
    ctx.stats.attempted++;
    if (know) ctx.stats.firstTryOk++;
    return true;
  }

  function pickSide(): "front" | "back" {
    if (ctx.cramPromptSide) return ctx.cramPromptSide;
    const dir = store.settings.direction;
    if (dir === 'btf') return 'back';
    if (dir === 'mixed') return Math.random() < 0.5 ? 'front' : 'back';
    return 'front';
  }

  function clearStage() {
    if (ctx.currentDestroy) { ctx.currentDestroy(); ctx.currentDestroy = null; }
    ctx.currentSwipeWrap = null;
    ctx.currentBox = null;
  }

  function mountStage(box: HTMLElement, first: boolean, { destroy }: { destroy?: () => void } = {}) {
    clearStage();
    ctx.currentBox = box;
    ctx.currentDestroy = destroy || null;
    if (!first) box.classList.add('card-swap-in');
    ctx.stage.innerHTML = '';
    ctx.stage.append(box);
  }

  function cardWorksInMode(card: SrsCard, side: "front" | "back") {
    if (!cardHasCheckableAnswer(card, side)) return false;
    if (ctx.mode === 'cloze') {
      const answer = getExpectedAnswer(card, side);
      const promptText = getExpectedAnswer(card, side === 'front' ? 'back' : 'front');
      return canBuildCloze(answer, { promptText });
    }
    return true;
  }

  function skipUncheckableFromHead() {
    const side = pickSide();
    while (ctx.queue.length && !cardWorksInMode(ctx.queue[0]!, side)) {
      const msg = ctx.mode === 'cloze'
        ? 'Слишком короткий ответ для пропусков — пропуск'
        : (side === 'front' ? 'Нет перевода для проверки — пропуск' : 'Нет термина для проверки — пропуск');
      toast(msg, 'error');
      ctx.queue.shift();
    }
  }

  function canComboMatchRound() {
    const side = pickSide();
    const { batch } = pickMatchBatch(ctx.queue as Card[], COMBO_MATCH_BATCH, COMBO_MATCH_BATCH, side);
    return batch.length >= COMBO_MATCH_BATCH;
  }

  function pickComboSubMode(): ReviewMode {
    if (canComboMatchRound() && Math.random() < 0.33) return 'match';
    if (speechRecognitionSupported()) return Math.random() < 0.5 ? 'type' : 'voice';
    return 'type';
  }

  function recordFirstTryResult({ success, firstTry }: { success: boolean; firstTry: boolean }) {
    ctx.stats.attempted++;
    if (success && firstTry) ctx.stats.firstTryOk++;
  }

  function showNext(first: boolean) {
    ctx.grading = false;
    if (!ctx.undoHoldUntilFlip) dismissUndoToast(ctx);
    updateBar();
    if (!ctx.queue.length) { finish(); return; }

    if (ctx.mode === 'match') {
      showMatchRound(first);
      return;
    }

    skipUncheckableFromHead();
    if (!ctx.queue.length) { finish(); return; }

    if (ctx.mode === 'combo') {
      const sub = pickComboSubMode();
      if (sub === 'match') {
        showMatchRound(first, { batchSize: COMBO_MATCH_BATCH, countAsOne: true });
        return;
      }
      showStudyCard(first, sub);
      return;
    }

    showStudyCard(first);
  }

  function resolveActiveMode(forceMode?: ReviewMode) {
    if (forceMode) return forceMode;
    if (ctx.mode === 'combo') return pickComboSubMode();
    return ctx.mode;
  }

  function showStudyCard(first: boolean, forceMode?: ReviewMode) {
    ctx.gradesVisible = false;
    const card = ctx.queue[0];
    if (!card) return;
    const activeMode = resolveActiveMode(forceMode);
    if (activeMode === 'match') {
      showMatchRound(first, { batchSize: COMBO_MATCH_BATCH, countAsOne: true });
      return;
    }
    ctx.reshowAfterEdit = () => showStudyCard(true, ctx.mode === 'combo' ? activeMode : forceMode);
    ctx.editBtn.style.visibility = '';
    ctx.editBtn.onclick = () => cardDialog(card.folder_id ?? "", card, reviewCardDialogOpts(card));
    ctx.currentIsNew = SRS.isNew(card, ctx.algo);

    const promptSide = pickSide();
    const gradeOpts = { quiet: true };
    const onSuccess = ({ firstTry }: { firstTry?: boolean } = {}) => {
      recordFirstTryResult({ success: true, firstTry: !!firstTry });
      submitGrade(ctx, card, gradePayload(ctx.algo, true), null, gradeOpts);
    };
    const onFail = () => {
      recordFirstTryResult({ success: false, firstTry: false });
      submitGrade(ctx, card, gradePayload(ctx.algo, false), null, gradeOpts);
    };

    let widget;
    if (activeMode === 'type') {
      ctx.speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
      ctx.speakBtn.onclick = async () => {
        if (!(await speakCardSide(card, promptSide))) toast('Нет текста для озвучки', 'error');
      };
      widget = createTypeModeCard(card, { promptSide, onSuccess, onFail, getSettings: () => store.settings });
    } else if (activeMode === 'cloze') {
      ctx.speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
      ctx.speakBtn.onclick = async () => {
        if (!(await speakCardSide(card, promptSide))) toast('Нет текста для озвучки', 'error');
      };
      widget = createClozeModeCard(card, { promptSide, onSuccess, onFail, getSettings: () => store.settings });
    } else if (activeMode === 'voice') {
      ctx.speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
      ctx.speakBtn.onclick = async () => {
        if (!(await speakCardSide(card, promptSide))) toast('Нет текста для озвучки', 'error');
      };
      widget = createVoiceModeCard(card, { promptSide, onSuccess, onFail, getSettings: () => store.settings });
    } else {
      widget = showFlipCard(card, first, promptSide);
      return;
    }

    mountStage(widget.box, first, { destroy: widget.destroy });
  }

  function showFlipCard(card: SrsCard, first: boolean, promptSide: "front" | "back") {
    ctx.speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
    const side = promptSide || pickSide();
    ctx.reshowAfterEdit = () => showStudyCard(true, 'flip');
    ctx.editBtn.style.visibility = '';
    ctx.editBtn.onclick = () => cardDialog(card.folder_id ?? "", card, reviewCardDialogOpts(card));
    const { box, flip, swipeWrap, grades, getVisibleSide } = createFlipModeCard(card, {
      promptSide: side,
      stageContains: node => ctx.stage.contains(node),
      onFirstFlip: () => {
        if (ctx.undoHoldUntilFlip) dismissUndoToast(ctx);
        ctx.gradesVisible = true;
        renderGrades(ctx, card, grades);
        requestAnimationFrame(() => sizeFlipCard(flip));
      },
      onFlip: flipSide => {
        if (store.settings.tts !== false && store.settings.ttsAuto) void speakCardSide(card, flipSide as "front" | "back");
      },
      onGradeKey: (key, gradeRow) => {
        const btns = gradeRow.querySelectorAll('.grade-btn');
        const i = Number(key) - 1;
        if (btns[i]) (btns[i] as HTMLElement).click();
      },
      onGradeDir: dir => submitGrade(ctx, card, gradePayload(ctx.algo, dir === 'right'), dir, { flipGrade: true }),
    });
    ctx.speakBtn.onclick = async () => {
      if (!(await speakCardSide(card, getVisibleSide()))) toast('Нет текста для озвучки', 'error');
    };
    attachSwipeGrades(box, {
      cardEl: swipeWrap,
      enabled: () => ctx.gradesVisible && ctx.stage.contains(box) && !ctx.grading,
      onSwipe: dir => submitGrade(ctx, card, gradePayload(ctx.algo, dir === 'right'), dir, { flipGrade: true }),
    });
    mountStage(box, first);
    ctx.currentSwipeWrap = swipeWrap;
  }

  function showMatchRound(first: boolean, { batchSize = BATCH_SIZE, countAsOne = false }: { batchSize?: number; countAsOne?: boolean } = {}) {
    skipUncheckableFromHead();
    if (!ctx.queue.length) { finish(); return; }

    const minBatch = countAsOne ? batchSize : MIN_BATCH;
    const { batch, single } = pickMatchBatch(ctx.queue as Card[], minBatch, batchSize, pickSide());
    if (single && batch.length === 1) {
      showStudyCard(first, 'type');
      return;
    }
    if (batch.length < minBatch) {
      if (ctx.queue.length) {
        if (ctx.mode === 'combo') {
          showStudyCard(first, speechRecognitionSupported() && Math.random() < 0.5 ? 'voice' : 'type');
        } else showStudyCard(first, 'type');
      } else finish();
      return;
    }

    ctx.editBtn.style.visibility = 'hidden';
    ctx.speakBtn.style.display = 'none';

    const widget = createMatchRound(batch, {
      promptSide: pickSide(),
      onRoundComplete: results => gradeMatchResults(ctx, results, { countAsOne }),
    });
    mountStage(widget.box, first, { destroy: widget.destroy });
  }

  function finish() {
    if (ctx.undoToastDismiss) { ctx.undoToastDismiss(); ctx.undoToastDismiss = null; }
    clearStage();
    ctx.answered = finishProgressAnswered(ctx.sessionTotal);
    updateBar();
    ctx.editBtn.style.visibility = 'hidden';
    ctx.speakBtn.style.display = 'none';
    ctx.stage.innerHTML = '';
    const introEl = ctx.stage.closest('.view')?.querySelector('.review-intro');
    if (introEl) (introEl as HTMLElement).hidden = true;
    ctx.stage.parentElement?.classList.add('review-wrap--done');
    const stars = computeLessonStars({ stats: ctx.stats as unknown as LessonStats, sessionCards: ctx.sessionTotal });
    const known = ctx.stats.known;
    const failed = ctx.stats.failed;
    const homeHash = ctx.folderId ? '#folder/' + ctx.folderId : '#home';
    ctx.stage.append(el('div', { class: 'review-done' }, [
      el('img', { class: 'review-done-raven', src: 'icons/raven.svg', alt: '', draggable: 'false' }),
      el('h2', null, 'Сессия завершена!'),
      el('p', { class: 'review-done-sub' }, 'Ворона довольна. Возвращайтесь завтра — память любит ритм.'),
      lessonRewardBox(stars),
      el('div', { class: 'review-done-stats' }, [
        el('div', { class: 'review-done-stat is-ok' }, [
          el('div', { class: 'review-done-stat-val' }, String(known)),
          el('div', { class: 'review-done-stat-lab' }, 'знаю'),
        ]),
        el('div', { class: 'review-done-stat is-fail' }, [
          el('div', { class: 'review-done-stat-val' }, String(failed)),
          el('div', { class: 'review-done-stat-lab' }, 'повторить ещё'),
        ]),
      ]),
      el('div', { class: 'review-done-actions' }, [
        el('button', {
          class: 'btn accent review-done-again',
          onclick: () => studyModePicker({
            folderId: ctx.folderId || undefined,
            cram: ctx.cram || undefined,
          }),
        }, 'Ещё раз'),
        el('button', {
          class: 'btn review-done-home',
          onclick: () => nav(homeHash),
        }, ctx.folderId ? 'К папке' : 'На главную'),
      ]),
    ]));
    playLessonCompleteFromStore(stars);
  }

  ctx.updateBar = updateBar;
  ctx.trackFlipFirstTry = trackFlipFirstTry;
  ctx.showNext = showNext;

  showNext(true);
}
