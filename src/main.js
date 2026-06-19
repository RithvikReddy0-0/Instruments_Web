import "../style.css";

// Self-hosted cinematic type — Fraunces (editorial serif, optical-size axis) for
// the mythical display voice; JetBrains Mono for machine-readout labels. Bundled
// by Vite, so the intended letterforms render (and stay offline) instead of
// silently degrading to a system serif.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/jetbrains-mono/index.css";

import { AudioEngine } from "./audio/engine.js";
import { Metronome } from "./audio/metronome.js";
import { SessionRecorder } from "./audio/recorder.js";
import { chordIntervals, instruments, scaleIntervals } from "./data/instruments.js";
import { animatePlayed, highlightScale, renderInstrument } from "./instruments/renderers.js";
import { initTheme } from "./ui/theme.js";
import { Visualizer } from "./ui/visualizer.js";
import { EventBus } from "./core/event-bus.js";
import { StateManager } from "./core/state.js";
import { Storage } from "./core/storage.js";
import { KeyboardManager } from "./core/input.js";
import { MidiManager } from "./core/midi.js";
import { TheoryEngine } from "./theory/theory-engine.js";
import { initTheoryWorkspace } from "./ui/theory-workspace.js";
import { initStudio } from "./studio/studio.js";
import { createClip } from "./studio/clip.js";
import { initPractice } from "./practice/practice.js";
import { initCoach } from "./coach/coach.js";
import { initToasts } from "./ui/toast.js";
import { initCommandPalette } from "./ui/command-palette.js";
import { initShortcutsOverlay } from "./ui/shortcuts-overlay.js";
import { initOnboarding } from "./ui/onboarding.js";
import { initPWA } from "./pwa/pwa.js";
import { initMotion } from "./ui/motion.js";
import { initAmbient } from "./ui/ambient.js";
import { createKnob, createToggle, createKeycap } from "./ui/hardware.js";
import { createUiSound } from "./audio/ui-sound.js";
import { initPowerOn } from "./ui/poweron.js";

const $ = (selector) => document.querySelector(selector);

// ---------------------------------------------------------------------------
// Composition root: build the spine and the subsystems that hang off it.
// ---------------------------------------------------------------------------
const bus = new EventBus();
const storage = new Storage();
const state = new StateManager(bus, {
  instrument: instruments[0].id,
  mode: "note",
  chord: "major",
  scale: "major",
  settings: { volume: 0.72, octaveShift: 0, sustain: false, tempo: 120 },
  practice: {
    active: false, target: null, score: 0, stats: { attempts: 0, hits: 0 },
    lab: { view: "dashboard", trainer: "note", level: 1 }
  },
  coach: { report: null },
  midi: { supported: false, enabled: false, error: null, devices: [], last: null },
  theory: {
    tab: "chords",
    chordRoot: "C", chordType: "major",
    scaleRoot: "C", scaleType: "major",
    circleKey: "C",
    progression: "C G Am F"
  },
  studio: { clip: createClip(), recording: false, playing: false, tool: "select" }
});

const theory = new TheoryEngine();

const audio = new AudioEngine();
const recorder = new SessionRecorder(bus);
const metronome = new Metronome(audio);
const uiSound = createUiSound(audio);
const powerOn = initPowerOn({ onTick: () => uiSound.detent() });

