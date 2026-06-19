/**
 * Exercise engine — pure generators and validators for every trainer.
 *
 * Targets are generated with TheoryEngine (getChord/getScale/getInterval +
 * spellNote); answers are validated with TheoryEngine + detectChord/detectScale.
 * There is no music-theory logic here — only orchestration of the engine. The
 * UI consumes generateExercise()/validateAnswer(); never the reverse.
 *
 * exercise = { trainer, level, inputMode, prompt:{title,detail}, target,
 *              answer?, choices?, demo?:string[], category }
 */

import { pitchClass, formatNote, spellNote, parseNote } from "../theory/notes.js";
import { CHORD_TYPES } from "../theory/chords.js";
import { SCALE_TYPES } from "../theory/scales.js";

const NATURALS = ["C", "D", "E", "F", "G", "A", "B"];
const ALL_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const pcName = (n) => formatNote({ ...parseNote(n), octave: null });
const samePc = (a, b) => pitchClass(a) === pitchClass(b);

// Interval definitions (number drives spelling; semitones drives pitch).
const INTERVALS = [
  { number: 2, semitones: 1 }, { number: 2, semitones: 2 },
  { number: 3, semitones: 3 }, { number: 3, semitones: 4 },
  { number: 4, semitones: 5 }, { number: 5, semitones: 6 },
  { number: 5, semitones: 7 }, { number: 6, semitones: 8 },
  { number: 6, semitones: 9 }, { number: 7, semitones: 10 },
  { number: 7, semitones: 11 }, { number: 8, semitones: 12 }
];
const INTERVAL_NAME_POOL = [
  "Minor Second", "Major Second", "Minor Third", "Major Third", "Perfect Fourth",
  "Diminished Fifth", "Perfect Fifth", "Minor Sixth", "Major Sixth",
  "Minor Seventh", "Major Seventh", "Perfect Octave"
];

const CHORD_LEVELS = {
  1: ["major", "minor"],
  2: ["dominant7", "major7", "minor7"],
  3: ["diminished", "augmented", "sus2", "sus4", "halfDiminished7", "diminished7"]
};
const SCALE_LEVELS = {
  1: ["major", "naturalMinor"],
  2: ["dorian", "phrygian", "lydian", "mixolydian", "locrian"],
  3: ["harmonicMinor", "melodicMinor", "pentatonicMajor", "pentatonicMinor", "blues"]
};
const RHYTHM_TEMPOS = { 1: 80, 2: 100, 3: 130 };

export const TRAINERS = {
  note: { label: "Note Trainer", inputMode: "note", levels: 3 },
  interval: { label: "Interval Trainer", inputMode: "choice", levels: 3 },
  chord: { label: "Chord Trainer", inputMode: "chord", levels: 3 },
  scale: { label: "Scale Trainer", inputMode: "scale", levels: 3 },
  rhythm: { label: "Rhythm Trainer", inputMode: "rhythm", levels: 3 }
};

// ---------- generators ----------
export function generateExercise(trainer, level, theory) {
  switch (trainer) {
    case "note": return genNote(level);
    case "interval": return genInterval(level, theory);
    case "chord": return genChord(level, theory);
    case "scale": return genScale(level, theory);
    case "rhythm": return genRhythm(level);
    default: throw new Error(`Unknown trainer: ${trainer}`);
  }
}

function genNote(level) {
  const target = rand(level === 1 ? NATURALS : ALL_ROOTS);
  return {
    trainer: "note", level, inputMode: "note",
    prompt: { title: "Find and play this note", detail: target },
    target, category: `note:${target}`
  };
}

function genInterval(level, theory) {
  const root = rand(ALL_ROOTS);
  if (level < 3) {
    const def = rand(level === 1
      ? INTERVALS.filter((i) => [3, 4, 5, 7, 12].includes(i.semitones))
      : INTERVALS);
    const second = pcName(spellNote(root, def.number - 1, def.semitones));
    const answer = theory.getInterval(root, second).name; // authoritative name
    const distractors = shuffle(INTERVAL_NAME_POOL.filter((n) => n !== answer)).slice(0, 3);
    return {
      trainer: "interval", level, inputMode: "choice",
      prompt: { title: "Identify the interval", detail: `${root} → ${second}` },
      answer, choices: shuffle([answer, ...distractors]),
      demo: [`${root}`, `${second}`], category: `interval:${answer}`
    };
  }
  const def = rand(INTERVALS.filter((i) => i.semitones !== 6));
  const second = pcName(spellNote(root, def.number - 1, def.semitones));
  const name = theory.getInterval(root, second).name;
  return {
    trainer: "interval", level, inputMode: "sequence",
    prompt: { title: `Play a ${name}`, detail: `starting from ${root}` },
    target: { root, name }, demo: [`${root}`, `${second}`], category: `interval:${name}`
  };
}

