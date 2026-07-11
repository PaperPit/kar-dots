export const DEFAULT_SETTINGS = {
  algo: 'sm2',
  direction: 'ftb',
  newPerDay: 20,
  leitnerIntervals: [1, 2, 4, 8, 16],
  calendarPlace: 'left',
  streakRingDays: 21,
  tts: true,
  ttsRate: 1,
  ttsAuto: false,
  /** URI системного голоса (Speech Synthesis); пусто = авто. */
  ttsVoiceRu: '',
  ttsVoiceEn: '',
  successSound: 'confirm-tap',
  failSound: 'load-fail',
  answerSoundMode: 'both',
  cupMelody: 'show-alert',
  uiClickSound: 'none',
  /** Личный ключ Supadata — транскрипт YouTube (обязателен для импорта). */
  supadataApiKey: '',
  /** Личный ключ Google AI Studio для генерации карточек (пусто = серверный). */
  geminiApiKey: '',
  /** Личный ключ Groq (резерв генерации) для «Карточки из YouTube». */
  groqApiKey: '',
};

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