const els = {
  cards: $("#instrumentCards"),
  surface: $("#instrumentSurface"),
  activeName: $("#activeInstrumentName"),
  infoName: $("#infoName"),
  infoDescription: $("#infoDescription"),
  infoFamily: $("#infoFamily"),
  infoRange: $("#infoRange"),
  infoNotes: $("#infoNotes"),
  infoHistory: $("#infoHistory"),
  infoUses: $("#infoUses"),
  shortcutList: $("#shortcutList"),
  readout: $("#noteReadout"),
  status: $("#statusBanner"),
  // volume / sustain / tempo / octave / metro are hardware.js control objects,
  // built and assigned in mountHardwareDock().
  volume: null,
  sustain: null,
  tempo: null,
  octave: null,
  metro: null,
  chord: $("#chordSelect"),
  scale: $("#scaleSelect"),
  practiceBtn: $("#practiceBtn"),
  practicePrompt: $("#practicePrompt"),
  practiceScore: $("#practiceScore"),
  modal: $("#shortcutModal"),
  midiStatus: $("#midiStatus"),
  midiDevice: $("#midiDevice"),
  midiChannel: $("#midiChannel"),
  midiMessage: $("#midiMessage"),
  midiVelocity: $("#midiVelocity")
};

const visualizer = new Visualizer($("#visualizerCanvas"), audio);
const input = new KeyboardManager(bus, els.surface);
// MIDI reuses the engine's note-number → name math via injection, so it stays
// decoupled from AudioEngine while emitting through KeyboardManager only.
const midi = new MidiManager(bus, input, state, (number) => audio.midiToNote(number));

// Currently-sounding sustained voices and which notes are physically held.
// Together these implement real sustain-pedal behavior (see performNoteOff).
const heldVoices = new Map(); // note -> { stop }
const physicallyHeld = new Set();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function init() {
  initTheme($("#themeToggle"));
  await restorePersisted();
  renderCards();
  bindControls();
  bindPerformance();
  applySettingsToUI();
  selectInstrument(state.get("instrument"));
  visualizer.start();

  // The panel re-renders whenever any midi.* slice changes (device list,
  // last message, support flag). StateManager stays the source of truth.
  bus.on("state:change", ({ path }) => {
    if (path.startsWith("midi")) renderMidiPanel();
  });
  renderMidiPanel();
  midi.init();

  initTheoryWorkspace({ bus, state, theory, preview: previewNotes, mount: $("#theoryWorkspace") });
  initStudio({ bus, state, storage, audio, ensureAudio, instruments, mount: $("#studioWorkspace") });
  initPractice({ bus, state, storage, theory, audio, ensureAudio, metronome, instruments, preview: previewNotes, mount: $("#practiceWorkspace") });
  initCoach({ bus, state, storage, mount: $("#coachWorkspace") });

  initProductization();
}

// ---------------------------------------------------------------------------
// Productization layer: toasts, command palette, shortcuts, onboarding, PWA.
// ---------------------------------------------------------------------------
function initProductization() {
  initToasts({ bus });

  const goto = (id) => { const el = $(id); el?.scrollIntoView({ behavior: "smooth" }); el?.setAttribute("tabindex", "-1"); el?.focus?.({ preventScroll: true }); };
  const clickIf = (id) => $(id)?.click();
  const commands = [
    { id: "go-playground", title: "Open Playground", section: "Navigate", keywords: ["play", "instrument"], run: () => goto("#playground") },
    { id: "go-theory", title: "Open Theory Workspace", section: "Navigate", keywords: ["chord", "scale", "circle"], run: () => goto("#theory") },
    { id: "go-studio", title: "Open Recording Studio", section: "Navigate", keywords: ["record", "piano roll", "daw"], run: () => goto("#studio") },
    { id: "go-practice", title: "Open Practice", section: "Navigate", keywords: ["train", "exercise"], run: () => goto("#practice") },
    { id: "go-coach", title: "Open Coach", section: "Navigate", keywords: ["insights", "progress"], run: () => goto("#coach") },
    { id: "rec-start", title: "Start Recording", section: "Studio", hint: "Ctrl+R", keywords: ["capture"], run: () => { goto("#studio"); clickIf("#stRecord"); } },
    { id: "rec-stop", title: "Stop Recording", section: "Studio", keywords: ["end"], run: () => clickIf("#stStop") },
    { id: "exp-wav", title: "Export WAV", section: "Studio", keywords: ["audio", "render"], run: () => { goto("#studio"); clickIf("#stExportWav"); } },
    { id: "exp-midi", title: "Export MIDI", section: "Studio", keywords: ["smf"], run: () => { goto("#studio"); clickIf("#stExportMidi"); } },
    { id: "exp-json", title: "Export JSON", section: "Studio", run: () => { goto("#studio"); clickIf("#stExportJson"); } },
    { id: "metro", title: "Toggle Metronome", section: "Transport", hint: "Space", keywords: ["click", "beat", "tempo"], run: () => clickIf("#metroBtn") },
    { id: "practice-note", title: "Start Note Trainer", section: "Practice", run: () => bus.emit("coach:start-practice", { trainer: "note", level: 1 }) },
    { id: "shortcuts", title: "Show Keyboard Shortcuts", section: "Help", hint: "?", run: () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })) }
  ];
  initCommandPalette({ commands });
  $("#cmdkButton")?.addEventListener("click", () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })));

  initShortcutsOverlay();
  initPWA({ bus, installButton: $("#installButton") });
  initOnboarding({ storage });
  setupNavHighlight();
  initAmbient(audio);
  initMotion();
}

