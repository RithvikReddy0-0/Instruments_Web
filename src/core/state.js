/**
 * Single source of truth.
 *
 *  - Observable  : subscribe(path, fn) + a "state:change" event on the bus
 *  - Serializable: toJSON() / hydrate(obj) over a plain-object tree
 *  - Undoable    : set() records an inverse op; undo()/redo() (capped history)
 *  - Persistent  : whitelisted slices autosaved (debounced) by the caller,
 *                  which listens for "state:change"
 *
 * Paths are dot-strings, e.g. set("settings.volume", 0.5).
 */

const HISTORY_LIMIT = 100;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function getPath(obj, path) {
  return path.split(".").reduce((node, key) => (node == null ? node : node[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((node, key) => {
    if (node[key] == null || typeof node[key] !== "object") node[key] = {};
    return node[key];
  }, obj);
  target[last] = value;
}

export class StateManager {
  constructor(bus, initial = {}) {
    this.bus = bus;
    this.data = clone(initial);
    this.subscribers = new Map(); // path -> Set<fn>
    this.history = [];
    this.future = [];
  }

  get(path) {
    return path ? clone(getPath(this.data, path)) : clone(this.data);
  }

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.record=true]  push an undo entry
   * @param {boolean} [opts.silent=false] skip notifications (used by hydrate)
   */
  set(path, value, opts = {}) {
    const { record = true, silent = false } = opts;
    const prev = clone(getPath(this.data, path));
    setPath(this.data, path, clone(value));

    if (record) {
      this.history.push({ path, prev, next: clone(value) });
      if (this.history.length > HISTORY_LIMIT) this.history.shift();
      this.future = []; // a new edit invalidates the redo stack
    }
    if (!silent) this._notify(path, value, prev);
  }

  undo() {
    const entry = this.history.pop();
    if (!entry) return false;
    setPath(this.data, entry.path, clone(entry.prev));
    this.future.push(entry);
    this._notify(entry.path, entry.prev, entry.next);
    return true;
  }

  redo() {
    const entry = this.future.pop();
    if (!entry) return false;
    setPath(this.data, entry.path, clone(entry.next));
    this.history.push(entry);
    this._notify(entry.path, entry.next, entry.prev);
    return true;
  }

  subscribe(path, fn) {
    if (!this.subscribers.has(path)) this.subscribers.set(path, new Set());
    this.subscribers.get(path).add(fn);
    return () => this.subscribers.get(path)?.delete(fn);
  }

  toJSON() {
    return clone(this.data);
  }

  /** Replace state from a serialized object without recording undo history. */
  hydrate(obj) {
    if (!obj || typeof obj !== "object") return;
    Object.keys(obj).forEach((key) => this.set(key, obj[key], { record: false, silent: true }));
    // One broadcast so views re-render against the fully-hydrated tree.
    this.subscribers.forEach((fns, path) => {
      const value = getPath(this.data, path);
      fns.forEach((fn) => fn(value, undefined));
    });
  }

  _notify(path, value, prev) {
    this.subscribers.get(path)?.forEach((fn) => fn(clone(value), clone(prev)));
    this.bus?.emit("state:change", { path, value: clone(value), prev: clone(prev) });
  }
}
