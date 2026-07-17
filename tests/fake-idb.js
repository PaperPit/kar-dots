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
  const indexNames = new Set(Object.keys(indexes));

  function all() {
    return [...map.values()];
  }

  function rowsForIndex(name, key) {
    const field = indexes[name];
    return key == null ? all() : all().filter(r => r[field] === key);
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
      const k = v.id != null ? v.id : map.size + 1;
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
          return openCursor(rowsForIndex(name, range?.lower));
        },
      };
    },
    openCursor() {
      return openCursor(all());
    },
  };
  return store;
}

export function installFakeIDB({
  folders = [],
  cards = [],
  boxes = [],
  kv = {},
} = {}) {
  const maps = {
    folders: new Map(folders.map(f => [f.id, { ...f }])),
    cards: new Map(cards.map(c => [c.id, { ...c }])),
    boxes: new Map(boxes.map(b => [b.id, { ...b }])),
    kv: new Map(Object.entries(kv)),
    sync_queue: new Map(),
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
        const keyPath = opts.keyPath || 'id';
        const store = makeObjectStore(maps[name], name === 'cards' ? { folder_id: 'folder_id' } : {}, keyPath);
        if (name === 'cards' && !store.indexNames.has('folder_id')) {
          store.createIndex('folder_id', 'folder_id');
        }
        return store;
      },
      transaction(storeName) {
        const tx = {
          error: null,
          oncomplete: null,
          onerror: null,
          objectStore(name) {
            const idx = name === 'cards' ? { folder_id: 'folder_id' } : {};
            const keyPath = name === 'kv' ? null : 'id';
            return makeObjectStore(maps[name], idx, keyPath || 'id');
          },
        };
        defer(() => { if (tx.oncomplete) tx.oncomplete(); });
        return tx;
      },
    };
    return db;
  }

  globalThis.IDBKeyRange = {
    only(v) { return { lower: v, upper: v }; },
  };
  globalThis.indexedDB = {
    open(_name, version) {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      defer(() => {
        const db = createDatabase();
        req.result = db;
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ oldVersion: 2, newVersion: version || 2, target: req });
        }
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
  };
}