// Highlight the nav link for the section currently in view (sets aria-current).
function setupNavHighlight() {
  const links = [...document.querySelectorAll(".nav-links a")];
  const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  // Map sections to world "zones" (not themes — different worlds).
  const ZONE = { theory: "theory", practice: "practice", coach: "coach", studio: "studio" };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((l) => l.removeAttribute("aria-current"));
      map.get(entry.target.id)?.setAttribute("aria-current", "true");
      window.IHWorld?.setZone?.(ZONE[entry.target.id] || "core");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["features", "instruments", "playground", "theory", "studio", "practice", "coach", "faq"]
    .forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
}

async function restorePersisted() {
  const saved = await storage.get("settings", "current");
  if (saved) state.hydrate(saved);

  // Restore the last recording so Replay works after a reload. Migrate the
  // pre-3.0 localStorage session into IndexedDB on first run.
  let lastTake = await storage.get("recordings", "last");
  if (!lastTake) {
    try {
      const legacy = JSON.parse(localStorage.getItem("instrumenthub-session") || "null");
      if (legacy?.events?.length) {
        lastTake = legacy;
        await storage.put("recordings", "last", legacy);
      }
    } catch { /* ignore malformed legacy data */ }
  }
  if (lastTake?.events) recorder.events = lastTake.events;
}

function applySettingsToUI() {
  const s = state.get("settings");
  els.volume.set(s.volume);
  els.tempo.set(s.tempo);
  // Octave must be a whole number of octaves; heal any stale fractional value
  // (a fractional shift makes note transposition return "undefined").
  const octave = Math.round(s.octaveShift) || 0;
  if (octave !== s.octaveShift) state.set("settings.octaveShift", octave);
  els.octave.set(octave);
  els.sustain.set(s.sustain);
  els.chord.value = state.get("chord");
  els.scale.value = state.get("scale");
  audio.setVolume(s.volume);
  metronome.setTempo(s.tempo);

  const mode = state.get("mode");
  document.querySelectorAll(".segment").forEach((segment) => {
    segment.classList.toggle("active", segment.dataset.mode === mode);
  });
}

// Debounced persistence of the whitelisted slices.
const PERSIST_PATHS = ["instrument", "mode", "chord", "scale", "settings", "theory"];
let saveTimer = null;
bus.on("state:change", ({ path }) => {
  if (!PERSIST_PATHS.some((p) => path === p || path.startsWith(`${p}.`))) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    storage.put("settings", "current", {
      instrument: state.get("instrument"),
      mode: state.get("mode"),
      chord: state.get("chord"),
      scale: state.get("scale"),
      settings: state.get("settings"),
      theory: state.get("theory")
    });
  }, 300);
});

bus.on("recording:saved", ({ events }) => {
  storage.put("recordings", "last", { version: 2, savedAt: new Date().toISOString(), events });
});