function genChord(level, theory) {
  const root = rand(ALL_ROOTS);
  const type = rand(CHORD_LEVELS[level] || CHORD_LEVELS[1]);
  const info = theory.getChordInfo(root, type);
  return {
    trainer: "chord", level, inputMode: "chord",
    prompt: { title: "Play this chord", detail: info.name },
    target: { root, type }, demo: info.notes, category: `chord:${type}`
  };
}

function genScale(level, theory) {
  const root = rand(ALL_ROOTS);
  const scaleType = rand(SCALE_LEVELS[level] || SCALE_LEVELS[1]);
  const info = theory.getScaleInfo(root, scaleType);
  return {
    trainer: "scale", level, inputMode: "scale",
    prompt: { title: "Play this scale (start on the root)", detail: info.name },
    target: { root, scaleType }, demo: info.notes, category: `scale:${scaleType}`
  };
}

function genRhythm(level) {
  const tempo = RHYTHM_TEMPOS[level] || 100;
  const beats = 8;
  return {
    trainer: "rhythm", level, inputMode: "rhythm",
    prompt: { title: "Tap on every beat", detail: `${tempo} BPM · ${beats} beats` },
    target: { tempo, beats }, category: `rhythm:${tempo}` };
}

// ---------- validators ----------
export function validateAnswer(exercise, input, theory) {
  switch (exercise.inputMode) {
    case "note":
      return { correct: samePc(input, exercise.target) };
    case "choice":
      return { correct: input === exercise.answer };
    case "sequence": {
      if (!input || input.length < 2) return { correct: false };
      const name = theory.getInterval(input[0], input[1]).name;
      return { correct: name === exercise.target.name, detail: name };
    }
    case "chord": {
      const detected = theory.detectChord(input);
      const byDetect = detected && samePc(detected.root, exercise.target.root) && detected.type === exercise.target.type;
      const wanted = new Set(theory.getChord(exercise.target.root, exercise.target.type).map((n) => pitchClass(n)));
      const got = new Set(input.map((n) => pitchClass(n)));
      const bySet = wanted.size === got.size && [...wanted].every((p) => got.has(p));
      return { correct: Boolean(byDetect || bySet), detail: detected?.name };
    }
    case "scale": {
      const detected = theory.detectScale(input);
      const byDetect = detected && samePc(detected.root, exercise.target.root) && detected.type === exercise.target.scaleType;
      const wanted = new Set(theory.getScale(exercise.target.root, exercise.target.scaleType).map((n) => pitchClass(n)));
      const got = new Set(input.map((n) => pitchClass(n)));
      const bySet = [...wanted].every((p) => got.has(p));
      return { correct: Boolean(byDetect || bySet), detail: detected?.name };
    }
    default:
      return { correct: false };
  }
}

/** Pure rhythm scorer: fraction of beats hit within tolerance + average error. */
export function scoreRhythm(tapTimes, beatTimes, toleranceMs = 140) {
  const tol = toleranceMs / 1000;
  let hits = 0;
  let errorSum = 0;
  const used = new Set();
  beatTimes.forEach((bt) => {
    let bestIdx = -1;
    let bestErr = Infinity;
    tapTimes.forEach((tt, i) => {
      if (used.has(i)) return;
      const err = Math.abs(tt - bt);
      if (err < bestErr) { bestErr = err; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestErr <= tol) { hits += 1; errorSum += bestErr; used.add(bestIdx); }
  });
  return {
    accuracy: beatTimes.length ? hits / beatTimes.length : 0,
    avgErrorMs: hits ? (errorSum / hits) * 1000 : 0,
    hits
  };
}

export { CHORD_TYPES, SCALE_TYPES };
