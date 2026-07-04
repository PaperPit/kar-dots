// ============================================================
// КАР-точки — слой данных
// Два хранилища с одинаковым интерфейсом:
//   LocalStore — демо-режим, IndexedDB в этом браузере
//   CloudStore — Supabase: синхронизация между устройствами
// Все данные держим в памяти (this.folders / this.cards) —
// для прототипа это быстро и просто.
// ============================================================
(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    algo: 'sm2',                    // 'sm2' | 'leitner'
    direction: 'ftb',               // 'ftb' | 'btf' | 'mixed'
    newPerDay: 20,
    leitnerIntervals: [1, 2, 4, 8, 16],
  };

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Сжимаем картинку до 1024px по большей стороне → JPEG/PNG blob
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

  // --- IndexedDB helper ------------------------------------
  const IDB_NAME = 'kartochki';
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }
  function getAll(db, store) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ==========================================================
  // LocalStore — демо-режим
  // ==========================================================
  function LocalStore() {
    this.kind = 'local';
    this.folders = [];
    this.cards = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
  }

  LocalStore.prototype.init = async function () {
    this.db = await openDB();
    this.folders = await getAll(this.db, 'folders');
    this.cards = await getAll(this.db, 'cards');
    const raw = localStorage.getItem('kar_settings_local');
    if (raw) try { this.settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch (e) {}
    this._sort();
  };

  LocalStore.prototype._sort = function () {
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this.cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  };

  LocalStore.prototype.createFolder = async function (data) {
    const f = { id: uuid(), name: data.name, color: data.color || '#7C8DB5', created_at: Date.now() };
    await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    this.folders.push(f); this._sort();
    return f;
  };

  LocalStore.prototype.updateFolder = async function (id, patch) {
    const f = this.folders.find(x => x.id === id);
    if (!f) return null;
    Object.assign(f, patch);
    await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    return f;
  };

  LocalStore.prototype.deleteFolder = async function (id) {
    const dead = this.cards.filter(c => c.folder_id === id);
    await tx(this.db, 'cards', 'readwrite', s => { dead.forEach(c => s.delete(c.id)); });
    await tx(this.db, 'folders', 'readwrite', s => s.delete(id));
    this.cards = this.cards.filter(c => c.folder_id !== id);
    this.folders = this.folders.filter(f => f.id !== id);
  };

  LocalStore.prototype.createCard = async function (data) {
    const c = Object.assign({
      id: uuid(), created_at: Date.now(),
      front: '', back: '', front_img: null, back_img: null,
      sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0, sm2_due: null,
      box: 0, box_due: null,
    }, data);
    await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    this.cards.unshift(c);
    return c;
  };

  LocalStore.prototype.updateCard = async function (id, patch) {
    const c = this.cards.find(x => x.id === id);
    if (!c) return null;
    Object.assign(c, patch);
    await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    return c;
  };

  LocalStore.prototype.deleteCard = async function (id) {
    await tx(this.db, 'cards', 'readwrite', s => s.delete(id));
    this.cards = this.cards.filter(c => c.id !== id);
  };

  // локально картинка хранится как dataURL прямо в карточке
  LocalStore.prototype.uploadImage = async function (file) {
    const blob = await resizeImage(file);
    return blobToDataURL(blob);
  };

  LocalStore.prototype.deleteImage = async function (url) { /* dataURL — нечего удалять */ };

  LocalStore.prototype.saveSettings = async function (s) {
    this.settings = s;
    localStorage.setItem('kar_settings_local', JSON.stringify(s));
  };

  LocalStore.prototype.exportJSON = function () {
    return JSON.stringify({ v: 1, folders: this.folders, cards: this.cards, settings: this.settings }, null, 2);
  };

  LocalStore.prototype.importJSON = async function (text) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const f of data.folders) {
      if (!this.folders.find(x => x.id === f.id)) {
        await tx(this.db, 'folders', 'readwrite', s => s.put(f));
        this.folders.push(f);
      }
    }
    for (const c of data.cards) {
      if (!this.cards.find(x => x.id === c.id)) {
        await tx(this.db, 'cards', 'readwrite', s => s.put(c));
        this.cards.push(c);
      }
    }
    this._sort();
  };

  // ==========================================================
  // CloudStore — Supabase
  // ==========================================================
  function CloudStore(sb) {
    this.kind = 'cloud';
    this.sb = sb;
    this.folders = [];
    this.cards = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
  }

  CloudStore.prototype.init = async function () {
    const uid = this.sb.userId();
    const [folders, cards, settingsRows] = await Promise.all([
      this.sb.select('folders', 'select=*&order=created_at.asc'),
      this.sb.select('cards', 'select=*&order=created_at.desc'),
      this.sb.select('settings', 'select=*&user_id=eq.' + uid),
    ]);
    this.folders = folders;
    this.cards = cards;
    if (settingsRows.length && settingsRows[0].data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRows[0].data);
    }
  };

  CloudStore.prototype.createFolder = async function (data) {
    const row = await this.sb.insert('folders', {
      id: uuid(), user_id: this.sb.userId(),
      name: data.name, color: data.color || '#7C8DB5', created_at: Date.now(),
    });
    this.folders.push(row);
    return row;
  };

  CloudStore.prototype.updateFolder = async function (id, patch) {
    const rows = await this.sb.update('folders', 'id=eq.' + id, patch);
    const f = this.folders.find(x => x.id === id);
    if (f && rows.length) Object.assign(f, rows[0]);
    return f;
  };

  CloudStore.prototype.deleteFolder = async function (id) {
    // картинки карточек папки — из Storage
    const dead = this.cards.filter(c => c.folder_id === id);
    for (const c of dead) {
      await this._removeCardImages(c);
    }
    await this.sb.remove('cards', 'folder_id=eq.' + id);
    await this.sb.remove('folders', 'id=eq.' + id);
    this.cards = this.cards.filter(c => c.folder_id !== id);
    this.folders = this.folders.filter(f => f.id !== id);
  };

  CloudStore.prototype.createCard = async function (data) {
    const row = await this.sb.insert('cards', Object.assign({
      id: uuid(), user_id: this.sb.userId(), created_at: Date.now(),
      front: '', back: '', front_img: null, back_img: null,
      sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0, sm2_due: null,
      box: 0, box_due: null,
    }, data));
    this.cards.unshift(row);
    return row;
  };

  CloudStore.prototype.updateCard = async function (id, patch) {
    const rows = await this.sb.update('cards', 'id=eq.' + id, patch);
    const c = this.cards.find(x => x.id === id);
    if (c && rows.length) Object.assign(c, rows[0]);
    return c;
  };

  CloudStore.prototype.deleteCard = async function (id) {
    const c = this.cards.find(x => x.id === id);
    if (c) await this._removeCardImages(c);
    await this.sb.remove('cards', 'id=eq.' + id);
    this.cards = this.cards.filter(x => x.id !== id);
  };

  CloudStore.prototype._removeCardImages = async function (card) {
    for (const url of [card.front_img, card.back_img]) {
      if (url) await this.deleteImage(url);
    }
  };

  CloudStore.prototype.uploadImage = async function (file) {
    const blob = await resizeImage(file);
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = this.sb.userId() + '/' + uuid() + '.' + ext;
    return this.sb.uploadFile('card-images', path, blob, blob.type);
  };

  CloudStore.prototype.deleteImage = async function (url) {
    const marker = '/object/public/card-images/';
    const i = url.indexOf(marker);
    if (i === -1) return;
    await this.sb.deleteFile('card-images', url.slice(i + marker.length));
  };

  CloudStore.prototype.saveSettings = async function (s) {
    this.settings = s;
    await this.sb.upsert('settings', { user_id: this.sb.userId(), data: s });
  };

  CloudStore.prototype.exportJSON = LocalStore.prototype.exportJSON;

  CloudStore.prototype.importJSON = async function (text) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const f of data.folders) {
      if (this.folders.find(x => x.id === f.id)) continue;
      const row = Object.assign({}, f, { user_id: this.sb.userId() });
      this.folders.push(await this.sb.insert('folders', row));
    }
    for (const c of data.cards) {
      if (this.cards.find(x => x.id === c.id)) continue;
      const row = Object.assign({}, c, { user_id: this.sb.userId() });
      // dataURL-картинки из демо-режима переносим в Storage
      for (const side of ['front_img', 'back_img']) {
        if (row[side] && row[side].startsWith('data:')) {
          try {
            const blob = await (await fetch(row[side])).blob();
            const ext = blob.type === 'image/png' ? 'png' : 'jpg';
            row[side] = await this.sb.uploadFile('card-images', this.sb.userId() + '/' + uuid() + '.' + ext, blob, blob.type);
          } catch (e) { row[side] = null; }
        }
      }
      this.cards.push(await this.sb.insert('cards', row));
    }
    this.cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  };

  window.KarStore = { LocalStore, CloudStore, DEFAULT_SETTINGS, uuid };
})();