// ---------------------------------------------------------------------------
// Instrument selection & rendering
// ---------------------------------------------------------------------------
function renderCards() {
  els.cards.innerHTML = instruments.map((instrument) => `
    <button class="instrument-card" type="button" data-instrument="${instrument.id}" aria-label="Open ${instrument.name}">
      <span class="card-art" aria-hidden="true">${instrument.icon}</span>
      <span class="card-family">${instrument.family}</span>
      <strong>${instrument.name}</strong>
      <span>${instrument.notes} playable notes</span>
      <p>${instrument.description}</p>
    </button>
  `).join("");

  els.cards.querySelectorAll("[data-instrument]").forEach((card) => {
    card.addEventListener("click", () => {
      selectInstrument(card.dataset.instrument);
      location.hash = "playground";
    });
  });
}

function activeInstrument() {
  return instruments.find((instrument) => instrument.id === state.get("instrument")) || instruments[0];
}

// Map app instruments to the world's floating-instrument set (piano/synth/guitar/violin).
const WORLD_INSTRUMENT = {
  piano: "piano", guitar: "guitar", bass: "guitar", ukulele: "guitar",
  violin: "violin", flute: "synth", trumpet: "synth", saxophone: "synth",
  drums: "synth", xylophone: "synth"
};

function selectInstrument(id) {
  const next = instruments.find((instrument) => instrument.id === id) || instruments[0];
  state.set("instrument", next.id);
  window.IHWorld?.setInstrument?.(WORLD_INSTRUMENT[next.id] || "piano");
  audio.stopAll();
  heldVoices.clear();
  physicallyHeld.clear();

  els.activeName.textContent = next.name;
  els.infoName.textContent = next.name;
  els.infoDescription.textContent = next.description;
  els.infoFamily.textContent = next.family;
  els.infoRange.textContent = next.range;
  els.infoNotes.textContent = String(next.notes);
  els.infoHistory.textContent = next.history;
  els.infoUses.textContent = next.uses;

  document.querySelectorAll(".instrument-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.instrument === next.id);
  });

  const keyMap = renderInstrument(els.surface, next, audio, {
    octaveShift: state.get("settings.octaveShift")
  });
  input.setKeyMap(keyMap);
  state.keyMap = keyMap;
  renderShortcuts(keyMap);
  updateScaleHighlight();
  bus.emit("instrument:change", { id: next.id });
}

function renderShortcuts(keyMap) {
  const items = Object.entries(keyMap).slice(0, 18);
  els.shortcutList.innerHTML = items.map(([key, value]) => `
    <span><kbd>${key.toUpperCase()}</kbd>${value.note}</span>
  `).join("");
}

function renderMidiPanel() {
  const midiState = state.get("midi");
  const { supported, error, devices = [], last } = midiState;

  if (!supported) {
    els.midiStatus.textContent = "Web MIDI isn't supported in this browser. Use a Chromium-based browser to connect a controller.";
  } else if (error === "denied") {
    els.midiStatus.textContent = "MIDI access was blocked. Allow MIDI permission for this site, then reload to connect a controller.";
  } else if (!devices.length) {
    els.midiStatus.textContent = "No MIDI devices connected. Plug in a controller to play with velocity and sustain.";
  } else {
    els.midiStatus.textContent = `${devices.length} device${devices.length > 1 ? "s" : ""} connected.`;
  }

  els.midiDevice.textContent = devices.length ? devices.map((d) => d.name).join(", ") : "—";
  els.midiChannel.textContent = last ? String(last.channel) : "—";
  els.midiMessage.textContent = last ? last.message : "—";
  els.midiVelocity.textContent = last ? String(last.velocity) : "—";
}

