import { createFlipCard } from '../flip-card.js';

/** Обёртка над классическим flip-режимом. */
export function createFlipModeCard(card, ctx) {
  return createFlipCard(card, ctx.promptSide, {
    stageContains: ctx.stageContains,
    onFirstFlip: ctx.onFirstFlip,
    onFlip: ctx.onFlip,
    onGradeKey: ctx.onGradeKey,
    onGradeDir: ctx.onGradeDir,
  });
}
