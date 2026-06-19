/**
 * TheoryEngine — the public facade over the theory layer.
 *
 * Stateless and dependency-free: it composes the pure submodules into the
 * simple API that Chord Explorer, Scale Explorer, Circle of Fifths, Practice
 * Mode, detection, the Progression Lab, and the AI coach will all consume.
 *
 *   const theory = new TheoryEngine();
 *   theory.getChord("C", "major")        // ["C", "E", "G"]
 *   theory.getScale("D", "dorian")       // ["D","E","F","G","A","B","C"]
 *   theory.getInterval("C", "G")         // { name:"Perfect Fifth", semitones:7, ... }
 *   theory.getRelativeMinor("C")         // "A Minor"
 *   theory.getRelativeMajor("A Minor")   // "C Major"
 */

import { parseNote, formatNote, pitchClass } from "./notes.js";
import { getChord, getChordInfo, parseChordSymbol, CHORD_TYPES, CHORD_TYPE_LIST } from "./chords.js";
import { getScale, getScaleInfo, SCALE_TYPES, SCALE_TYPE_LIST } from "./scales.js";
import { getInterval } from "./intervals.js";
import { getMode, modesOfKey, MODE_ORDER } from "./modes.js";
import {
  CIRCLE, buildCircle, getKeySignature, neighbors, relativeMinor, relativeMajor, fifthsOf
} from "./circle-of-fifths.js";
import { detectChord, detectScale, detectKey } from "./detection.js";
import { analyzeProgression } from "./progressions.js";

function stripQuality(name) {
  // Accept "C", "C Major", "Am", "A Minor" as a bare root for relative lookups.
  return String(name).replace(/\s*(major|minor)\s*$/i, "").replace(/m$/, "").trim();
}

export class TheoryEngine {
  // --- chords ---
  getChord(root, type = "major") { return getChord(root, type); }
  getChordInfo(root, type = "major") { return getChordInfo(root, type); }
  parseChord(symbol) { return parseChordSymbol(symbol); }
  get chordTypes() { return CHORD_TYPE_LIST; }

  // --- scales & modes ---
  getScale(root, type = "major") { return getScale(root, type); }
  getScaleInfo(root, type = "major") { return getScaleInfo(root, type); }
  getMode(root, mode) { return getMode(root, mode); }
  getModesOfKey(root) { return modesOfKey(root); }
  get scaleTypes() { return SCALE_TYPE_LIST; }
  get modes() { return MODE_ORDER; }

  // --- notes ---
  pitchClass(note) { return pitchClass(note); }

  // --- intervals ---
  getInterval(a, b) { return getInterval(a, b); }
  /** Convenience matching the spec example: { name, semitones }. */
  getIntervals(a, b) { const i = getInterval(a, b); return { name: i.name, semitones: i.semitones }; }

  // --- keys / circle of fifths ---
  getCircle() { return CIRCLE; }
  buildCircle() { return buildCircle(); }
  getKeySignature(root, quality = "major") { return getKeySignature(root, quality); }
  getNeighbors(root, quality = "major") { return neighbors(root, quality); }
  fifthsOf(note) { return fifthsOf(note); }

  getRelativeMinor(majorKey) {
    const root = formatNote({ ...parseNote(stripQuality(majorKey)), octave: null });
    return `${relativeMinor(root)} Minor`;
  }

  getRelativeMajor(minorKey) {
    const root = formatNote({ ...parseNote(stripQuality(minorKey)), octave: null });
    return `${relativeMajor(root)} Major`;
  }

  // --- detection ---
  detectChord(notes) { return detectChord(notes); }
  detectScale(notes) { return detectScale(notes); }
  detectKey(notes) { return detectKey(notes); }

  // --- progressions ---
  analyzeProgression(symbols) { return analyzeProgression(symbols); }
}

// Re-export the pure functions for tree-shakable / direct use and testing.
export {
  getChord, getChordInfo, parseChordSymbol, CHORD_TYPES, CHORD_TYPE_LIST,
  getScale, getScaleInfo, SCALE_TYPES, SCALE_TYPE_LIST,
  getInterval, getMode, modesOfKey,
  CIRCLE, getKeySignature, neighbors, relativeMinor, relativeMajor, fifthsOf,
  detectChord, detectScale, detectKey, analyzeProgression
};

export default TheoryEngine;
