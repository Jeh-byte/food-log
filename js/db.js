// Local-only storage. Everything lives in this browser's IndexedDB on the device.
// sw.js reads the same database for background reminders, so keep DB_NAME/stores in sync.

const DB_NAME = "food-log";
const DB_VERSION = 1;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("date", "date");
        db.createObjectStore("favorites", { keyPath: "id" });
        db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = "readonly") {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export async function getAll(name) {
  return wrap((await store(name)).getAll());
}

export async function put(name, value) {
  return wrap((await store(name, "readwrite")).put(value));
}

export async function remove(name, id) {
  return wrap((await store(name, "readwrite")).delete(id));
}

export async function clear(name) {
  return wrap((await store(name, "readwrite")).clear());
}

export async function entriesOn(date) {
  return wrap((await store("entries")).index("date").getAll(date));
}

export async function entriesBetween(from, to) {
  return wrap((await store("entries")).index("date").getAll(IDBKeyRange.bound(from, to)));
}

export async function getSetting(key, fallback) {
  const value = await wrap((await store("kv")).get(key));
  return value === undefined ? fallback : value;
}

export async function setSetting(key, value) {
  return wrap((await store("kv", "readwrite")).put(value, key));
}
