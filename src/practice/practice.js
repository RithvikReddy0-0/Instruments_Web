/**
 * Practice Platform orchestrator + UI.
 *
 * Built entirely on existing systems: TheoryEngine (targets + validation),
 * detectChord/detectScale (answer checking), the shared note:on/off bus (input
 * from keyboard/pointer/MIDI), the Metronome (rhythm), and the Storage layer
 * (analytics). Transient UI state lives in state.practice.lab; analytics persist
 * in the "practice" IndexedDB store. No duplicate theory/detection/state.
 */

import { TRAINERS, generateExercise, validateAnswer, scoreRhythm } from "./exercises.js";
import { PracticeSession } from "./sessions.js";
import { Analytics, derivedStats } from "./analytics.js";
import { getRecommendations } from "./recommendations.js";
import { pitchClass, parseNote, formatNote } from "../theory/notes.js";

const COUNTS = { note: 10, interval: 10, chord: 8, scale: 6, rhythm: 4 };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pcName = (n) => formatNote({ ...parseNote(n), octave: null });

export function initPractice({ bus, state, storage, theory, audio, ensureAudio, metronome, instruments, preview, mount }) {
  const analytics = new Analytics(storage);

  // transient run state (module-local; the dashboard/nav state lives in StateManager)
  const run = {
    session: null,
    exercise: null,
    index: 0,
    count: 0,
    startedAt: 0,
    held: new Set(),
    played: [],     // note names since exercise start (scale/sequence)
    locked: false,  // prevents double-submit during feedback
    feedback: null, // { status, message }
    checkTimer: null,
    rhythm: null
  };

  const lab = () => state.get("practice.lab");
  const setLab = (patch) => state.set("practice.lab", { ...lab(), ...patch });

  // ---- audio preview voicing (ascending octaves) ----
  function voice(names, startOctave = 4) {
    let octave = startOctave;
    let prev = -1;
    return names.map((n) => {
      const pc = pitchClass(n);
      if (pc < prev) octave += 1;
      prev = pc;
      return `${pcName(n)}${octave}`;
    });
  }

  // ---- rendering ----
  function render() {
    const view = lab().view;
    if (view === "session") renderSession();
    else if (view === "summary") renderSummary();
    else renderDashboard();
  }

  function statCard(label, value) {
    return `<div class="pr-stat"><span class="pr-stat-value">${esc(value)}</span><span class="pr-stat-label">${esc(label)}</span></div>`;
  }

  function renderDashboard() {
    const data = analytics.data;
    const d = derivedStats(data);
    const recs = getRecommendations(data);

    const byType = Object.entries(data.byType || {});
    const bars = byType.length
      ? byType.map(([t, v]) => {
          const acc = v.attempts ? Math.round((v.correct / v.attempts) * 100) : 0;
          return `<div class="pr-bar-row"><span>${esc(TRAINERS[t]?.label || t)}</span>
            <span class="pr-bar"><span class="pr-bar-fill" style="width:${acc}%"></span></span><span class="pr-bar-val">${acc}%</span></div>`;
        }).join("")
      : `<p class="pr-hint">Complete a session to see your accuracy by trainer.</p>`;

    const recCards = recs.map((r) => `
      <button class="pr-rec" type="button" data-rec-trainer="${esc(r.action.trainer)}" data-rec-level="${r.action.level}">
        <strong>${esc(r.title)}</strong><span>${esc(r.detail)}</span>
      </button>`).join("");

    const trainerCards = Object.entries(TRAINERS).map(([id, t]) => `
      <div class="pr-trainer-card">
        <h4>${esc(t.label)}</h4>
        <label class="pr-level">Level
          <select data-level-for="${id}">
            ${[1, 2, 3].map((l) => `<option value="${l}" ${lab().trainer === id && lab().level === l ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </label>
        <button class="pr-start" type="button" data-start="${id}">Start</button>
      </div>`).join("");

    mount.innerHTML = `
      <div class="practice">
        <div class="pr-stats">
          ${statCard("Practice time", `${d.totalPracticeMin} min`)}
          ${statCard("Best streak", data.bestStreak)}
          ${statCard("Accuracy", `${Math.round(d.avgAccuracy * 100)}%`)}
          ${statCard("Exercises", data.totalAttempts)}
        </div>
        <div class="pr-cols">
          <section class="pr-panel" aria-label="Recommended practice">
            <h3 class="pr-subhead">Recommended for you</h3>
            <div class="pr-recs">${recCards}</div>
          </section>
          <section class="pr-panel" aria-label="Accuracy by trainer">
            <h3 class="pr-subhead">Accuracy by trainer</h3>
            ${bars}
          </section>
        </div>
        <section class="pr-panel" aria-label="Trainers">
          <h3 class="pr-subhead">Trainers</h3>
          <div class="pr-trainers">${trainerCards}</div>
        </section>
      </div>`;
  }

  function renderSession() {
    const ex = run.exercise;
    const s = run.session;
    const progress = `${Math.min(run.index + 1, run.count)} / ${run.count}`;
    const fb = run.feedback;

    let inputArea = "";
    if (ex.inputMode === "choice") {
      inputArea = `<div class="pr-choices">${ex.choices.map((c, i) => `
        <button class="pr-choice" type="button" data-choice="${esc(c)}"><kbd>${i + 1}</kbd> ${esc(c)}</button>`).join("")}</div>`;
    } else if (ex.inputMode === "rhythm") {
      inputArea = `<div class="pr-rhythm"><div class="pr-beat" id="prBeat" aria-hidden="true"></div>
        <button class="pr-start" id="prRhythmStart" type="button">Start round</button>
        <p class="pr-hint">Tap any key on each metronome click.</p></div>`;
    } else {
      const hint = ex.inputMode === "chord" ? "Play all the chord notes together on your keyboard or MIDI."
        : ex.inputMode === "scale" ? "Play the scale one note at a time, starting on the root."
        : ex.inputMode === "sequence" ? "Play the two notes of the interval."
        : "Play the note on your keyboard or MIDI.";
      inputArea = `<p class="pr-hint">${esc(hint)}</p><div class="pr-held" id="prHeld"></div>`;
    }

    mount.innerHTML = `
      <div class="practice practice-session">
        <div class="pr-session-head">
          <button class="pr-link" id="prEnd" type="button">← End session</button>
          <span class="pr-progress">${progress}</span>
          <span class="pr-score">Score ${s.scorer.score} · Streak ${s.scorer.streak}<svg class="pr-flame" viewBox="0 0 24 24" width="0.9em" height="0.9em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></span>
        </div>
        <div class="pr-prompt" aria-live="polite">
          <p class="pr-prompt-title">${esc(ex.prompt.title)}</p>
          <p class="pr-prompt-detail">${esc(ex.prompt.detail || "")}</p>
        </div>
        ${inputArea}
        <div class="pr-feedback ${fb ? `is-${fb.status}` : ""}" role="status" aria-live="assertive">${fb ? esc(fb.message) : ""}</div>
        <div class="pr-session-controls">
          ${ex.demo ? `<button class="pr-btn" id="prHear" type="button">▶ Hear it</button>` : ""}
          <button class="pr-btn" id="prSkip" type="button">Skip</button>
        </div>
      </div>`;

    if (ex.inputMode === "chord" || ex.inputMode === "scale" || ex.inputMode === "sequence" || ex.inputMode === "note") updateHeld();
  }

  function renderSummary() {
    const sum = lab().lastSummary;
    const d = derivedStats(analytics.data);
    mount.innerHTML = `
      <div class="practice">
        <section class="pr-panel pr-summary">
          <h3 class="pr-subhead">Session complete</h3>
          <div class="pr-stats">
            ${statCard("Score", sum.score)}
            ${statCard("Accuracy", `${Math.round(sum.accuracy * 100)}%`)}
            ${statCard("Best streak", sum.bestStreak)}
            ${statCard("Correct", `${sum.correct}/${sum.attempts}`)}
          </div>
          <p class="pr-hint">Lifetime accuracy: ${Math.round(d.avgAccuracy * 100)}% across ${analytics.data.totalAttempts} exercises.</p>
          <div class="pr-session-controls">
            <button class="pr-start" id="prAgain" type="button">Practice again</button>
            <button class="pr-btn" id="prDash" type="button">Back to dashboard</button>
          </div>
        </section>
      </div>`;
  }

  function updateHeld() {
    const el = mount.querySelector("#prHeld");
    if (!el) return;
    const notes = run.exercise.inputMode === "chord" ? [...run.held] : run.played;
    el.innerHTML = notes.length ? notes.map((n) => `<span class="pr-chip">${esc(pcName(n))}</span>`).join("") : `<span class="pr-hint">…</span>`;
  }

  // ---- session lifecycle ----
  function startSession(trainer, level) {
    run.count = COUNTS[trainer] || 10;
    run.session = new PracticeSession({ trainer, level, count: run.count });
    run.index = 0;
    setLab({ view: "session", trainer, level });
    nextExercise();
  }

  function nextExercise() {
    clearTimeout(run.checkTimer);
    run.held.clear();
    run.played = [];
    run.feedback = null;
    run.locked = false;
    run.exercise = generateExercise(lab().trainer, lab().level, theory);
    run.startedAt = performance.now();
    render();
  }

  function submit(correct, message) {
    if (run.locked) return;
    run.locked = true;
    clearTimeout(run.checkTimer);
    const responseMs = performance.now() - run.startedAt;
    const result = run.session.record({ category: run.exercise.category, correct, responseMs });
    run.feedback = { status: correct ? "correct" : "wrong", message: message || (correct ? `✓ +${result.points}` : `✗ ${run.exercise.prompt.detail}`) };
    bus.emit("practice:result", { trainer: run.exercise.trainer, correct });
    render();
    setTimeout(() => {
      run.index += 1;
      if (run.index >= run.count) finishSession();
      else nextExercise();
    }, correct ? 900 : 1600);
  }

  async function finishSession() {
    const summary = run.session.summary();
    await analytics.recordSession(summary);
    setLab({ view: "summary", lastSummary: summary });
    bus.emit("practice:session-complete", summary); // lets the Coach recompute
    bus.emit("toast", { message: `Practice complete · ${Math.round(summary.accuracy * 100)}% accuracy`, kind: "success" });
    render();
  }

  // ---- input handling (shared bus stream) ----
  function onNoteOn(note, velocity) {
    if (lab().view !== "session" || !run.exercise || run.locked) return;
    const ex = run.exercise;
    if (ex.inputMode === "note") {
      submit(validateAnswer(ex, note, theory).correct);
    } else if (ex.inputMode === "chord") {
      run.held.add(note);
      updateHeld();
      const targetSize = theory.getChord(ex.target.root, ex.target.type).length;
      clearTimeout(run.checkTimer);
      run.checkTimer = setTimeout(() => {
        if (validateAnswer(ex, [...run.held], theory).correct) submit(true);
      }, run.held.size >= targetSize ? 120 : 350);
    } else if (ex.inputMode === "scale") {
      run.played.push(note);
      updateHeld();
      const len = theory.getScale(ex.target.root, ex.target.scaleType).length;
      const distinct = new Set(run.played.map((n) => pitchClass(n)));
      if (distinct.size >= len && validateAnswer(ex, run.played, theory).correct) submit(true);
    } else if (ex.inputMode === "sequence") {
      run.played.push(note);
      updateHeld();
      if (run.played.length >= 2) {
        const res = validateAnswer(ex, run.played.slice(-2), theory);
        submit(res.correct);
      }
    } else if (ex.inputMode === "rhythm" && run.rhythm?.capturing) {
      run.rhythm.taps.push(audio.context.currentTime);
    }
  }
  function onNoteOff(note) {
    if (run.exercise?.inputMode === "chord") { run.held.delete(note); updateHeld(); }
  }
  bus.on("note:on", ({ note, velocity }) => onNoteOn(note, velocity));
  bus.on("note:off", ({ note }) => onNoteOff(note));

  // ---- rhythm round ----
  async function runRhythmRound() {
    const ready = await ensureAudio();
    if (!ready) return;
    const { tempo, beats } = run.exercise.target;
    const beatDur = 60 / tempo;
    metronome.setTempo(tempo);
    metronome.stop();
    metronome.start();
    const t0 = audio.context.currentTime + 0.12;
    const beatTimes = Array.from({ length: beats }, (_, i) => t0 + i * beatDur);
    run.rhythm = { capturing: true, taps: [], beatTimes };

    const beatEl = mount.querySelector("#prBeat");
    let beat = 0;
    const pulse = setInterval(() => {
      beat += 1;
      if (beatEl) { beatEl.classList.add("pulse"); setTimeout(() => beatEl?.classList.remove("pulse"), 120); }
      if (beat >= beats) clearInterval(pulse);
    }, beatDur * 1000);

    setTimeout(() => {
      metronome.stop();
      run.rhythm.capturing = false;
      const { accuracy } = scoreRhythm(run.rhythm.taps, run.rhythm.beatTimes);
      submit(accuracy >= 0.6, accuracy >= 0.6 ? `✓ ${Math.round(accuracy * 100)}% on beat` : `✗ ${Math.round(accuracy * 100)}% on beat`);
    }, (beats + 0.6) * beatDur * 1000 + 200);
  }

  // ---- events ----
  mount.addEventListener("click", (e) => {
    const start = e.target.closest("[data-start]");
    if (start) { startSession(start.dataset.start, currentLevelFor(start.dataset.start)); return; }
    const rec = e.target.closest("[data-rec-trainer]");
    if (rec) { startSession(rec.dataset.recTrainer, Number(rec.dataset.recLevel) || 1); return; }
    const choice = e.target.closest("[data-choice]");
    if (choice) { submit(validateAnswer(run.exercise, choice.dataset.choice, theory).correct); return; }
    if (e.target.closest("#prHear")) { preview(voice(run.exercise.demo), { stagger: run.exercise.inputMode === "chord" ? 0 : 170, duration: 0.8 }); return; }
    if (e.target.closest("#prSkip")) { submit(false); return; }
    if (e.target.closest("#prEnd") || e.target.closest("#prDash")) { setLab({ view: "dashboard" }); render(); return; }
    if (e.target.closest("#prAgain")) { startSession(lab().trainer, lab().level); return; }
    if (e.target.closest("#prRhythmStart")) { runRhythmRound(); return; }
  });

  mount.addEventListener("change", (e) => {
    const lvl = e.target.closest("[data-level-for]");
    if (lvl) setLab({ trainer: lvl.dataset.levelFor, level: Number(lvl.value) });
  });

  function currentLevelFor(trainer) {
    const sel = mount.querySelector(`[data-level-for="${trainer}"]`);
    return sel ? Number(sel.value) : 1;
  }

  // Coach dashboard "Start" buttons launch the exact session here.
  bus.on("coach:start-practice", ({ trainer, level }) => {
    document.getElementById("practice")?.scrollIntoView({ behavior: "smooth" });
    startSession(trainer, level || 1);
  });

  // digit keys 1-4 select choices (keyboard-first)
  document.addEventListener("keydown", (e) => {
    if (lab().view !== "session" || run.exercise?.inputMode !== "choice" || run.locked) return;
    if (e.target.matches("input, select, textarea")) return;
    const n = Number(e.key);
    if (n >= 1 && n <= run.exercise.choices.length) {
      e.preventDefault();
      submit(validateAnswer(run.exercise, run.exercise.choices[n - 1], theory).correct);
    }
  });

  // ---- boot ----
  (async () => {
    await analytics.load();
    setLab({ analytics: true }); // marker; dashboard reads analytics.data directly
    render();
  })();

  return { render };
}
