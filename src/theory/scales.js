/**
 * Scale definitions and generation.
 *
 * Each scale is a FORMULA of semitone offsets from the root, paired with the
 * diatonic letter step for each degree so notes spell correctly. Heptatonic
 * scales use consecutive letters [0..6]; pentatonic/blues specify their letter
 * steps explicitly (these scales legitimately skip or repeat letters, e.g. the
 * blues scale's Gb and G both sit on the letter G).
 */

import { spellNote, formatNote, parseNote } from "./notes.js";

const HEPT = [0, 1, 2, 3, 4, 5, 6];

export const SCALE_TYPES = {
  major:            { name: "Major",            semitones: [0, 2, 4, 5, 7, 9, 11], letterSteps: HEPT },
  naturalMinor:     { name: "Natural Minor",    semitones: [0, 2, 3, 5, 7, 8, 10], letterSteps: HEPT },
  harmonicMinor:    { name: "Harmonic Minor",   semitones: [0, 2, 3, 5, 7, 8, 11], letterSteps: HEPT },
  melodicMinor:     { name: "Melodic Minor",    semitones: [0, 2, 3, 5, 7, 9, 11], letterSteps: HEPT },
  dorian:           { name: "Dorian",           semitones: [0, 2, 3, 5, 7, 9, 10], letterSteps: HEPT },
  phrygian:         { name: "Phrygian",         semitones: [0, 1, 3, 5, 7, 8, 10], letterSteps: HEPT },
  lydian:           { name: "Lydian",           semitones: [0, 2, 4, 6, 7, 9, 11], letterSteps: HEPT },
  mixolydian:       { name: "Mixolydian",       semitones: [0, 2, 4, 5, 7, 9, 10], letterSteps: HEPT },
  aeolian:          { name: "Aeolian",          semitones: [0, 2, 3, 5, 7, 8, 10], letterSteps: HEPT },
  locrian:          { name: "Locrian",          semitones: [0, 1, 3, 5, 6, 8, 10], letterSteps: HEPT },
  pentatonicMajor:  { name: "Major Pentatonic", semitones: [0, 2, 4, 7, 9],        letterSteps: [0, 1, 2, 4, 5] },
  pentatonicMinor:  { name: "Minor Pentatonic", semitones: [0, 3, 5, 7, 10],       letterSteps: [0, 2, 3, 4, 6] },
  blues:            { name: "Blues",            semitones: [0, 3, 5, 6, 7, 10],    letterSteps: [0, 2, 3, 4, 4, 6] }
};

const ALIASES = {
  ionian: "major",
  minor: "naturalMinor",
  "natural minor": "naturalMinor",
  "harmonic minor": "harmonicMinor",
  "melodic minor": "melodicMinor",
  "major pentatonic": "pentatonicMajor",
  "minor pentatonic": "pentatonicMinor",
  pentatonic: "pentatonicMajor"
};

export function resolveScaleType(type) {
  const lower = String(type);
  const key = SCALE_TYPES[lower] ? lower : ALIASES[lower.toLowerCase()];
  if (!key) throw new Error(`Unknown scale type: "${type}"`);
  return key;
}

/** getScale("D", "dorian") → ["D","E","F","G","A","B","C"]. */
export function getScale(root, type = "major") {
  const key = resolveScaleType(type);
  const def = SCALE_TYPES[key];
  return def.semitones.map((semi, i) => formatNote(spellNote(root, def.letterSteps[i], semi)));
}

export function getScaleInfo(root, type = "major") {
  const key = resolveScaleType(type);
  const def = SCALE_TYPES[key];
  const rootName = formatNote({ ...parseNote(root), octave: null });
  return { root: rootName, type: key, name: `${rootName} ${def.name}`, notes: getScale(root, key) };
}

export const SCALE_TYPE_LIST = Object.keys(SCALE_TYPES);
