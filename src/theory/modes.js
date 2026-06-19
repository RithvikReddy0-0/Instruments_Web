/**
 * Diatonic modes.
 *
 * The seven modes are rotations of the major scale. This module reuses the
 * scale formulas and adds the "modes of a key" relationship that Scale Explorer
 * and the AI coach will need (every mode that shares a parent major key).
 */

import { getScale, getScaleInfo } from "./scales.js";

// Modes in order of the scale degree they're built on within a major key.
export const MODE_ORDER = [
  "major",       // I  (Ionian)
  "dorian",      // ii
  "phrygian",    // iii
  "lydian",      // IV
  "mixolydian",  // V
  "aeolian",     // vi (natural minor)
  "locrian"      // vii
];

export const MODE_LABELS = {
  major: "Ionian", dorian: "Dorian", phrygian: "Phrygian", lydian: "Lydian",
  mixolydian: "Mixolydian", aeolian: "Aeolian", locrian: "Locrian"
};

export function getMode(root, mode) {
  return getScale(root, mode);
}

/**
 * All seven modes that share the major key of `root`, each built on its scale
 * degree. modesOfKey("C") → Ionian on C, Dorian on D, Phrygian on E, …
 */
export function modesOfKey(root) {
  const parent = getScale(root, "major"); // the 7 tonics
  return MODE_ORDER.map((mode, degree) => ({
    degree: degree + 1,
    mode,
    label: MODE_LABELS[mode],
    ...getScaleInfo(parent[degree], mode)
  }));
}
