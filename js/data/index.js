export { DEFAULT_SETTINGS, uuid } from './store-common.js';
export { LocalStore } from './store-local.js';
export { CloudStore } from './store-cloud.js';

/** Нормализует карточку после загрузки (старые бэкапы без description). */
export function normalizeCard(card) {
  if (card.description === undefined || card.description === null) card.description = '';
  return card;
}
