/** Кэш WAV Orpheus в IndexedDB — одно озвучивание на пару (текст + голос). */

import { normalizeOrpheusVoice } from '../lib/orpheus-tts.js';

const DB_NAME = 'kartochki-tts';
const STORE = 'audio';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;

function getDB() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) dbPromise = openDB().catch(() => null);
  return dbPromise;
}

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export async function ttsCacheKey(text, voice) {
  const payload = `v2|${normalizeOrpheusVoice(voice)}|${String(text || '').trim()}`;
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
    } catch (e) { /* fallback */ }
  }
  return simpleHash(payload);
}

export async function getCachedTts(key) {
  const db = await getDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setCachedTts(key, blob) {
  const db = await getDB();
  if (!db || !blob) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
