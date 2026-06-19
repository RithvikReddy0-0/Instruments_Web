/**
 * Theory Workspace — the UI surface for the Theory Engine.
 *
 * This module contains NO music-theory logic. It is a pure consumer of
 * TheoryEngine: every chord, scale, interval, key signature, detection result,
 * and Roman numeral comes from the engine's public API. It subscribes to the
 * shared note:on / note:off stream (pointer + keyboard + MIDI) for live
 * analysis, and plays previews through an injected `preview` callback.
 */

import { CHORD_TYPES, SCALE_TYPES } from "../theory/theory-engine.js";
import { pitchClass } from "../theory/notes.js";

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const TABS = [
  { id: "chords", label: "Chord Explorer" },
  { id: "scales", label: "Scale Explorer" },
  { id: "detect", label: "Live Analysis" },
  { id: "circle", label: "Circle of Fifths" },
  { id: "progression", label: "Progression Lab" }
];

const PRESET_PROGRESSIONS = [
  { label: "I–V–vi–IV", value: "C G Am F" },
  { label: "ii–V–I", value: "Dm7 G7 Cmaj7" },
  { label: "50s", value: "C Am F G" },
  { label: "Minor pop", value: "Am F C G" },
  { label: "Pachelbel", value: "C G Am Em F C F G" }
];