// ---------------------------------------------------------------------------
// Audio readiness
// ---------------------------------------------------------------------------
async function ensureAudio() {
  const ready = await audio.init();
  if (ready) {
    els.status.textContent = "Audio ready. Play, practice, or record.";
    els.status.classList.add("ready");
    bus.emit("audio:ready", {});
    // Feed the living world the real analyser (energy source). Stashed globally
    // too, so the world can adopt it regardless of load order.
    window.__ihAudioAnalyser = audio.analyser;
    window.IHWorld?.setAnalyser?.(audio.analyser);
    powerOn.play(); // IH-1 boot — fires once, on first successful audio enable.
  } else {
    els.status.textContent = "Audio is unavailable in this browser, but note inspection and practice still work.";
    els.status.classList.remove("ready");
  }
  return ready;
}

// ---------------------------------------------------------------------------
// Performance: turn note:on / note:off events into sound + recording.
// Input source (pointer / keyboard / future MIDI) is irrelevant here.
// ---------------------------------------------------------------------------
function bindPerformance() {
  bus.on("note:on", ({ note, velocity }) => {
    performNoteOn(note, velocity);
    window.IHWorld?.pulse?.(0.6); // interaction energizes the world
  });
  bus.on("note:off", ({ note }) => { performNoteOff(note); });
}

async function performNoteOn(note, velocity = 0.78, opts = {}) {
  const {
    replaying = false,
    eventType = state.get("mode"),
    chordType = state.get("chord")
  } = opts;

  const instrument = activeInstrument();
  const isDrum = instrument.type === "drums";
  const audioReady = await ensureAudio();
  const timbre = instrument.timbre;
  const rootElement = els.surface.querySelector(`[data-note="${CSS.escape(note)}"]`);
  showNote(note);

  if (eventType === "chord" && !isDrum) {
    const intervals = chordIntervals[chordType] || chordIntervals.major;
    intervals.forEach((interval) => {
      const chordNote = audio.transpose(note, interval);
      if (audioReady) audio.playNote(chordNote, timbre, { duration: 1.05, velocity: 0.76 });
      const chordElement = els.surface.querySelector(`[data-note="${CSS.escape(chordNote)}"]`);
      animatePlayed(chordElement || rootElement);
    });
    if (!replaying) recorder.add({ type: "chord", instrument: instrument.id, note, chord: chordType });
    checkPractice(note);
    return;
  }

  const sustainPedal = state.get("settings.sustain");
  // Bowed/wind instruments ring while held; the sustain pedal makes anything
  // ring. Replay always uses one-shots (it has no note-off events to release).
  const useHold = audioReady && !replaying && !isDrum && (instrument.sustained || sustainPedal);

  if (useHold) {
    heldVoices.get(note)?.stop?.();
    const handle = audio.playNote(note, timbre, { velocity, sustain: true });
    if (handle?.stop) {
      heldVoices.set(note, handle);
      physicallyHeld.add(note);
    }
  } else if (audioReady) {
    const baseDuration = isDrum ? 0.22 : 0.76;
    audio.playNote(note, timbre, {
      duration: instrument.sustained ? baseDuration * 1.8 : baseDuration,
      velocity: isDrum ? 0.92 : velocity
    });
  }

  animatePlayed(rootElement);
  if (!replaying) recorder.add({ type: "note", instrument: instrument.id, note });
  checkPractice(note);
}

function performNoteOff(note) {
  physicallyHeld.delete(note);
  const voice = heldVoices.get(note);
  if (!voice) return;
  // With the pedal down a released key keeps ringing (latched); the voice is
  // freed later when the pedal lifts. Otherwise it stops immediately.
  if (!state.get("settings.sustain")) {
    voice.stop?.();
    heldVoices.delete(note);
  }
}

function releaseSustained() {
  // Pedal lifted: free every voice that isn't still physically held.
  [...heldVoices.entries()].forEach(([note, voice]) => {
    if (!physicallyHeld.has(note)) {
      voice.stop?.();
      heldVoices.delete(note);
    }
  });
}

// Single sustain code path shared by the on-screen toggle and the MIDI pedal.
function setSustain(on) {
  state.set("settings.sustain", on);
  els.sustain.set(on); // reflect on the toggle (set() syncs visuals, no re-fire)
  if (!on) releaseSustained();
}

