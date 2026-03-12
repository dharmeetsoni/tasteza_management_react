/**
 * Tasteza Offline Queue — IndexedDB-backed mutation queue
 * 
 * When the server is unreachable, write operations (orders, KOTs, payments)
 * are stored here and replayed when the connection returns.
 */

const DB_NAME    = 'tasteza-offline';
const DB_VERSION = 1;
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        const s = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        s.createIndex('ts', 'ts');
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
    req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
  });
}

// ── Mutation queue ───────────────────────────────────────

export async function queuePush(item) {
  const db = await openDB();
  return idb(db, 'queue', 'readwrite', s => s.add({ ...item, ts: Date.now() }));
}

export async function queueGetAll() {
  const db = await openDB();
  return idb(db, 'queue', 'readonly', s => s.getAll());
}

export async function queueRemove(id) {
  const db = await openDB();
  return idb(db, 'queue', 'readwrite', s => s.delete(id));
}

export async function queueCount() {
  const db = await openDB();
  return idb(db, 'queue', 'readonly', s => s.count());
}

// ── Read cache ───────────────────────────────────────────

export async function cacheSet(key, data) {
  const db = await openDB();
  return idb(db, 'cache', 'readwrite', s => s.put({ key, data, ts: Date.now() }));
}

export async function cacheGet(key) {
  const db = await openDB();
  const row = await idb(db, 'cache', 'readonly', s => s.get(key));
  return row ? row.data : null;
}

// ── Helper ───────────────────────────────────────────────
function idb(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    if (req && req.onsuccess !== undefined) {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    }
  });
}
