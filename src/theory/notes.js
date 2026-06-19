/**
 * Note model — the foundation of the whole theory engine.
 *
 * A note is { letter, accidental, octave } where:
 *   letter     : "C".."B" (the 7 natural letters)
 *   accidental : integer semitone offset (-2 bb, -1 b, 0, +1 #, +2 ##)
 *   octave     : integer or null (null = pitch class only, e.g. "C")
 *
 * Modeling letter + accidental separately (instead of a raw 0-11 pitch class)
 * is what makes correct enharmonic spelling possible: C# vs Db, the Bbb in a
 * C diminished-7 chord, and accurate key signatures. Chords/scales are built by
 * choosing the correct *letter* for each degree, then computing the accidental
 * needed to hit the target pitch class.
 */

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// Semitone position of each natural letter within an octave.
export const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Position of each natural letter on the circle of fifths (F=-1 .. B=5).
// Used to derive key signatures: fifths(note) = LETTER_FIFTHS[letter] + 7*accidental.
export const LETTER_FIFTHS = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

const ACCIDENTAL_MAP = { "##": 2, x: 2, "#": 1, "": 0, b: -1, bb: -2, "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 };

const NOTE_RE = /^([A-Ga-g])(##|bb|x|[#b♯♭]|𝄪|𝄫)?(-?\d+)?$/;

/** Parse "C", "F#", "Bb4", "C#-1" → { letter, accidental, octave }. */
export function parseNote(input) {
  if (input && typeof input === "object" && "letter" in input) return input;
  const match = NOTE_RE.exec(String(input).trim());
  if (!match) throw new Error(`Invalid note: "${input}"`);
  const letter = match[1].toUpperCase();
  const accidental = ACCIDENTAL_MAP[match[2] || ""] ?? 0;
  const octave = match[3] != null ? Number(match[3]) : null;
  return { letter, accidental, octave };
}

export function accidentalToString(accidental) {
  if (accidental === 0) return "";
  return accidental > 0 ? "#".repeat(accidental) : "b".repeat(-accidental);
}

/** Format a note object back to a string ("C#", "Bb4"). */
export function formatNote(note) {
  const n = parseNote(note);
  const base = `${n.letter}${accidentalToString(n.accidental)}`;
  return n.octave == null ? base : `${base}${n.octave}`;
}

/** Pitch class 0-11 (C=0). Accepts a note object or string. */
export function pitchClass(note) {
  const n = parseNote(note);
  return ((LETTER_PC[n.letter] + n.accidental) % 12 + 12) % 12;
}

/** Absolute MIDI number, or null if the note has no octave. (C4 = 60.) */
export function toMidi(note) {
  const n = parseNote(note);
  if (n.octave == null) return null;
  return (n.octave + 1) * 12 + pitchClass(n);
}

export function letterIndex(letter) {
  return LETTERS.indexOf(letter);
}

/** Step `steps` letters from a starting letter; returns { letter, octaveShift }. */
export function stepLetter(letter, steps) {
  const raw = letterIndex(letter) + steps;
  const idx = ((raw % 7) + 7) % 7;
  return { letter: LETTERS[idx], octaveShift: Math.floor(raw / 7) };
}

/**
 * Given a letter and a desired pitch class, return the accidental that spells
 * that pitch class on that letter (range -6..+6, but musical input stays ±2).
 */
export function accidentalFor(letter, targetPc) {
  const base = LETTER_PC[letter];
  let diff = ((targetPc - base) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  return diff;
}

/**
 * Build a correctly-spelled note from a root, a diatonic letter step, and a
 * target semitone offset above the root. The heart of chord/scale generation.
 */
export function spellNote(root, letterStep, semitoneOffset) {
  const r = parseNote(root);
  const rootPc = pitchClass(r);
  const { letter, octaveShift } = stepLetter(r.letter, letterStep);
  const targetPc = (rootPc + semitoneOffset) % 12;
  const accidental = accidentalFor(letter, targetPc);
  let octave = r.octave;
  if (octave != null) {
    // Track octave across the whole interval, not just the letter wrap.
    const absStart = (r.octave + 1) * 12 + rootPc;
    const absTarget = absStart + semitoneOffset;
    octave = Math.floor(absTarget / 12) - 1;
    void octaveShift;
  }
  return { letter, accidental, octave };
}

/** Do two notes share a pitch class (enharmonic equivalence)? */
export function enharmonicEqual(a, b) {
  return pitchClass(a) === pitchClass(b);
}

/** Normalize any name/object to a canonical pitch-class-only string. */
export function noteName(note) {
  const n = parseNote(note);
  return `${n.letter}${accidentalToString(n.accidental)}`;
}