function showNote(note) {
  const info = audio.getNoteInfo(note);
  els.readout.textContent = `${info.note} | ${info.frequency.toFixed(2)} Hz | Octave ${info.octave}`;
}

/**
 * Play a set of already-octaved notes on the current instrument, for theory
 * previews. Goes straight to the AudioEngine (not the note:on performer) so it
 * is never reshaped by chord mode and never recorded. `stagger` (ms) turns a
 * chord into an arpeggio/scale run. The shared master bus keeps the visualizer
 * reacting.
 */
async function previewNotes(notes, { duration = 0.85, stagger = 0 } = {}) {
  const ready = await ensureAudio();
  if (!ready) return;
  const timbre = activeInstrument().timbre;
  notes.forEach((note, i) => {
    const when = audio.context.currentTime + (i * stagger) / 1000;
    audio.playNote(note, timbre, { duration, velocity: 0.78, when });
  });
}

// ---------------------------------------------------------------------------
// Modes, scales, practice
// ---------------------------------------------------------------------------
function updateScaleHighlight() {
  if (state.get("mode") !== "scale") {
    highlightScale(els.surface, []);
    return;
  }
  const root = els.surface.querySelector("[data-note]")?.dataset.note || "C4";
  const scale = scaleIntervals[state.get("scale")] || scaleIntervals.major;
  const notes = scale.map((interval) => audio.transpose(root, interval));
  highlightScale(els.surface, notes);
}

function nextPracticeTarget() {
  const notes = [...els.surface.querySelectorAll("[data-note]")].map((node) => node.dataset.note);
  const target = notes[Math.floor(Math.random() * notes.length)] || "C4";
  state.set("practice.target", target);
  els.practicePrompt.textContent = `Find and play ${target}.`;
}

function checkPractice(note) {
  if (!state.get("practice.active")) return;
  const stats = state.get("practice.stats");
  stats.attempts += 1;
  if (note === state.get("practice.target")) {
    stats.hits += 1;
    state.set("practice.stats", stats);
    const score = state.get("practice.score") + 10;
    state.set("practice.score", score);
    els.practiceScore.textContent = String(score);
    nextPracticeTarget();
  } else {
    state.set("practice.stats", stats);
    els.practicePrompt.textContent = `That was ${note}. Target: ${state.get("practice.target")}.`;
  }
}

// ---------------------------------------------------------------------------
// Controls & transport
// ---------------------------------------------------------------------------
// Reflect metronome on/off across the keycap (label, LED, active state, ARIA).
function setMetroUI(on) {
  els.metro.setActive(on);
  els.metro.setLed(on);
  els.metro.el.setAttribute("aria-pressed", String(on));
}

// Build the hardware control dock — real hardware.js knobs/toggle/keycap wired
// to the same state + audio paths the old <input> elements drove. Each control
// object is stashed on `els.*` so applySettingsToUI() can .set() them on restore.
function mountHardwareDock() {
  const dock = $("#hwDock");

  els.volume = createKnob({
    min: 0, max: 1, value: 0.72, step: 0.01, label: "Volume", unit: "%",
    format: (v) => Math.round(v * 100),
    onChange: (v) => { state.set("settings.volume", v); audio.setVolume(v); uiSound.detent(); }
  });
  els.tempo = createKnob({
    min: 40, max: 220, value: 120, step: 1, label: "Tempo", unit: "BPM",
    onChange: (v) => { state.set("settings.tempo", v); metronome.setTempo(v); uiSound.detent(); }
  });
  els.octave = createKnob({
    min: -2, max: 2, value: 0, step: 1, label: "Octave",
    format: (v) => (v > 0 ? `+${v}` : String(v)),
    onChange: (v) => { state.set("settings.octaveShift", v); selectInstrument(state.get("instrument")); uiSound.detent(); }
  });
  els.sustain = createToggle({
    on: false, label: "Sustain",
    onChange: (on) => { setSustain(on); (on ? uiSound.toggleOn() : uiSound.toggleOff()); }
  });
  els.metro = createKeycap({
    label: "Metro", sub: "Space", led: true,
    onClick: async () => {
      uiSound.press();
      await ensureAudio();
      setMetroUI(metronome.toggle());
    }
  });
  els.metro.el.id = "metroBtn";
  els.metro.el.setAttribute("aria-pressed", "false");

  dock.append(els.volume.el, els.tempo.el, els.octave.el, els.sustain.el, els.metro.el);
}

