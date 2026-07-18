import type { SrsCard } from "../../../lib/srs.js";
import { createFlipCard } from '../flip-card.js';


interface FlipModeCtx {
  promptSide: 'front' | 'back';
  stageContains?: (n: Node) => boolean;
  onFirstFlip?: () => void;
  onFlip?: (side: string) => void;
  onGradeKey?: (key: string, gradeRow: HTMLElement) => void;
  onGradeDir?: (dir: 'left' | 'right', gradeRow: HTMLElement) => void;
}

/** Обёртка над классическим flip-режимом. */
export function createFlipModeCard(card: SrsCard, ctx: FlipModeCtx) {
  return createFlipCard(card, ctx.promptSide, {
    stageContains: ctx.stageContains,
    onFirstFlip: ctx.onFirstFlip,
    onFlip: ctx.onFlip,
    onGradeKey: ctx.onGradeKey,
    onGradeDir: ctx.onGradeDir,
  });
}