// --- small presentation helpers (formatting only) ---
const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const stripOctave = (name) => String(name).replace(/-?\d+$/, "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function initTheoryWorkspace({ bus, state, theory, preview, mount }) {
  // Live-analysis buffers (transient; never persisted).
  const held = new Map();   // note name (with octave) -> true
  let recent = [];          // [{ name, t }]

  mount.innerHTML = `
    <div class="tw">
      <div class="tw-tabs" role="tablist" aria-label="Theory tools"></div>
      <div class="tw-panel" id="twPanel" role="tabpanel" tabindex="0"></div>
    </div>`;
  const tabsEl = mount.querySelector(".tw-tabs");
  const panelEl = mount.querySelector("#twPanel");

  // ---- voicing & preview (output) ----
  function voice(names, startOctave = 4) {
    let octave = startOctave;
    let prev = -1;
    return names.map((n) => {
      const pc = pitchClass(n);
      if (pc < prev) octave += 1; // keep the line ascending
      prev = pc;
      return `${stripOctave(n)}${octave}`;
    });
  }

  // ---- tab chrome ----
  function renderTabs() {
    const active = state.get("theory.tab");
    tabsEl.innerHTML = TABS.map((t) => `
      <button class="tw-tab ${t.id === active ? "active" : ""}" role="tab"
        aria-selected="${t.id === active}" data-tab="${t.id}" type="button">${t.label}</button>
    `).join("");
  }

  function renderPanel() {
    const tab = state.get("theory.tab");
    if (tab === "chords") panelEl.innerHTML = renderChords();
    else if (tab === "scales") panelEl.innerHTML = renderScales();
    else if (tab === "detect") { panelEl.innerHTML = renderDetect(); updateLive(); }
    else if (tab === "circle") panelEl.innerHTML = renderCircle();
    else if (tab === "progression") { panelEl.innerHTML = renderProgression(); updateProgressionResult(); }
  }

  // ---- shared bits ----
  function rootSelect(id, value) {
    return `<label class="tw-field"><span>Root</span><select id="${id}">
      ${ROOTS.map((r) => `<option value="${r}" ${r === value ? "selected" : ""}>${r}</option>`).join("")}
    </select></label>`;
  }
  function typeSelect(id, defs, value) {
    return `<label class="tw-field"><span>Type</span><select id="${id}">
      ${Object.entries(defs).map(([k, d]) => `<option value="${k}" ${k === value ? "selected" : ""}>${esc(d.name)}</option>`).join("")}
    </select></label>`;
  }
  function chips(notes) {
    return notes.map((n) => `<span class="tw-chip">${esc(n)}</span>`).join("");
  }
  function playButton(notes, label = "▶ Play", stagger = 0) {
    return `<button class="tw-play" type="button" data-play="${esc(notes.join(","))}" data-stagger="${stagger}">${label}</button>`;
  }

  // ---- 1. Chord Explorer ----
  function renderChords() {
    const root = state.get("theory.chordRoot");
    const type = state.get("theory.chordType");
    const info = theory.getChordInfo(root, type);
    const noteChips = info.notes.map((n) => {
      const iv = theory.getInterval(root, n);
      return `<span class="tw-chip" title="${esc(iv.name)}">${esc(n)}<small>${esc(iv.short)}</small></span>`;
    }).join("");
    return `
      <div class="tw-controls">
        ${rootSelect("twChordRoot", root)}
        ${typeSelect("twChordType", CHORD_TYPES, type)}
        ${playButton(info.notes, "▶ Play chord")}
      </div>
      <div class="tw-card">
        <div class="tw-result-head"><span class="tw-result-main">${esc(info.name)}</span><span class="tw-symbol">${esc(info.symbol)}</span></div>
        <div class="tw-chips">${noteChips}</div>
        <dl class="tw-meta">
          <div><dt>Intervals</dt><dd>${info.notes.map((n) => esc(theory.getInterval(root, n).name)).join(", ")}</dd></div>
          <div><dt>Semitones</dt><dd>${CHORD_TYPES[type].semitones.join(" · ")}</dd></div>
          <div><dt>Family</dt><dd>${esc(info.family)}</dd></div>
        </dl>
      </div>`;
  }

  // ---- 2. Scale Explorer ----
  function renderScales() {
    const root = state.get("theory.scaleRoot");
    const type = state.get("theory.scaleType");
    const info = theory.getScaleInfo(root, type);
    let diatonic = "";
    if (info.notes.length === 7) {
      const s = info.notes;
      const triads = s.map((_, i) => [s[i], s[(i + 2) % 7], s[(i + 4) % 7]]);
      const symbols = triads.map((t) => theory.detectChord(t).symbol);
      const prog = theory.analyzeProgression(symbols); // Roman numerals, reused
      diatonic = `
        <h4 class="tw-subhead">Diatonic chords</h4>
        <div class="tw-degrees">
          ${symbols.map((sym, i) => `
            <button class="tw-degree" type="button" data-play="${esc(voice(triads[i]).join(","))}" data-stagger="0">
              <span class="tw-num">${esc(prog.roman[i])}</span><span class="tw-deg-name">${esc(sym)}</span>
            </button>`).join("")}
        </div>`;
    }
    return `
      <div class="tw-controls">
        ${rootSelect("twScaleRoot", root)}
        ${typeSelect("twScaleType", SCALE_TYPES, type)}
        ${playButton(voice([...info.notes, info.notes[0]]), "▶ Play scale", 150)}
      </div>
      <div class="tw-card">
        <div class="tw-result-head"><span class="tw-result-main">${esc(info.name)}</span></div>
        <div class="tw-chips">${chips(info.notes)}</div>
        ${diatonic}
      </div>`;
  }

  // ---- 3/4/5. Live Analysis ----
  function renderDetect() {
    return `
      <div class="tw-detect-head">
        <p class="tw-hint">Play with your mouse, keyboard, or a MIDI controller — analysis updates live.</p>
        <button class="tw-clear" type="button" id="twClear">Clear</button>
      </div>
      <div class="tw-grid3">
        <div class="tw-card"><h4 class="tw-subhead">Chord detection</h4>
          <div class="tw-held" id="twHeld"></div><div id="twChordResult"></div></div>
        <div class="tw-card"><h4 class="tw-subhead">Scale detection</h4><div id="twScaleResult"></div></div>
        <div class="tw-card"><h4 class="tw-subhead">Key detection</h4><div id="twKeyResult"></div></div>
      </div>
      <div class="tw-card"><h4 class="tw-subhead">Recently played</h4><div class="tw-chips" id="twRecent"></div></div>`;
  }

  function detectionResult(result) {
    if (!result) return `<p class="tw-hint">—</p>`;
    const alts = (result.alternatives || []).filter((a) => a.confidence > 0.3).slice(0, 2)
      .map((a) => `<span class="tw-alt">${esc(a.root)} ${esc(a.type)} · ${pct(a.confidence)}</span>`).join("");
    return `
      <div class="tw-result-head"><span class="tw-result-main">${esc(result.name)}</span><span class="tw-conf">${pct(result.confidence)}</span></div>
      <div class="tw-chips">${chips(result.notes || [])}</div>
      ${alts ? `<div class="tw-alts">also: ${alts}</div>` : ""}`;
  }

  function distinctRecent() {
    const seen = new Set();
    const out = [];
    recent.slice(-16).forEach(({ name }) => {
      const pc = pitchClass(name);
      if (!seen.has(pc)) { seen.add(pc); out.push(name); }
    });
    return out;
  }

  function updateLive() {
    const heldEl = mount.querySelector("#twHeld");
    if (!heldEl) return; // detect tab not mounted
    const heldNames = [...held.keys()];
    heldEl.innerHTML = heldNames.length ? chips(heldNames.map(stripOctave)) : `<span class="tw-hint">no notes held</span>`;

    const chordEl = mount.querySelector("#twChordResult");
    chordEl.innerHTML = heldNames.length >= 2
      ? detectionResult(theory.detectChord(heldNames))
      : `<p class="tw-hint">Hold 2+ notes to detect a chord.</p>`;

    const distinct = distinctRecent();
    mount.querySelector("#twScaleResult").innerHTML = distinct.length >= 4
      ? detectionResult(theory.detectScale(distinct))
      : `<p class="tw-hint">Play 4+ distinct notes.</p>`;

    const names = recent.map((r) => r.name);
    const keyEl = mount.querySelector("#twKeyResult");
    if (names.length >= 4) {
      const k = theory.detectKey(names);
      keyEl.innerHTML = `<div class="tw-result-head"><span class="tw-result-main">${esc(k.name)}</span><span class="tw-conf">${pct(k.confidence)}</span></div>`;
    } else {
      keyEl.innerHTML = `<p class="tw-hint">Play a few notes.</p>`;
    }

    mount.querySelector("#twRecent").innerHTML = recent.length
      ? chips(recent.slice(-16).map((r) => stripOctave(r.name)))
      : `<span class="tw-hint">nothing yet</span>`;
  }

  // ---- 6. Circle of Fifths ----
  function renderCircle() {
    const sel = state.get("theory.circleKey");
    const circle = theory.getCircle();
    const keys = circle.map((e, i) => {
      const angle = ((i * 30 - 90) * Math.PI) / 180;
      const x = 50 + 40 * Math.cos(angle);
      const y = 50 + 40 * Math.sin(angle);
      const active = e.major === sel;
      return `<button class="tw-key ${active ? "active" : ""}" type="button" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%"
        data-circle="${esc(e.major)}" aria-pressed="${active}" aria-label="${esc(e.major)} major, relative minor ${esc(e.minor)}">
        <strong>${esc(e.major)}</strong><small>${esc(e.minor)}</small></button>`;
    }).join("");

    const ks = theory.getKeySignature(sel, "major");
    const nb = theory.getNeighbors(sel, "major");
    const sig = ks.type === "none" ? "no sharps or flats" : `${ks.count} ${ks.type}${ks.count > 1 ? "s" : ""} (${ks.notes.join(", ")})`;
    const scaleNotes = theory.getScale(sel, "major");
    return `
      <div class="tw-circle-wrap">
        <div class="tw-circle" role="group" aria-label="Circle of fifths">${keys}<span class="tw-circle-center">♯ / ♭</span></div>
        <div class="tw-card tw-circle-detail">
          <div class="tw-result-head"><span class="tw-result-main">${esc(sel)} Major</span><span class="tw-symbol">${esc(nb.relative)}</span></div>
          <dl class="tw-meta">
            <div><dt>Key signature</dt><dd>${esc(sig)}</dd></div>
            <div><dt>Relative minor</dt><dd>${esc(nb.relative)}</dd></div>
            <div><dt>Dominant (V)</dt><dd>${esc(nb.dominant)}</dd></div>
            <div><dt>Subdominant (IV)</dt><dd>${esc(nb.subdominant)}</dd></div>
          </dl>
          <div class="tw-chips">${chips(scaleNotes)}</div>
          <div class="tw-controls">
            ${playButton(voice([...scaleNotes, scaleNotes[0]]), "▶ Play scale", 150)}
            <button class="tw-play tw-ghost" type="button" data-open-scale="${esc(sel)}">Open in Scale Explorer</button>
          </div>
        </div>
      </div>`;
  }

  // ---- 7. Progression Lab ----
  function renderProgression() {
    const value = state.get("theory.progression");
    return `
      <div class="tw-controls tw-prog-controls">
        <label class="tw-field tw-grow"><span>Chords</span>
          <input type="text" id="twProgInput" value="${esc(value)}" placeholder="e.g. C G Am F" autocomplete="off"></label>
        <button class="tw-play" type="button" id="twProgPlay">▶ Play</button>
      </div>
      <div class="tw-presets">
        ${PRESET_PROGRESSIONS.map((p) => `<button class="tw-preset" type="button" data-preset="${esc(p.value)}">${esc(p.label)}</button>`).join("")}
      </div>
      <div class="tw-card" id="twProgResult"></div>`;
  }

  function updateProgressionResult() {
    const el = mount.querySelector("#twProgResult");
    if (!el) return;
    const value = state.get("theory.progression").trim();
    const symbols = value.split(/[\s,]+/).filter(Boolean);
    if (!symbols.length) { el.innerHTML = `<p class="tw-hint">Enter chords like "C G Am F".</p>`; return; }
    let result;
    try { result = theory.analyzeProgression(symbols); } catch {
      el.innerHTML = `<p class="tw-hint">Couldn't parse those chords. Try symbols like Am, G7, Cmaj7.</p>`;
      return;
    }
    const numerals = result.roman.map((r, i) => `<span class="tw-num-chip" title="${esc(symbols[i])}">${esc(r)}</span>`).join("");
    el.innerHTML = `
      <div class="tw-result-head">
        <span class="tw-result-main">${esc(result.key)}</span>
        ${result.name ? `<span class="tw-badge">${esc(result.name)}</span>` : ""}
        <span class="tw-conf">${pct(result.confidence)} diatonic</span>
      </div>
      <div class="tw-numerals">${numerals}</div>`;
  }

  // ---- events ----
  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    state.set("theory.tab", btn.dataset.tab);
    renderTabs();
    renderPanel();
  });

  panelEl.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "twChordRoot") { state.set("theory.chordRoot", t.value); renderPanel(); }
    else if (t.id === "twChordType") { state.set("theory.chordType", t.value); renderPanel(); }
    else if (t.id === "twScaleRoot") { state.set("theory.scaleRoot", t.value); renderPanel(); }
    else if (t.id === "twScaleType") { state.set("theory.scaleType", t.value); renderPanel(); }
  });

  panelEl.addEventListener("input", (e) => {
    if (e.target.id === "twProgInput") {
      state.set("theory.progression", e.target.value);
      updateProgressionResult();
    }
  });

  panelEl.addEventListener("click", (e) => {
    const play = e.target.closest("[data-play]");
    if (play) {
      const notes = play.dataset.play.split(",").filter(Boolean);
      preview(notes, { stagger: Number(play.dataset.stagger) || 0, duration: 0.85 });
      return;
    }
    const circle = e.target.closest("[data-circle]");
    if (circle) { state.set("theory.circleKey", circle.dataset.circle); renderPanel(); return; }

    const openScale = e.target.closest("[data-open-scale]");
    if (openScale) {
      state.set("theory.scaleRoot", openScale.dataset.openScale);
      state.set("theory.scaleType", "major");
      state.set("theory.tab", "scales");
      renderTabs();
      renderPanel();
      return;
    }
    const preset = e.target.closest("[data-preset]");
    if (preset) {
      state.set("theory.progression", preset.dataset.preset);
      const input = mount.querySelector("#twProgInput");
      if (input) input.value = preset.dataset.preset;
      updateProgressionResult();
      return;
    }
    if (e.target.id === "twProgPlay") {
      const symbols = state.get("theory.progression").trim().split(/[\s,]+/).filter(Boolean);
      symbols.forEach((sym, i) => {
        window.setTimeout(() => {
          try {
            const { root, type } = theory.parseChord(sym);
            preview(voice(theory.getChord(root, type)), { duration: 0.7, stagger: 0 });
          } catch { /* skip unparseable chord */ }
        }, i * 750);
      });
      return;
    }
    if (e.target.id === "twClear") {
      held.clear();
      recent = [];
      updateLive();
    }
  });

  // ---- live analysis: subscribe to the unified input stream ----
  function prune() {
    const cutoff = Date.now() - 8000;
    recent = recent.filter((r) => r.t >= cutoff).slice(-24);
  }
  bus.on("note:on", ({ note }) => {
    held.set(note, true);
    recent.push({ name: note, t: Date.now() });
    prune();
    updateLive();
  });
  bus.on("note:off", ({ note }) => {
    held.delete(note);
    updateLive();
  });

  // ---- first paint ----
  renderTabs();
  renderPanel();
}
