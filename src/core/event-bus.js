/**
 * Minimal typed publish/subscribe bus.
 *
 * The decoupling layer for the whole app: input sources publish events
 * (e.g. "note:on") and subsystems subscribe, so modules never need direct
 * references to one another. Set `bus.debug = true` to log all traffic.
 *
 * Event taxonomy (the contract later phases build on):
 *   note:on            { note, velocity, source }
 *   note:off           { note, source }
 *   instrument:change  { id }
 *   state:change       { path, value, prev }
 *   audio:ready        {}
 *   transport:record | transport:stop | transport:replay
 *   recording:saved    { events }
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.debug = false;
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type, payload = {}) {
    if (this.debug) console.debug(`[bus] ${type}`, payload);
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    // Iterate a copy so a handler that unsubscribes mid-dispatch is safe.
    [...handlers].forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[bus] handler for "${type}" threw`, error);
      }
    });
  }
}
