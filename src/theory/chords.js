/**
 * Chord definitions and generation.
 *
 * Each chord type is a FORMULA: the semitone offsets of each chord tone above
 * the root, plus the diatonic letter step each tone occupies (so spelling is
 * correct — a diminished-7 root C produces C, Eb, Gb, Bbb, not C, D#, F#, A).
 * No chord is a hardcoded note list; every note is generated.
 */

import { spellNote, formatNote, parseNote } from "./notes.js";

export const CHORD_TYPES = {
  major:            { name: "Major",              symbol: "",      semitones: [0, 4, 7],      letterSteps: [0, 2, 4] },
  minor:            { name: "Minor",              symbol: "m",     semitones: [0, 3, 7],      letterSteps: [0, 2, 4] },
  diminished:       { name: "Diminished",         symbol: "dim",   semitones: [0, 3, 6],      letterSteps: [0, 2, 4] },
  augmented:        { name: "Augmented",          symbol: "aug",   semitones: [0, 4, 8],      letterSteps: [0, 2, 4] },
  sus2:             { name: "Suspended 2nd",      symbol: "sus2",  semitones: [0, 2, 7],      letterSteps: [0, 1, 4] },
  sus4:             { name: "Suspended 4th",      symbol: "sus4",  semitones: [0, 5, 7],      letterSteps: [0, 3, 4] },
  dominant7:        { name: "Dominant 7th",       symbol: "7",     semitones: [0, 4, 7, 10],  letterSteps: [0, 2, 4, 6] },
  major7:           { name: "Major 7th",          symbol: "maj7",  semitones: [0, 4, 7, 11],  letterSteps: [0, 2, 4, 6] },
  minor7:           { name: "Minor 7th",          symbol: "m7",    semitones: [0, 3, 7, 10],  letterSteps: [0, 2, 4, 6] },
  halfDiminished7:  { name: "Half-Diminished 7th", symbol: "m7b5", semitones: [0, 3, 6, 10],  letterSteps: [0, 2, 4, 6] },
  diminished7:      { name: "Diminished 7th",     symbol: "dim7",  semitones: [0, 3, 6, 9],   letterSteps: [0, 2, 4, 6] }
};

// Quality "family" for key/progression analysis (sevenths reduce to a triad).
export const CHORD_FAMILY = {
  major: "major", dominant7: "major", major7: "major", sus2: "major", sus4: "major",
  minor: "minor", minor7: "minor",
  diminished: "diminished", diminished7: "diminished", halfDiminished7: "diminished",
  augmented: "augmented"
};

// Aliases accepted by getChord / chord-symbol parsing.
const ALIASES = {
  "": "major", M: "major", maj: "major", major: "major",
  m: "minor", min: "minor", "-": "minor", minor: "minor",
  dim: "diminished", "°": "diminished", o: "diminished", diminished: "diminished",
  aug: "augmented", "+": "augmented", augmented: "augmented",
  sus2: "sus2", sus4: "sus4", sus: "sus4",
  7: "dominant7", dom7: "dominant7", dominant7: "dominant7",
  maj7: "major7", M7: "major7", "Δ": "major7", major7: "major7",
  m7: "minor7", min7: "minor7", minor7: "minor7",
  m7b5: "halfDiminished7", ø: "halfDiminished7", halfdim: "halfDiminished7", halfDiminished7: "halfDiminished7",
  dim7: "diminished7", "°7": "diminished7", diminished7: "diminished7"
};

export function resolveChordType(type) {
  const key = ALIASES[type] || (CHORD_TYPES[type] ? type : null);
  if (!key) throw new Error(`Unknown chord type: "${type}"`);
  return key;
}

/** getChord("C", "major") → ["C", "E", "G"]. Returns note-name strings. */
export function getChord(root, type = "major") {
  const key = resolveChordType(type);
  const def = CHORD_TYPES[key];
  return def.semitones.map((semi, i) => formatNote(spellNote(root, def.letterSteps[i], semi)));
}

/** Full descriptor: { root, type, name, symbol, notes }. */
export function getChordInfo(root, type = "major") {
  const key = resolveChordType(type);
  const def = CHORD_TYPES[key];
  const rootName = formatNote({ ...parseNote(root), octave: null });
  return {
    root: rootName,
    type: key,
    name: `${rootName} ${def.name}`,
    symbol: `${rootName}${def.symbol}`,
    family: CHORD_FAMILY[key],
    notes: getChord(root, key)
  };
}

const SYMBOL_RE = /^([A-Ga-g](?:##|bb|x|[#b♯♭])?)(.*)$/;

/** Parse a chord symbol like "Am", "G7", "Cmaj7", "F#m7b5" → { root, type }. */
export function parseChordSymbol(symbol) {
  const match = SYMBOL_RE.exec(String(symbol).trim());
  if (!match) throw new Error(`Invalid chord symbol: "${symbol}"`);
  const root = formatNote({ ...parseNote(match[1]), octave: null });
  const type = resolveChordType(match[2].trim());
  return { root, type };
}

export const CHORD_TYPE_LIST = Object.keys(CHORD_TYPES);
