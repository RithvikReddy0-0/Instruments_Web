/**
 * Thin promise wrapper over IndexedDB. No external dependency.
 *
 * Object stores: settings, recordings, presets, practice.
 * Each is a simple key/value store. Falls back gracefully: if IndexedDB is
 * unavailable the methods resolve to no-ops / undefined so the app still runs.
 */

const DB_NAME = "instrumenthub-studio";
const DB_VERSION = 2;
const STORES = ["settings", "recordings", "presets", "practice", "sessions"];

export class Storage {
  constructor() {
    this.dbPromise = null;
    this.available = typeof indexedDB !== "undefined";
  }

  _open() {
    if (!this.available) return Promise.resolve(null);
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      console.warn("[storage] IndexedDB unavailable, persistence disabled", error);
      this.available = false;
      return null;
    });
    return this.dbPromise;
  }

  async _tx(store, mode, run) {
    const db = await this._open();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = run(tx.objectStore(store));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  get(store, key) {
    return this._tx(store, "readonly", (os) => os.get(key));
  }

  put(store, key, value) {
    return this._tx(store, "readwrite", (os) => os.put(value, key));
  }

  delete(store, key) {
    return this._tx(store, "readwrite", (os) => os.delete(key));
  }

  async list(store) {
    const db = await this._open();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
