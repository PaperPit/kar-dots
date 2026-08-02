/** Minimal IndexedDB shim for LocalStore / CloudStore mirror tests (happy-dom has no IDB). */

function defer(fn) {
  queueMicrotask(fn);
}

function makeRequest(result) {
  const req = { result, error: null, onsuccess: null, onerror: null };
  defer(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
  return req;
}

function makeObjectStore(map, indexes = {}, keyPath = 'id') {
  const indexNames = {
    _set: new Set(Object.keys(indexes)),
    contains(name) { return this._set.has(name); },
    has(name) { return this._set.has(name); },
    add(name) { this._set.add(name); },
    get size() { return this._set.size; },
    [Symbol.iterator]() { return this._set[Symbol.iterator](); },
  };

  function all() {
    return [...map.values()];
  }

  function rowsForIndex(name, key) {
    const field = indexes[name];
    if (key == null) return all();
    if (typeof key === 'object' && ('lower' in key || 'upper' in key)) {
      return all().filter(r => {
        const value = r[field];
        if ('lower' in key && value < key.lower) return false;
        if ('upper' in key && value > key.upper) return false;
        return true;
      });
    }
    return all().filter(r => r[field] === key);
  }

  function openCursor(rows) {
    let i = 0;
    const req = { result: null, error: null, onsuccess: null, onerror: null };
    const step = () => {
      if (i < rows.length) {
        const value = rows[i++];
        req.result = { value, continue: step };
      } else {
        req.result = null;
      }
      if (req.onsuccess) req.onsuccess({ target: req });
    };
    defer(step);
    return req;
  }

  const store = {
    indexNames,
    put(v, key) {
      if (key != null) {
        map.set(key, v);
        return;
      }
      const k = v[keyPath];
      map.set(k, { ...v });
    },
    add(v) {
      // Автоинкремент не переиспользует ключи после delete (в отличие от map.size + 1):
      // иначе повторная постановка в очередь затирала бы соседний элемент.
      let k = v.id;
      if (k == null) {
        let max = 0;
        for (const key of map.keys()) if (typeof key === 'number' && key > max) max = key;
        k = max + 1;
      }
      map.set(k, { ...v, id: k });
    },
    delete(k) {
      map.delete(k);
    },
    get(k) {
      return makeRequest(map.get(k));
    },
    getAll() {
      return makeRequest(all());
    },
    count() {
      return makeRequest(map.size);
    },
    clear() {
      map.clear();
    },
    createIndex(name, field) {
      indexes[name] = field;
      indexNames.add(name);
    },
    index(name) {
      return {
        getAll(key) {
          return makeRequest(rowsForIndex(name, key));
        },
        openCursor(range) {
          return openCursor(rowsForIndex(name, range));
        },
      };
    },
    openCursor() {
      return openCursor(all());
    },
  };
  return store;
}

function indexesFor(name) {
  if (name === 'cards') return { folder_id: 'folder_id', note_id: 'note_id' };
  if (name === 'notes' || name === 'note_conflicts') return { conflict_of: 'conflict_of', updated_at: 'updated_at' };
  if (name === 'note_terms') return { term: 'term', note_id: 'note_id' };
  return {};
}

export function installFakeIDB({
  folders = [],
  cards = [],
  boxes = [],
  notes = [],
  note_conflicts = [],
  note_terms = [],
  kv = {},
} = {}) {
  const maps = {
    folders: new Map(folders.map(f => [f.id, { ...f }])),
    cards: new Map(cards.map(c => [c.id, { ...c }])),
    boxes: new Map(boxes.map(b => [b.id, { ...b }])),
    notes: new Map(notes.map(n => [n.id, { ...n }])),
    note_conflicts: new Map(note_conflicts.map(n => [n.id, { ...n }])),
    note_terms: new Map(note_terms.map(n => [n.id, { ...n }])),
    kv: new Map(Object.entries(kv)),
    sync_queue: new Map(),
    sync_dead_letters: new Map(),
  };

  // Persistent index defs per store (createIndex mutates these).
  const indexDefs = {
    cards: { folder_id: 'folder_id', note_id: 'note_id' },
    notes: { conflict_of: 'conflict_of', updated_at: 'updated_at' },
    note_conflicts: { conflict_of: 'conflict_of' },
    note_terms: { term: 'term', note_id: 'note_id' },
  };

  function createDatabase() {
    const names = new Set(Object.keys(maps));
    const db = {
      objectStoreNames: {
        contains(n) { return names.has(n); },
      },
      createObjectStore(name, opts = {}) {
        names.add(name);
        if (!maps[name]) maps[name] = new Map();
        if (!indexDefs[name]) indexDefs[name] = indexesFor(name);
        const keyPath = opts.keyPath || 'id';
        const store = makeObjectStore(maps[name], indexDefs[name], keyPath);
        return store;
      },
      transaction(storeNames) {
        const tx = {
          error: null,
          oncomplete: null,
          onerror: null,
          objectStore(name) {
            if (!maps[name]) maps[name] = new Map();
            if (!indexDefs[name]) indexDefs[name] = indexesFor(name);
            const keyPath = name === 'kv' ? null : 'id';
            return makeObjectStore(maps[name], indexDefs[name], keyPath || 'id');
          },
        };
        // Allow multi-store ops to finish before complete.
        defer(() => { if (tx.oncomplete) tx.oncomplete(); });
        return tx;
      },
    };
    return db;
  }

  globalThis.IDBKeyRange = {
    only(v) { return { lower: v, upper: v }; },
    bound(lower, upper) { return { lower, upper }; },
  };
  globalThis.indexedDB = {
    open(_name, version) {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, transaction: null };
      defer(() => {
        const db = createDatabase();
        req.result = db;
        if (req.onupgradeneeded) {
          // Provide a transaction-like object for createIndex on existing stores.
          req.transaction = {
            objectStore(name) {
              return db.createObjectStore(name, { keyPath: name === 'kv' ? undefined : 'id' });
            },
          };
          req.onupgradeneeded({ oldVersion: 0, newVersion: version || 1, target: req });
        }
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
  };
}
