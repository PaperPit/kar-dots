// CloudStore — Supabase + локальное зеркало + офлайн-очередь
import * as SRS from '../lib/srs.js';
import { isNetworkError } from './supabase.js';
import {
  openMirrorDB, getAll, mirrorReplaceAll, mirrorPut, mirrorDelete,
  mirrorGetKV, mirrorSetKV, indexGetAll, SyncQueue,
} from './sync-queue.js';
import { DEFAULT_SETTINGS, uuid } from './store-common.js';

const SRS_FIELDS = 'id,folder_id,sm2_ef,sm2_reps,sm2_ivl,sm2_due,box,box_due,created_at';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resizeImage(file, maxSide) {
  maxSide = maxSide || 1024;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Не удалось обработать картинку')),
        hasAlpha ? 'image/png' : 'image/jpeg',
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Файл не похож на картинку')); };
    img.src = url;
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

export class CloudStore {
  constructor(sb) {
    this.kind = 'cloud';
    this.sb = sb;
    this.folders = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this._folderCache = new Map();
    this._cardCounts = new Map();
    this._srsMeta = null;
    this._offline = false;
    this.queue = new SyncQueue();
    this.mirror = null;
    this._onSyncChange = null;
  }

  onSyncChange(fn) { this._onSyncChange = fn; }

  async _notifySync() {
    if (this._onSyncChange) this._onSyncChange(await this.pendingSync(), this._offline);
  }

  get offline() { return this._offline; }

  async pendingSync() {
    if (!this.queue.db) return 0;
    return this.queue.size();
  }

  async init() {
    this.mirror = await openMirrorDB();
    await this.queue.init(this.mirror);
    this.queue.onFlush(item => this._executeSyncItem(item));
    window.addEventListener('online', () => this._onOnline());
    await this._loadData();
  }

  async _onOnline() {
    this._offline = false;
    await this.flushSync();
    try { await this._fetchFromCloud(); this._notifySync(); } catch (e) { /* mirror */ }
  }

  async flushSync() {
    const r = await this.queue.flush();
    if (r.ok > 0) this._notifySync();
    return r;
  }

  async _loadData() {
    if (navigator.onLine) {
      try {
        await this._fetchFromCloud();
        this._offline = false;
        await this.flushSync();
      } catch (e) {
        if (isNetworkError(e)) await this._loadFromMirror();
        else throw e;
      }
    } else {
      await this._loadFromMirror();
    }
    this._notifySync();
  }

  async _fetchFromCloud() {
    const uid = this.sb.userId();
    const [folders, srsMeta, settingsRows] = await Promise.all([
      this.sb.select('folders', 'select=*&order=created_at.asc'),
      this.sb.select('cards', 'select=' + SRS_FIELDS),
      this.sb.select('settings', 'select=*&user_id=eq.' + uid),
    ]);
    this.folders = folders;
    await mirrorReplaceAll(this.mirror, 'folders', folders);
    this._srsMeta = srsMeta;
    this._folderCache.clear();
    this._cardCounts.clear();
    for (const f of folders) {
      this._cardCounts.set(f.id, srsMeta.filter(c => c.folder_id === f.id).length);
    }
    if (settingsRows.length && settingsRows[0].data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRows[0].data);
    }
    await mirrorSetKV(this.mirror, 'settings', this.settings);
    await mirrorSetKV(this.mirror, 'srs_meta', srsMeta);
    this._offline = false;
  }

  async _loadFromMirror() {
    this.folders = await getAll(this.mirror, 'folders');
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const settings = await mirrorGetKV(this.mirror, 'settings');
    if (settings) this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    const meta = await mirrorGetKV(this.mirror, 'srs_meta');
    this._srsMeta = meta || [];
    this._folderCache.clear();
    this._cardCounts.clear();
    for (const f of this.folders) {
      this._cardCounts.set(f.id, (this._srsMeta || []).filter(c => c.folder_id === f.id).length);
    }
    this._offline = true;
  }

  async _cloudOrQueue(op, payload, localFn) {
    const result = await localFn();
    if (!navigator.onLine) {
      this._offline = true;
      await this.queue.enqueue({ op, payload });
      this._notifySync();
      return result;
    }
    try {
      await this._executeSyncItem({ op, payload });
      this._offline = false;
      return result;
    } catch (e) {
      if (isNetworkError(e)) {
        this._offline = true;
        await this.queue.enqueue({ op, payload });
        this._notifySync();
        return result;
      }
      throw e;
    }
  }

  async _executeSyncItem({ op, payload }) {
    switch (op) {
      case 'createFolder': await this.sb.insert('folders', payload.row); break;
      case 'updateFolder': await this.sb.update('folders', 'id=eq.' + payload.id, payload.patch); break;
      case 'deleteFolder':
        await this.sb.remove('cards', 'folder_id=eq.' + payload.id);
        await this.sb.remove('folders', 'id=eq.' + payload.id);
        break;
      case 'createCard': await this.sb.insert('cards', payload.row); break;
      case 'updateCard': await this.sb.update('cards', 'id=eq.' + payload.id, payload.patch); break;
      case 'deleteCard':
        if (payload.urls) for (const url of payload.urls) await this.deleteImage(url);
        await this.sb.remove('cards', 'id=eq.' + payload.id);
        break;
      case 'saveSettings':
        await this.sb.upsert('settings', { user_id: this.sb.userId(), data: payload.settings });
        break;
      case 'uploadImage':
        payload.url = await this.sb.uploadFile('card-images', payload.path, payload.blob, payload.contentType);
        if (payload.cardId && payload.side) {
          await this.sb.update('cards', 'id=eq.' + payload.cardId, { [payload.side]: payload.url });
        }
        break;
      default: throw new Error('Unknown sync op: ' + op);
    }
  }

  _patchSrsMeta(card) {
    if (!this._srsMeta) this._srsMeta = [];
    const i = this._srsMeta.findIndex(c => c.id === card.id);
    const slim = {
      id: card.id, folder_id: card.folder_id,
      sm2_ef: card.sm2_ef, sm2_reps: card.sm2_reps, sm2_ivl: card.sm2_ivl, sm2_due: card.sm2_due,
      box: card.box, box_due: card.box_due, created_at: card.created_at,
    };
    if (i >= 0) this._srsMeta[i] = slim;
    else this._srsMeta.push(slim);
    mirrorSetKV(this.mirror, 'srs_meta', this._srsMeta);
  }

  _patchSrsMetaRemoval(id) {
    if (!this._srsMeta) return;
    this._srsMeta = this._srsMeta.filter(c => c.id !== id);
    mirrorSetKV(this.mirror, 'srs_meta', this._srsMeta);
  }

  async getFolderCards(folderId) {
    if (this._folderCache.has(folderId)) return this._folderCache.get(folderId);
    let cards;
    if (navigator.onLine && !this._offline) {
      try {
        cards = await this.sb.select('cards', 'folder_id=eq.' + folderId + '&order=created_at.desc');
        for (const c of cards) await mirrorPut(this.mirror, 'cards', c);
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true;
          cards = await indexGetAll(this.mirror, 'cards', 'folder_id', folderId);
        } else throw e;
      }
    } else {
      cards = await indexGetAll(this.mirror, 'cards', 'folder_id', folderId);
    }
    cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    this._folderCache.set(folderId, cards);
    return cards;
  }

  async countCards(folderId) {
    if (folderId) return this._cardCounts.get(folderId) || 0;
    let n = 0;
    for (const c of this._cardCounts.values()) n += c;
    return n;
  }

  async countDue(folderId, algo) {
    algo = algo || this.settings.algo;
    const now = Date.now();
    if (navigator.onLine && !this._offline) {
      try { return await this._countDueCloud(folderId, algo, now); }
      catch (e) { if (!isNetworkError(e)) throw e; this._offline = true; }
    }
    return this._countDueLocal(folderId, algo, now);
  }

  async _countDueCloud(folderId, algo, now) {
    const uid = this.sb.userId();
    let base = 'user_id=eq.' + uid;
    if (folderId) base += '&folder_id=eq.' + folderId;
    if (algo === 'leitner') return this.sb.count('cards', base + '&box=gt.0&box_due=lte.' + now);
    return this.sb.count('cards', base + '&sm2_due=not.is.null&sm2_due=lte.' + now);
  }

  _countDueLocal(folderId, algo, now) {
    const meta = (this._srsMeta || []).filter(c => !folderId || c.folder_id === folderId);
    return meta.filter(c => SRS.isDue(c, algo, now)).length;
  }

  async countNew(folderId, algo) {
    algo = algo || this.settings.algo;
    if (navigator.onLine && !this._offline) {
      try {
        const uid = this.sb.userId();
        let base = 'user_id=eq.' + uid;
        if (folderId) base += '&folder_id=eq.' + folderId;
        if (algo === 'leitner') return this.sb.count('cards', base + '&box=eq.0');
        return this.sb.count('cards', base + '&sm2_reps=eq.0&sm2_due=is.null');
      } catch (e) { if (!isNetworkError(e)) throw e; this._offline = true; }
    }
    const meta = (this._srsMeta || []).filter(c => !folderId || c.folder_id === folderId);
    return meta.filter(c => SRS.isNew(c, algo)).length;
  }

  async getReviewCards(folderId, algo, newLimit, now) {
    algo = algo || this.settings.algo;
    now = now || Date.now();
    if (navigator.onLine && !this._offline) {
      try {
        const uid = this.sb.userId();
        const prefix = folderId ? 'folder_id=eq.' + folderId + '&user_id=eq.' + uid : 'user_id=eq.' + uid;
        const dueQ = algo === 'leitner'
          ? prefix + '&box=gt.0&box_due=lte.' + now + '&select=*'
          : prefix + '&sm2_due=not.is.null&sm2_due=lte.' + now + '&select=*';
        const newQ = algo === 'leitner'
          ? prefix + '&box=eq.0&select=*&limit=' + newLimit
          : prefix + '&sm2_reps=eq.0&sm2_due=is.null&select=*&limit=' + newLimit;
        const [dueCards, newCards] = await Promise.all([
          this.sb.select('cards', dueQ),
          this.sb.select('cards', newQ),
        ]);
        for (const c of dueCards.concat(newCards)) await mirrorPut(this.mirror, 'cards', c);
        return { due: shuffle(dueCards), fresh: shuffle(newCards).slice(0, newLimit) };
      } catch (e) { if (!isNetworkError(e)) throw e; this._offline = true; }
    }

    const due = [];
    const fresh = [];
    const source = folderId ? await this.getFolderCards(folderId) : (this._srsMeta || []);
    for (const meta of source) {
      let c = meta;
      if (!meta.front) {
        const full = await this._getCardById(meta.id);
        if (full) c = full;
      }
      if (SRS.isDue(c, algo, now)) due.push(c);
      else if (SRS.isNew(c, algo)) fresh.push(c);
    }
    return { due: shuffle(due), fresh: shuffle(fresh).slice(0, newLimit) };
  }

  async _getCardById(id) {
    for (const list of this._folderCache.values()) {
      const c = list.find(x => x.id === id);
      if (c) return c;
    }
    return new Promise((resolve, reject) => {
      const req = this.mirror.transaction('cards').objectStore('cards').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async createFolder(data) {
    const row = { id: uuid(), user_id: this.sb.userId(), name: data.name, color: data.color || '#7C8DB5', created_at: Date.now() };
    this.folders.push(row);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cardCounts.set(row.id, 0);
    await mirrorPut(this.mirror, 'folders', row);
    return this._cloudOrQueue('createFolder', { row }, async () => row);
  }

  async updateFolder(id, patch) {
    const f = this.folders.find(x => x.id === id);
    if (!f) return null;
    Object.assign(f, patch);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id, patch }, async () => f);
  }

  async deleteFolder(id) {
    const dead = await indexGetAll(this.mirror, 'cards', 'folder_id', id);
    for (const c of dead) await this._removeCardImages(c);
    for (const c of dead) await mirrorDelete(this.mirror, 'cards', c.id);
    await mirrorDelete(this.mirror, 'folders', id);
    this.folders = this.folders.filter(f => f.id !== id);
    this._folderCache.delete(id);
    this._cardCounts.delete(id);
    if (this._srsMeta) this._srsMeta = this._srsMeta.filter(c => c.folder_id !== id);
    return this._cloudOrQueue('deleteFolder', { id }, async () => true);
  }

  async createCard(data) {
    const row = Object.assign({
      id: uuid(), user_id: this.sb.userId(), created_at: Date.now(),
      front: '', back: '', description: '', front_img: null, back_img: null,
      sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0, sm2_due: null, box: 0, box_due: null,
    }, data);
    await mirrorPut(this.mirror, 'cards', row);
    this._patchSrsMeta(row);
    const cached = this._folderCache.get(row.folder_id);
    if (cached) cached.unshift(row);
    this._cardCounts.set(row.folder_id, (this._cardCounts.get(row.folder_id) || 0) + 1);
    return this._cloudOrQueue('createCard', { row }, async () => row);
  }

  async updateCard(id, patch) {
    let c = await this._getCardById(id);
    if (!c) return null;
    Object.assign(c, patch);
    await mirrorPut(this.mirror, 'cards', c);
    this._patchSrsMeta(c);
    for (const list of this._folderCache.values()) {
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) Object.assign(list[idx], patch);
    }
    return this._cloudOrQueue('updateCard', { id, patch }, async () => c);
  }

  async deleteCard(id) {
    const c = await this._getCardById(id);
    const urls = c ? [c.front_img, c.back_img].filter(Boolean) : [];
    if (c) {
      await this._removeCardImages(c);
      await mirrorDelete(this.mirror, 'cards', id);
      this._patchSrsMetaRemoval(id);
      const list = this._folderCache.get(c.folder_id);
      if (list) {
        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) list.splice(idx, 1);
      }
      this._cardCounts.set(c.folder_id, Math.max(0, (this._cardCounts.get(c.folder_id) || 1) - 1));
    }
    return this._cloudOrQueue('deleteCard', { id, urls }, async () => true);
  }

  async _removeCardImages(card) {
    for (const url of [card.front_img, card.back_img]) {
      if (url) await this.deleteImage(url);
    }
  }

  async uploadImage(file) {
    const blob = await resizeImage(file);
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = this.sb.userId() + '/' + uuid() + '.' + ext;
    if (!navigator.onLine) {
      const dataUrl = await blobToDataURL(blob);
      await this.queue.enqueue({ op: 'uploadImage', payload: { path, blob, contentType: blob.type } });
      this._offline = true;
      this._notifySync();
      return dataUrl;
    }
    try {
      return await this.sb.uploadFile('card-images', path, blob, blob.type);
    } catch (e) {
      if (isNetworkError(e)) {
        const dataUrl = await blobToDataURL(blob);
        await this.queue.enqueue({ op: 'uploadImage', payload: { path, blob, contentType: blob.type } });
        this._offline = true;
        this._notifySync();
        return dataUrl;
      }
      throw e;
    }
  }

  async deleteImage(url) {
    const marker = '/object/public/card-images/';
    const i = url.indexOf(marker);
    if (i === -1) return;
    try { await this.sb.deleteFile('card-images', url.slice(i + marker.length)); } catch (e) {}
  }

  async saveSettings(s) {
    this.settings = s;
    await mirrorSetKV(this.mirror, 'settings', s);
    return this._cloudOrQueue('saveSettings', { settings: s }, async () => s);
  }

  async exportJSONFull() {
    const cards = await getAll(this.mirror, 'cards');
    return JSON.stringify({ v: 1, folders: this.folders, cards, settings: this.settings }, null, 2);
  }

  async importJSON(text) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const f of data.folders) {
      if (this.folders.find(x => x.id === f.id)) continue;
      const row = Object.assign({}, f, { user_id: this.sb.userId() });
      this.folders.push(row);
      await mirrorPut(this.mirror, 'folders', row);
      await this._cloudOrQueue('createFolder', { row }, async () => row);
    }
    for (const c of data.cards) {
      if (c.description == null) c.description = '';
      const row = Object.assign({}, c, { user_id: this.sb.userId() });
      for (const side of ['front_img', 'back_img']) {
        if (row[side] && row[side].startsWith('data:')) {
          try {
            const blob = await (await fetch(row[side])).blob();
            const ext = blob.type === 'image/png' ? 'png' : 'jpg';
            row[side] = await this.uploadImage(new File([blob], 'img.' + ext, { type: blob.type }));
          } catch (e) { row[side] = null; }
        }
      }
      await mirrorPut(this.mirror, 'cards', row);
      this._patchSrsMeta(row);
      await this._cloudOrQueue('createCard', { row }, async () => row);
    }
    if (data.settings) await this.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings));
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._folderCache.clear();
    for (const f of this.folders) {
      this._cardCounts.set(f.id, (this._srsMeta || []).filter(x => x.folder_id === f.id).length);
    }
  }
}
