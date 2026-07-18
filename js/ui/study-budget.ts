import { store } from '../core/state.js';
import { stripHtml } from './ui.js';

export function newBudget() {
  const s = store.settings;
  let rec = { date: '', count: 0 };
  try { rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}'); } catch (e) {}
  const today = new Date().toDateString();
  if (rec.date !== today) rec = { date: today, count: 0 };
  return Math.max(0, (s.newPerDay || 20) - (rec.count || 0));
}

export function spendNewBudget() {
  const today = new Date().toDateString();
  let rec = { date: today, count: 0 };
  try {
    rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}');
    if (rec.date !== today) rec = { date: today, count: 0 };
  } catch (e) {}
  rec.count = (rec.count || 0) + 1;
  localStorage.setItem('kar_new_today', JSON.stringify(rec));
}

export function refundNewBudget() {
  const today = new Date().toDateString();
  let rec = { date: today, count: 0 };
  try {
    rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}');
    if (rec.date !== today) return;
  } catch (e) { return; }
  rec.count = Math.max(0, (rec.count || 0) - 1);
  localStorage.setItem('kar_new_today', JSON.stringify(rec));
}
