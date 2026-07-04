export const DEFAULT_SETTINGS = {
  algo: 'sm2',
  direction: 'ftb',
  newPerDay: 20,
  leitnerIntervals: [1, 2, 4, 8, 16],
  calendarPlace: 'left',
  streakRingDays: 21,
  tts: true,
  ttsRate: 1,
};

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
