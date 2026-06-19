/**
 * Canvas piano roll — renderer + editing surface.
 *
 * Performance: a single canvas, DPR-sized via ResizeObserver (no per-frame
 * layout reads), and note drawing virtualized to the visible time window. The
 * render loop runs only while playing or dragging; otherwise it redraws once
 * per interaction.
 *
 * Editing is pure: gestures build a working copy and commit through onEdit()
 * once (one undo entry per gesture). Accessible: the canvas is focusable, and
 * selected notes can be nudged/deleted with the keyboard.
 */

import { addNote, moveNote, resizeNote, deleteNotes, uid, pitchRange } from "./clip.js";

const RULER_H = 22;
const GUTTER_W = 46;
const RESIZE_HANDLE = 7;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

export class PianoRoll {
  constructor({ canvas, getClip, getTool, onEdit, onSelectionChange, reducedMotion = false }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getClip = getClip;
    this.getTool = getTool || (() => "select");
    this.onEdit = onEdit || (() => {});
    this.onSelectionChange = onSelectionChange || (() => {});
    this.reducedMotion = reducedMotion;

    this.pxPerSecond = 90;
    this.scrollX = 0;       // seconds
    this.minMidi = 48;
    this.maxMidi = 72;
    this.cssWidth = 0;
    this.cssHeight = 0;

    this.selection = new Set();
    this.cursorTime = null;
    this.drag = null;       // { mode, id, startX, startY, working }

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this._bindEvents();
    this.resize();
  }

  setClip(clip) {
    const range = pitchRange(clip);
    this.minMidi = Math.max(0, range.min - 3);
    this.maxMidi = Math.min(127, Math.max(range.max + 3, this.minMidi + 17));
    // prune selection of notes that no longer exist
    const ids = new Set(clip.notes.map((n) => n.id));
    [...this.selection].forEach((id) => { if (!ids.has(id)) this.selection.delete(id); });
    this.render();
  }

  setCursor(timeSeconds) {
    this.cursorTime = timeSeconds;
    if (timeSeconds != null) {
      // keep the playhead in view
      const x = this._timeToX(timeSeconds);
      if (x > this.cssWidth - 60 || x < GUTTER_W) {
        this.scrollX = Math.max(0, timeSeconds - (this.cssWidth - GUTTER_W - 80) / this.pxPerSecond);
      }
    }
    this.render();
  }

