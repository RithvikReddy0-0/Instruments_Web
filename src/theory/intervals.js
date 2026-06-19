/**
 * Interval analysis between two notes.
 *
 * An interval has a NUMBER (unison, second, third…) derived from the letter
 * distance, and a QUALITY (perfect/major/minor/augmented/diminished) derived
 * from how the actual semitone count compares to the reference. This two-part
 * model is why C–F# (augmented 4th) and C–Gb (diminished 5th) are named
 * differently even though both span 6 semitones.
 */

import { parseNote, pitchClass, letterIndex, toMidi } from "./notes.js";

const NUMBER_NAMES = {
  1: "Unison", 2: "Second", 3: "Third", 4: "Fourth",
  5: "Fifth", 6: "Sixth", 7: "Seventh", 8: "Octave"
};

// Reference semitones for a "perfect" (1,4,5,8) or "major" (2,3,6,7) interval.
const REFERENCE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 };
const PERFECT = new Set([1, 4, 5, 8]);

function qualityFor(number, diff) {
  if (PERFECT.has(number)) {
    if (diff === 0) return "Perfect";
    if (diff === 1) return "Augmented";
    if (diff === -1) return "Diminished";
    if (diff === 2) return "Doubly Augmented";
    if (diff === -2) return "Doubly Diminished";
  } else {
    if (diff === 0) return "Major";
    if (diff === -1) return "Minor";
    if (diff === 1) return "Augmented";
    if (diff === -2) return "Diminished";
    if (diff === 2) return "Doubly Augmented";
  }
  return diff > 0 ? "Augmented" : "Diminished";
}

const SHORT = { Perfect: "P", Major: "M", Minor: "m", Augmented: "A", Diminished: "d", "Doubly Augmented": "AA", "Doubly Diminished": "dd" };

/**
 * Describe the interval from note `a` up to note `b`.
 * @returns {{ name, semitones, number, quality, short }}
 */
export function getInterval(a, b) {
  const na = parseNote(a);
  const nb = parseNote(b);

  const letterDist = ((letterIndex(nb.letter) - letterIndex(na.letter)) % 7 + 7) % 7;

  const midiA = toMidi(na);
  const midiB = toMidi(nb);
  const haveOctaves = midiA != null && midiB != null;

  // Semitones: absolute if both notes have octaves, else within one octave.
  let semitones;
  let number;
  if (haveOctaves) {
    semitones = midiB - midiA;
    const octaveSpan = Math.floor((letterIndex(nb.letter) - letterIndex(na.letter) + (nb.octave - na.octave) * 7) / 7);
    number = letterDist + 1 + octaveSpan * 7;
  } else {
    semitones = ((pitchClass(nb) - pitchClass(na)) % 12 + 12) % 12;
    number = letterDist + 1;
  }

  const simpleNumber = ((number - 1) % 7) + 1;
  const reference = REFERENCE[simpleNumber] + (number > 7 ? 12 * Math.floor((number - 1) / 7) : 0);
  const diff = semitones - reference;
  const quality = qualityFor(simpleNumber === 1 && number > 7 ? 8 : simpleNumber, diff);

  const numberName = number === 8 ? "Octave" : NUMBER_NAMES[simpleNumber] || `${number}th`;
  return {
    name: `${quality} ${numberName}`,
    semitones,
    number,
    quality,
    short: `${SHORT[quality] || "?"}${number}`
  };
}

/** Semitone distance between two pitch classes, ascending (0-11). */
export function semitonesBetween(a, b) {
  return ((pitchClass(b) - pitchClass(a)) % 12 + 12) % 12;
}
