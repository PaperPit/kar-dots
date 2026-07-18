import type { SrsRow } from "../lib/srs.js";

export interface Card {
  id?: string;
  front: string;
  back: string;
  description?: string;
  front_img?: string;
  back_img?: string;
  tagIds?: string[];
  srs?: SrsRow;
  date?: Date;
  folderId?: string;
  folder_id?: string;
  updated_at?: number;
  created_at?: number | null;
  lastReview?: Date;
  reviewCount?: number;
  relearningSteps?: number;
  state?: string;
  priority?: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  usage?: number;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string | null;
  cardIds?: string[];
  boxId?: string;
  box_id?: string | null;
  pack_id?: string | null;
  pack_version?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
  public?: boolean;
  key?: string;
  shared?: Record<string, unknown> | null;
}

export interface Box {
  id: string;
  name: string;
  color?: string;
  icon?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
  cardIds?: string[];
}

export interface Settings {
  algo: "sm2" | "fsrs" | "leiter"; // Leitner system
  theme: "light" | "dark";
  direction?: "ftb" | "btf";
  showCalendar?: "left" | "right" | "hidden";
  calendarPlace?: "left" | "right";
  dateLocale?: string;
  importTagMode?: "new" | "existing" | "merge";
  importConfirm?: boolean;
  autoTag?: boolean;
  searchScope?: "all" | "cards" | "tags";
  newCardsPerDay?: number;
  newPerDay?: number;
  leitnerIntervals?: number[];
  repeatToday?: "include" | "only";
  resetDay?: "auto" | "custom";
  resetDayCustom?: number;
  newCardsBeforeReview?: "include" | "delay";
  newCardsDelay?: number;
  reviewLimit?: number;
  maxReviewsPerDay?: number;
  repeatingTime?: "allow" | "disallow";
  position?: "top" | "bottom";
  uiClickSound?: string;
  language?: string;
  version?: string;
  streakRingDays?: number;
  tts?: boolean;
  ttsRate?: number;
  ttsAuto?: boolean;
  ttsOrpheus?: boolean;
  ttsVoiceRu?: string;
  ttsVoiceEn?: string;
  successSound?: string;
  failSound?: string;
  answerSoundMode?: "question" | "answer" | "both" | "none";
  cupMelody?: string;
  supadataApiKey?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  pixabayApiKey?: string;
  giphyApiKey?: string;
}
