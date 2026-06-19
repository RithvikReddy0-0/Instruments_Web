/**
 * Algorithmic chord & scale detection.
 *
 * No giant lookup tables: detection iterates candidate roots × formulas and
 * scores each candidate against the input by pitch-class set comparison. Both
 * functions return a confidence score and ranked alternatives so Practice Mode,
 * Chord/Scale/Key detection, and the AI coach can all consume them.
 */

import { parseNote, pitchClass, formatNote, accidentalFor, LETTERS, LETTER_PC } from "./notes.js";
import { CHORD_TYPES, CHORD_TYPE_LIST } from "./chords.js";
import { SCALE_TYPES, SCALE_TYPE_LIST } from "./scales.js";

function pcSet(notes) {
  return new Set(notes.map((n) => pitchClass(n)));
}

function intersectionSize(a, b) {
  let count = 0;
  a.forEach((x) => { if (b.has(x)) count += 1; });
  return count;
}

// Spell a pitch class as a note name, preferring the spelling the user supplied.
function spellPc(pc, preferred) {
  const match = preferred.find((n) => pitchClass(n) === pc);
  if (match) return formatNote({ ...parseNote(match), octave: null });
  // Otherwise pick the natural/simplest letter for this pc.
  const letter = LETTERS.find((l) => LETTER_PC[l] === pc)
    || LETTERS.reduce((best, l) => {
      const acc = Math.abs(accidentalFor(l, pc));
      return acc < best.acc ? { letter: l, acc } : best;
    }, { letter: "C", acc: 99 }).letter;
  return formatNote({ letter, accidental: accidentalFor(letter, pc), octave: null });
}

/**
 * detectChord(["C","E","G"]) → { root:"C", type:"major", name:"C Major", confidence:1, ... }
 * Confidence is the Jaccard similarity between the candidate chord and the input
 * (with a small bonus when the lowest note is the candidate root).
 */
export function detectChord(notes) {
  if (!notes || notes.length === 0) return null;
  const input = pcSet(notes);
  const bassPc = pitchClass(notes[0]);
  const inputNames = notes.map((n) => formatNote({ ...parseNote(n), octave: null }));

  const candidates = [];
  for (let rootPc = 0; rootPc < 12; rootPc += 1) {
    for (const type of CHORD_TYPE_LIST) {
      const def = CHORD_TYPES[type];
      const chordSet = new Set(def.semitones.map((s) => (rootPc + s) % 12));
      const inter = intersectionSize(input, chordSet);
      const union = new Set([...input, ...chordSet]).size;
      // `score` keeps the raw value (including the root-position bonus) for
      // ranking; the reported confidence is clamped to 1.
      let score = inter / union; // Jaccard
      if (rootPc === bassPc) score += 0.05;
      candidates.push({ rootPc, type, score, def });
    }
  }

  candidates.sort((a, b) => b.score - a.score
    || a.def.semitones.length - b.def.semitones.length);

  const best = candidates[0];
  const root = spellPc(best.rootPc, inputNames);
  return {
    root,
    type: best.type,
    name: `${root} ${best.def.name}`,
    symbol: `${root}${best.def.symbol}`,
    confidence: Number(Math.min(1, best.score).toFixed(3)),
    notes: best.def.semitones.map((s) => spellPc((best.rootPc + s) % 12, inputNames)),
    alternatives: candidates.slice(1, 4).map((c) => ({
      root: spellPc(c.rootPc, inputNames),
      type: c.type,
      confidence: Number(Math.min(1, c.score).toFixed(3))
    }))
  };
}

/**
 * detectScale(["C","D","E","F","G","A","B"]) → { root:"C", type:"major", confidence:1, ... }
 * Confidence = how fully the input fits the scale, weighted toward scales the
 * input also covers completely, with a tonic bonus for the first note.
 */