  setZoom(factor) {
    this.pxPerSecond = Math.max(20, Math.min(400, this.pxPerSecond * factor));
    this.render();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.canvas.width = Math.max(1, rect.width * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  // --- coordinate mapping ---
  _laneHeight() {
    const lanes = this.maxMidi - this.minMidi + 1;
    return Math.max(6, (this.cssHeight - RULER_H) / lanes);
  }
  _timeToX(t) { return GUTTER_W + (t - this.scrollX) * this.pxPerSecond; }
  _xToTime(x) { return (x - GUTTER_W) / this.pxPerSecond + this.scrollX; }
  _midiToY(m) { return RULER_H + (this.maxMidi - m) * this._laneHeight(); }
  _yToMidi(y) { return this.maxMidi - Math.floor((y - RULER_H) / this._laneHeight()); }
  _beatDur() { return 60 / (this.getClip().bpm || 120); }
  _snap() { return this._beatDur() / 4; }
  _snapTime(t) { const s = this._snap(); return Math.round(t / s) * s; }

  _notes() { return this.drag ? this.drag.working : this.getClip().notes; }

  // --- rendering ---
  render() {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    const laneH = this._laneHeight();
    ctx.clearRect(0, 0, w, h);

    // lane backgrounds
    for (let m = this.minMidi; m <= this.maxMidi; m += 1) {
      const y = this._midiToY(m);
      ctx.fillStyle = isBlackKey(m) ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(GUTTER_W, y, w - GUTTER_W, laneH);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.moveTo(GUTTER_W, y); ctx.lineTo(w, y); ctx.stroke();
      if (((m % 12) + 12) % 12 === 0) { // label C lanes in the gutter
        ctx.fillStyle = "rgba(167,178,195,0.9)";
        ctx.font = "10px ui-sans-serif, system-ui";
        ctx.fillText(`C${Math.floor(m / 12) - 1}`, 6, y + laneH - 2);
      }
    }

    // beat / bar grid
    const beat = this._beatDur();
    const startBeat = Math.floor(this.scrollX / beat);
    for (let b = startBeat; ; b += 1) {
      const t = b * beat;
      const x = this._timeToX(t);
      if (x > w) break;
      if (x < GUTTER_W) continue;
      const isBar = b % 4 === 0;
      ctx.strokeStyle = isBar ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)";
      ctx.beginPath(); ctx.moveTo(x, RULER_H); ctx.lineTo(x, h); ctx.stroke();
      if (isBar) {
        ctx.fillStyle = "rgba(167,178,195,0.9)";
        ctx.font = "10px ui-sans-serif, system-ui";
        ctx.fillText(String(b / 4 + 1), x + 3, 14);
      }
    }

    // ruler divider
    ctx.fillStyle = "rgba(8,11,18,0.85)";
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(0, RULER_H); ctx.lineTo(w, RULER_H); ctx.stroke();
    // re-draw bar numbers over ruler bg
    for (let b = startBeat; ; b += 1) {
      const x = this._timeToX(b * beat);
      if (x > w) break;
      if (x < GUTTER_W || b % 4 !== 0) continue;
      ctx.fillStyle = "rgba(167,178,195,0.9)";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.fillText(String(b / 4 + 1), x + 3, 14);
    }

    // notes (virtualized to visible time window)
    const tLeft = this.scrollX;
    const tRight = this.scrollX + (w - GUTTER_W) / this.pxPerSecond;
    this._notes().forEach((n) => {
      if (n.start + n.duration < tLeft || n.start > tRight) return;
      if (n.midi < this.minMidi || n.midi > this.maxMidi) return;
      const x = this._timeToX(n.start);
      const noteW = Math.max(3, n.duration * this.pxPerSecond);
      const y = this._midiToY(n.midi);
      const selected = this.selection.has(n.id);
      const light = 42 + (n.velocity ?? 0.78) * 26;
      ctx.fillStyle = selected ? "#62e6b5" : `hsl(199 90% ${light}%)`;
      ctx.fillRect(x, y + 1, noteW, laneH - 2);
      ctx.strokeStyle = selected ? "#ffffff" : "rgba(0,0,0,0.35)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 1.5, noteW - 1, laneH - 3);
    });

    // empty-state hint
    if (this._notes().length === 0) {
      ctx.fillStyle = "rgba(167,178,195,0.85)";
      ctx.font = "600 14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Press ● Record and play, or switch to the Draw tool and click to add notes.", w / 2, h / 2);
      ctx.textAlign = "left";
    }

    // playback cursor
    if (this.cursorTime != null) {
      const x = this._timeToX(this.cursorTime);
      if (x >= GUTTER_W && x <= w) {
        ctx.strokeStyle = "#f5c76b";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
    }
  }

  // --- hit testing ---
  _hitTest(x, y) {
    const laneH = this._laneHeight();
    const notes = this._notes();
    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const n = notes[i];
      const nx = this._timeToX(n.start);
      const nw = Math.max(3, n.duration * this.pxPerSecond);
      const ny = this._midiToY(n.midi);
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + laneH) {
        const onHandle = x >= nx + nw - RESIZE_HANDLE;
        return { note: n, mode: onHandle ? "resize" : "move" };
      }
    }
    return null;
  }

  // --- events ---
  _bindEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    c.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    c.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
    c.addEventListener("keydown", (e) => this._onKeyDown(e));
  }

  _localPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onPointerDown(e) {
    this.canvas.focus();
    const { x, y } = this._localPos(e);
    if (x < GUTTER_W || y < RULER_H) return;
    const hit = this._hitTest(x, y);
    const tool = this.getTool();

    if (!hit && tool === "draw") {
      const midi = this._yToMidi(y);
      const start = Math.max(0, this._snapTime(this._xToTime(x)));
      const notes = addNote(this.getClip().notes, { midi, start, duration: this._beatDur(), instrument: this.getClip().instrument });
      const created = notes[notes.length - 1];
      this.selection = new Set([created.id]);
      this.onEdit(notes);                          // commit first…
      this.onSelectionChange([...this.selection]); // …so the label reads the new clip
      return;
    }

    if (!hit) {
      if (!e.shiftKey) { this.selection.clear(); this.onSelectionChange([]); this.render(); }
      return;
    }

    if (e.shiftKey) {
      if (this.selection.has(hit.note.id)) this.selection.delete(hit.note.id);
      else this.selection.add(hit.note.id);
    } else if (!this.selection.has(hit.note.id)) {
      this.selection = new Set([hit.note.id]);
    }
    this.onSelectionChange([...this.selection]);

    this.drag = {
      mode: hit.mode,
      id: hit.note.id,
      startTime: this._xToTime(x),
      startMidi: this._yToMidi(y),
      origin: this.getClip().notes.map((n) => ({ ...n })),
      working: this.getClip().notes.map((n) => ({ ...n }))
    };
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* capture optional */ }
    this.render();
  }

  _onPointerMove(e) {
    if (!this.drag) {
      // cursor affordance for resize edge
      const { x, y } = this._localPos(e);
      const hit = this._hitTest(x, y);
      this.canvas.style.cursor = hit ? (hit.mode === "resize" ? "ew-resize" : "move") : (this.getTool() === "draw" ? "crosshair" : "default");
      return;
    }
    const { x, y } = this._localPos(e);
    const note = this.drag.origin.find((n) => n.id === this.drag.id);
    if (this.drag.mode === "resize") {
      const newDur = this._snapTime(this._xToTime(x) - note.start);
      this.drag.working = resizeNote(this.drag.origin, this.drag.id, newDur);
    } else {
      const dStart = this._snapTime(this._xToTime(x) - this.drag.startTime);
      const dMidi = this._yToMidi(y) - this.drag.startMidi;
      this.drag.working = moveNote(this.drag.origin, this.drag.id, dStart, dMidi);
    }
    this.render();
  }

  _onPointerUp() {
    if (!this.drag) return;
    const committed = this.drag.working;
    this.drag = null;
    this.onEdit(committed);
  }

  _onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey) {
      this.setZoom(e.deltaY < 0 ? 1.1 : 0.9);
    } else {
      this.scrollX = Math.max(0, this.scrollX + (e.deltaX || e.deltaY) / this.pxPerSecond);
      this.render();
    }
  }

  _onKeyDown(e) {
    if (this.selection.size === 0) return;
    const ids = [...this.selection];
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const notes = deleteNotes(this.getClip().notes, ids);
      this.selection.clear();
      this.onSelectionChange([]);
      this.onEdit(notes);
      return;
    }
    let notes = this.getClip().notes;
    let handled = true;
    const snap = this._snap();
    if (e.key === "ArrowLeft") ids.forEach((id) => { notes = moveNote(notes, id, -snap, 0); });
    else if (e.key === "ArrowRight") ids.forEach((id) => { notes = moveNote(notes, id, snap, 0); });
    else if (e.key === "ArrowUp") ids.forEach((id) => { notes = moveNote(notes, id, 0, 1); });
    else if (e.key === "ArrowDown") ids.forEach((id) => { notes = moveNote(notes, id, 0, -1); });
    else handled = false;
    if (handled) { e.preventDefault(); this.onEdit(notes); }
  }

  describeSelection() {
    const notes = this.getClip().notes.filter((n) => this.selection.has(n.id));
    if (!notes.length) return "No notes selected";
    return notes.map((n) => `${NOTE_NAMES[((n.midi % 12) + 12) % 12]}${Math.floor(n.midi / 12) - 1}`).join(", ");
  }

  destroy() {
    this.observer.disconnect();
  }
}