function bindControls() {
  mountHardwareDock();
  // MIDI sustain pedal (CC64) flows through the exact same handler (setSustain
  // already reflects state onto the toggle).
  bus.on("control:sustain", ({ down }) => setSustain(down));
  $("#recordBtn").addEventListener("click", () => {
    recorder.start();
    els.status.textContent = "Recording. Your timing is being captured.";
    els.status.classList.add("recording");
    bus.emit("transport:record", {});
  });
  $("#stopBtn").addEventListener("click", () => {
    recorder.stop();
    metronome.stop();
    setMetroUI(false);
    els.status.textContent = `Saved ${recorder.events.length} events locally.`;
    els.status.classList.remove("recording");
    bus.emit("transport:stop", {});
  });
  $("#replayBtn").addEventListener("click", () => {
    const previous = state.get("instrument");
    recorder.replay((event) => {
      if (event.instrument && event.instrument !== previous) selectInstrument(event.instrument);
      performNoteOn(event.note, 0.78, {
        replaying: true,
        eventType: event.type,
        chordType: event.chord
      });
    });
    bus.emit("transport:replay", {});
  });
  $("#downloadBtn").addEventListener("click", () => recorder.download());
  $("#fullscreenBtn").addEventListener("click", () => {
    const target = $("#playground");
    if (!document.fullscreenElement) target.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  $("#helpBtn").addEventListener("click", () => { els.modal.hidden = false; });
  $("#closeHelpBtn").addEventListener("click", () => { els.modal.hidden = true; });
  els.practiceBtn.addEventListener("click", () => {
    const active = !state.get("practice.active");
    state.set("practice.active", active);
    els.practiceBtn.textContent = active ? "Stop practice" : "Start practice";
    if (active) nextPracticeTarget();
    else els.practicePrompt.textContent = "Press Start to get a target note.";
  });
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.set("mode", button.dataset.mode);
      document.querySelectorAll(".segment").forEach((segment) => segment.classList.toggle("active", segment === button));
      updateScaleHighlight();
    });
  });
  els.chord.addEventListener("change", () => state.set("chord", els.chord.value));
  els.scale.addEventListener("change", () => {
    state.set("scale", els.scale.value);
    updateScaleHighlight();
  });
  els.surface.addEventListener("notepreview", (event) => {
    const { note, frequency, octave } = event.detail;
    els.readout.textContent = `${note} | ${frequency.toFixed(2)} Hz | Octave ${octave}`;
  });

  // Transport keyboard shortcuts. Note keys are handled by KeyboardManager.
  document.addEventListener("keydown", (event) => {
    // Don't hijack typing or hardware-control focus (knob/fader/toggle/keycap
    // own their own arrow/space handling).
    if (event.target.matches?.("input, select, textarea, .opus-knob, .opus-fader, .opus-toggle, .opus-key")) return;
    const key = event.key.toLowerCase();
    if (key === " ") {
      event.preventDefault();
      els.metro.el.click();
    } else if (event.ctrlKey && key === "r") {
      event.preventDefault();
      $("#recordBtn").click();
    } else if (event.ctrlKey && key === "s") {
      event.preventDefault();
      $("#stopBtn").click();
    } else if (event.ctrlKey && key === "p") {
      event.preventDefault();
      $("#replayBtn").click();
    }
  });
}

init();