export function detectScale(notes) {
  if (!notes || notes.length === 0) return null;
  const input = pcSet(notes);
  const tonicPc = pitchClass(notes[0]);
  const inputNames = notes.map((n) => formatNote({ ...parseNote(n), octave: null }));

  const candidates = [];
  for (let rootPc = 0; rootPc < 12; rootPc += 1) {
    for (const type of SCALE_TYPE_LIST) {
      const def = SCALE_TYPES[type];
      const scaleSet = new Set(def.semitones.map((s) => (rootPc + s) % 12));
      const inter = intersectionSize(input, scaleSet);
      const fitInput = inter / input.size;       // how much of the input is explained
      const coverScale = inter / scaleSet.size;  // how much of the scale is present
      // Reward explaining all input notes; coverage breaks ties toward a more
      // specific match; tonic bonus prefers the scale rooted on the first note.
      // Keep the raw `score` (incl. bonus) for ranking; clamp confidence later.
      let score = fitInput * (0.7 + 0.3 * coverScale);
      if (rootPc === tonicPc) score += 0.05;
      candidates.push({ rootPc, type, score, fitInput, def });
    }
  }

  candidates.sort((a, b) => b.score - a.score
    || a.def.semitones.length - b.def.semitones.length);

  const best = candidates[0];
  const root = spellPc(best.rootPc, inputNames);
  return {
    root,
    type: best.type,
    name: `${root} ${best.def.name}`,
    confidence: Number(Math.min(1, best.score).toFixed(3)),
    notes: best.def.semitones.map((s) => spellPc((best.rootPc + s) % 12, inputNames)),
    alternatives: candidates.slice(1, 4).map((c) => ({
      root: spellPc(c.rootPc, inputNames),
      type: c.type,
      confidence: Number(Math.min(1, c.score).toFixed(3))
    }))
  };
}

/**
 * detectKey(notes) — infer the most probable major/minor key from a pool of
 * notes (melody or chord tones) using Krumhansl-style profile correlation.
 */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Pearson correlation of the note histogram against a tonic-rotated profile.
// This is the Krumhansl-Schmuckler method; the coefficient (−1..1) is an
// intuitive confidence value for downstream consumers.
function correlate(histogram, profile, tonic) {
  const rotated = profile.map((_, i) => profile[(i - tonic + 12) % 12]);
  const meanH = histogram.reduce((s, v) => s + v, 0) / 12;
  const meanP = rotated.reduce((s, v) => s + v, 0) / 12;
  let num = 0;
  let denH = 0;
  let denP = 0;
  for (let i = 0; i < 12; i += 1) {
    const dh = histogram[i] - meanH;
    const dp = rotated[i] - meanP;
    num += dh * dp;
    denH += dh * dh;
    denP += dp * dp;
  }
  const den = Math.sqrt(denH * denP);
  return den === 0 ? 0 : num / den;
}

export function detectKey(notes) {
  if (!notes || notes.length === 0) return null;
  const histogram = new Array(12).fill(0);
  notes.forEach((n) => { histogram[pitchClass(n)] += 1; });

  const results = [];
  for (let tonic = 0; tonic < 12; tonic += 1) {
    results.push({ tonic, quality: "major", score: correlate(histogram, MAJOR_PROFILE, tonic) });
    results.push({ tonic, quality: "minor", score: correlate(histogram, MINOR_PROFILE, tonic) });
  }
  results.sort((a, b) => b.score - a.score);
  const best = results[0];
  const root = spellPc(best.tonic, notes.map((n) => formatNote({ ...parseNote(n), octave: null })));
  return {
    root,
    quality: best.quality,
    name: `${root} ${best.quality === "major" ? "Major" : "Minor"}`,
    confidence: Number(Math.max(0, best.score).toFixed(3)),
    alternatives: results.slice(1, 4).map((r) => ({
      root: spellPc(r.tonic, []),
      quality: r.quality,
      confidence: Number(Math.max(0, r.score).toFixed(3))
    }))
  };
}
