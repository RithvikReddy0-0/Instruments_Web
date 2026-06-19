/**
 * Unified input abstraction.
 *
 * Translates mouse, touch, and keyboard into a single stream of
 * "note:on" / "note:off" events on the bus. Every downstream subsystem
 * (audio, recorder, practice, future piano roll) listens to that stream and
 * never cares where the note came from. Phase 3 adds a MIDI source that emits
 * the exact same events via emitNoteOn/emitNoteOff.
 */

const DEFAULT_VELOCITY = 0.78;

export class KeyboardManager {
  constructor(bus, surface) {
    this.bus = bus;
    this.surface = surface;
    this.keyMap = {};
    this.heldKeys = new Set();        // keyboard keys down now (key-repeat guard)
    this.activePointers = new Map();  // pointerId -> note
    this._bind();
  }

  /** Called whenever a new instrument is rendered. */
  setKeyMap(map) {
    this.keyMap = map || {};
  }

  emitNoteOn(note, velocity, source) {
    this.bus.emit("note:on", { note, velocity, source });
  }

  emitNoteOff(note, source) {
    this.bus.emit("note:off", { note, source });
  }

  _bind() {
    this.surface.addEventListener("pointerdown", (event) => {
      const target = event.target.closest?.("[data-note]");
      if (!target) return;
      event.preventDefault();
      const note = target.dataset.note;
      this.activePointers.set(event.pointerId, note);
      // Capture so we reliably receive pointerup even if the finger drifts.
      // Guarded: capture can throw (e.g. synthetic events) and must never
      // prevent the note from sounding.
      try {
        target.setPointerCapture?.(event.pointerId);
      } catch { /* capture unavailable — note still plays */ }
      this.emitNoteOn(note, DEFAULT_VELOCITY, "pointer");
    });

    const endPointer = (event) => {
      const note = this.activePointers.get(event.pointerId);
      if (note == null) return;
      this.activePointers.delete(event.pointerId);
      this.emitNoteOff(note, "pointer");
    };
    this.surface.addEventListener("pointerup", endPointer);
    this.surface.addEventListener("pointercancel", endPointer);

    document.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return; // transport shortcuts
      if (event.target.matches?.("input, select, textarea")) return;
      const key = event.key.toLowerCase();
      const mapped = this.keyMap[key];
      if (!mapped || this.heldKeys.has(key)) return;
      this.heldKeys.add(key);
      this.emitNoteOn(mapped.note, DEFAULT_VELOCITY, "keyboard");
    });

    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (!this.heldKeys.has(key)) return;
      this.heldKeys.delete(key);
      const mapped = this.keyMap[key];
      if (mapped) this.emitNoteOff(mapped.note, "keyboard");
    });
  }
}
