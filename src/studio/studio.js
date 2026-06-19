/**
 * Recording Studio orchestrator.
 *
 * Wires the transport, the bus-fed capture, the canvas piano roll, lookahead
 * playback with an animated cursor, IndexedDB sessions, and export. The clip is
 * held in StateManager (single source of truth) so edits get undo/redo and
 * autosave; nothing keeps a parallel copy.
 */

import { PianoRoll } from "./piano-roll.js";
import { SessionStore } from "./session.js";
import { createClip, clipDuration, uid } from "./clip.js";
import { clipToJSON, clipToMIDI, clipToWAV, download } from "./export.js";

const AUTOSAVE_KEY = "studio-autosave";

export function initStudio({ bus, state, storage, audio, ensureAudio, instruments, mount }) {
  const sessions = new SessionStore(storage);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  mount.innerHTML = `
    <div class="studio">
      <div class="studio-transport">
        <button class="st-btn st-rec" id="stRecord" type="button">● Record</button>
        <button class="st-btn" id="stStop" type="button">■ Stop</button>
        <button class="st-btn st-play" id="stPlay" type="button">▶ Play</button>
        <span class="studio-status" id="stStatus" role="status">Ready</span>
        <label class="st-field">Tempo <input id="stTempo" type="number" min="40" max="220" value="120"></label>
        <div class="studio-tools" role="group" aria-label="Editing tools">
          <button class="st-btn" data-tool="select" type="button">Select</button>
          <button class="st-btn" data-tool="draw" type="button">Draw</button>
          <button class="st-btn" id="stDelete" type="button">Delete</button>
          <button class="st-btn" id="stUndo" type="button" title="Undo">↶</button>
          <button class="st-btn" id="stRedo" type="button" title="Redo">↷</button>
          <button class="st-btn" id="stZoomOut" type="button" aria-label="Zoom out">−</button>
          <button class="st-btn" id="stZoomIn" type="button" aria-label="Zoom in">+</button>
        </div>
      </div>
      <canvas id="stCanvas" class="studio-canvas" tabindex="0" role="img"
        aria-label="Piano roll editor. Use Draw tool to add notes; arrow keys nudge selected notes; Delete removes them."></canvas>
      <p class="studio-sel" id="stSelection" aria-live="polite"></p>
      <div class="studio-foot">
        <div class="studio-sessions">
          <h4 class="st-subhead">Sessions</h4>
          <div class="st-session-controls">
            <input id="stName" type="text" placeholder="Session name" autocomplete="off">
            <button class="st-btn" id="stSave" type="button">Save</button>
            <button class="st-btn" id="stNew" type="button">New</button>
          </div>
          <div id="stSessionList" class="st-session-list"></div>
        </div>
        <div class="studio-export">
          <h4 class="st-subhead">Export</h4>
          <button class="st-btn" id="stExportJson" type="button">JSON</button>
          <button class="st-btn" id="stExportMidi" type="button">MIDI</button>
          <button class="st-btn" id="stExportWav" type="button">WAV</button>
        </div>
      </div>
    </div>`;

  const $ = (id) => mount.querySelector(id);
  const els = {
    record: $("#stRecord"), stop: $("#stStop"), play: $("#stPlay"), status: $("#stStatus"),
    tempo: $("#stTempo"), del: $("#stDelete"), undo: $("#stUndo"), redo: $("#stRedo"),
    zoomIn: $("#stZoomIn"), zoomOut: $("#stZoomOut"), canvas: $("#stCanvas"),
    selection: $("#stSelection"), name: $("#stName"), save: $("#stSave"), new: $("#stNew"),
    sessionList: $("#stSessionList"),
    exportJson: $("#stExportJson"), exportMidi: $("#stExportMidi"), exportWav: $("#stExportWav")
  };

  const getClip = () => state.get("studio.clip");
  const setClip = (clip) => state.set("studio.clip", { ...clip, updatedAt: Date.now() });

  // ---- piano roll ----
  const pianoRoll = new PianoRoll({
    canvas: els.canvas,
    getClip,
    getTool: () => state.get("studio.tool"),
    onEdit: (notes) => setClip({ ...getClip(), notes }),
    onSelectionChange: (ids) => {
      els.del.disabled = ids.length === 0;
      els.selection.textContent = pianoRoll.describeSelection();
    },
    reducedMotion
  });

  state.subscribe("studio.clip", (clip) => {
    pianoRoll.setClip(clip);
    if (document.activeElement !== els.name) els.name.value = clip.name || "";
    if (Number(els.tempo.value) !== clip.bpm) els.tempo.value = clip.bpm;
    scheduleAutosave(clip);
  });

  // ---- capture (bus-fed; records durations from note:on/off) ----
  const capture = {
    on: false, t0: 0, open: new Map(), notes: [], instrument: "piano",
    start(instrument) { this.on = true; this.t0 = performance.now() / 1000; this.open.clear(); this.notes = []; this.instrument = instrument; },
    noteOn(note, velocity) {
      if (!this.on) return;
      this.open.set(note, { midi: audio.noteToMidi(note), start: performance.now() / 1000 - this.t0, velocity: velocity ?? 0.78 });
    },
    noteOff(note) {
      if (!this.on) return;
      const o = this.open.get(note);
      if (!o) return;
      this.open.delete(note);
      this.notes.push({ id: uid(), midi: o.midi, start: o.start, duration: Math.max(0.05, performance.now() / 1000 - this.t0 - o.start), velocity: o.velocity, instrument: this.instrument });
    },
    stop() {
      this.on = false;
      const end = performance.now() / 1000 - this.t0;
      this.open.forEach((o) => this.notes.push({ id: uid(), midi: o.midi, start: o.start, duration: Math.max(0.05, end - o.start), velocity: o.velocity, instrument: this.instrument }));
      this.open.clear();
      return this.notes;
    }
  };
  bus.on("note:on", ({ note, velocity }) => capture.noteOn(note, velocity));
  bus.on("note:off", ({ note }) => capture.noteOff(note));

  // ---- playback (lookahead scheduler + animated cursor) ----
  let playTimer = null;
  let rafId = null;
  let playStart = 0;
  let schedIdx = 0;
  let sorted = [];

  function play() {
    if (state.get("studio.playing")) return;
    ensureAudio().then((ready) => {
      if (!ready) return;
      const clip = getClip();
      if (!clip.notes.length) { setStatus("Nothing to play — record or draw some notes."); return; }
      sorted = [...clip.notes].sort((a, b) => a.start - b.start);
      schedIdx = 0;
      playStart = audio.context.currentTime + 0.1;
      state.set("studio.playing", true);
      updateTransport();
      playTimer = window.setInterval(scheduleTick, 25);
      animateCursor();
    });
  }

  function scheduleTick() {
    const ctx = audio.context;
    const playhead = ctx.currentTime - playStart;
    const clip = getClip();
    while (schedIdx < sorted.length && sorted[schedIdx].start < playhead + 0.1) {
      const n = sorted[schedIdx];
      schedIdx += 1;
      const inst = instruments.find((i) => i.id === (n.instrument || clip.instrument)) || instruments[0];
      audio.playNote(audio.midiToNote(n.midi), inst.timbre, { when: playStart + n.start, duration: n.duration, velocity: n.velocity ?? 0.78 });
    }
    if (playhead > clipDuration(clip) + 0.3) stopPlayback();
  }

  function animateCursor() {
    rafId = requestAnimationFrame(() => {
      if (!state.get("studio.playing")) return;
      pianoRoll.setCursor(Math.max(0, audio.context.currentTime - playStart));
      animateCursor();
    });
  }

  function stopPlayback() {
    if (playTimer) window.clearInterval(playTimer);
    if (rafId) cancelAnimationFrame(rafId);
    playTimer = null; rafId = null;
    state.set("studio.playing", false);
    pianoRoll.setCursor(null);
    updateTransport();
  }

  // ---- transport ----
  function setStatus(text) { els.status.textContent = text; }
  function updateTransport() {
    const recording = state.get("studio.recording");
    const playing = state.get("studio.playing");
    els.record.classList.toggle("active", recording);
    els.play.classList.toggle("active", playing);
    els.record.disabled = playing;
    els.play.disabled = recording;
    setStatus(recording ? "● Recording — play notes…" : playing ? "▶ Playing…" : "Ready");
  }

  function startRecording() {
    ensureAudio().then(() => {
      capture.start(state.get("instrument"));
      state.set("studio.recording", true);
      updateTransport();
      bus.emit("toast", { message: "Recording started", kind: "info" });
    });
  }
  function finishRecording() {
    const notes = capture.stop();
    state.set("studio.recording", false);
    if (notes.length) setClip({ ...getClip(), notes, bpm: Number(els.tempo.value) || getClip().bpm });
    updateTransport();
  }

  els.record.addEventListener("click", startRecording);
  els.play.addEventListener("click", play);
  els.stop.addEventListener("click", () => {
    if (state.get("studio.recording")) finishRecording();
    if (state.get("studio.playing")) stopPlayback();
  });
  els.tempo.addEventListener("change", () => setClip({ ...getClip(), bpm: Math.max(40, Math.min(220, Number(els.tempo.value) || 120)) }));
  els.del.addEventListener("click", () => els.canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" })));
  els.undo.addEventListener("click", () => state.undo());
  els.redo.addEventListener("click", () => state.redo());
  els.zoomIn.addEventListener("click", () => pianoRoll.setZoom(1.2));
  els.zoomOut.addEventListener("click", () => pianoRoll.setZoom(0.8));

  mount.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.set("studio.tool", btn.dataset.tool);
      mount.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  // ---- sessions ----
  let autosaveTimer = null;
  function scheduleAutosave(clip) {
    clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => storage.put("settings", AUTOSAVE_KEY, clip), 400);
  }

  async function refreshSessions() {
    const list = await sessions.list();
    els.sessionList.innerHTML = list.length
      ? list.map((s) => `
        <div class="st-session" data-id="${s.id}">
          <span class="st-session-name">${escapeHtml(s.name || "Untitled")}</span>
          <span class="st-session-meta">${(s.notes || []).length} notes</span>
          <button class="st-link" data-load="${s.id}" type="button">Load</button>
          <button class="st-link" data-rename="${s.id}" type="button">Rename</button>
          <button class="st-link st-danger" data-del="${s.id}" type="button">Delete</button>
        </div>`).join("")
      : `<p class="studio-hint">No saved sessions yet.</p>`;
  }

  els.save.addEventListener("click", async () => {
    const clip = { ...getClip(), name: els.name.value.trim() || "Untitled session" };
    setClip(clip);
    await sessions.save(clip);
    await refreshSessions();
    setStatus(`Saved "${clip.name}".`);
    bus.emit("toast", { message: `Saved "${clip.name}"`, kind: "success" });
  });
  els.new.addEventListener("click", () => {
    setClip(createClip({ bpm: Number(els.tempo.value) || 120, instrument: state.get("instrument") }));
    setStatus("New session.");
  });

  els.sessionList.addEventListener("click", async (e) => {
    const load = e.target.closest("[data-load]");
    const rename = e.target.closest("[data-rename]");
    const del = e.target.closest("[data-del]");
    if (load) {
      const clip = await sessions.load(load.dataset.load);
      if (clip) { setClip(clip); setStatus(`Loaded "${clip.name}".`); }
    } else if (rename) {
      const name = window.prompt("Rename session:");
      if (name) { await sessions.rename(rename.dataset.rename, name.trim()); await refreshSessions(); }
    } else if (del) {
      if (window.confirm("Delete this session?")) { await sessions.remove(del.dataset.del); await refreshSessions(); }
    }
  });

  // ---- export ----
  els.exportJson.addEventListener("click", () => { download(`${safeName()}.json`, clipToJSON(getClip()), "application/json"); bus.emit("toast", { message: "Exported JSON", kind: "success" }); });
  els.exportMidi.addEventListener("click", () => { download(`${safeName()}.mid`, clipToMIDI(getClip()), "audio/midi"); bus.emit("toast", { message: "Exported MIDI", kind: "success" }); });
  els.exportWav.addEventListener("click", async () => {
    setStatus("Rendering WAV…");
    bus.emit("toast", { message: "Rendering WAV…", kind: "info" });
    try {
      const bytes = await clipToWAV(getClip(), { instruments });
      download(`${safeName()}.wav`, bytes, "audio/wav");
      setStatus("WAV exported.");
      bus.emit("toast", { message: "WAV export complete", kind: "success" });
    } catch (err) {
      console.error("[studio] WAV export failed", err);
      setStatus("WAV export failed.");
      bus.emit("toast", { message: "WAV export failed", kind: "warn" });
    }
  });
  function safeName() { return (getClip().name || "session").replace(/[^\w-]+/g, "_"); }

  // ---- boot ----
  async function boot() {
    const auto = await storage.get("settings", AUTOSAVE_KEY);
    if (auto && Array.isArray(auto.notes)) setClip(auto);
    else pianoRoll.setClip(getClip());
    els.tempo.value = getClip().bpm;
    els.name.value = getClip().name || "";
    mount.querySelector('[data-tool="select"]').classList.add("active");
    els.del.disabled = true;
    updateTransport();
    await refreshSessions();
  }
  boot();

  return { pianoRoll };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
