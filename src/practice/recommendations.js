/**
 * Rule-based recommendation engine (no AI yet).
 *
 * Pure: getRecommendations(analytics) → [{ id, title, detail, action:{trainer,level} }].
 * The stable signature is the extension point — a future AI recommender can wrap
 * or replace this function without any caller changes.
 */

import { derivedStats } from "./analytics.js";

const MIN_ATTEMPTS = 3;
const WEAK_THRESHOLD = 0.6;
const STRONG_THRESHOLD = 0.9;

export const CHORD_LEVEL = {
  major: 1, minor: 1,
  dominant7: 2, major7: 2, minor7: 2,
  diminished: 3, augmented: 3, sus2: 3, sus4: 3, halfDiminished7: 3, diminished7: 3
};
export const SCALE_LEVEL = {
  major: 1, naturalMinor: 1,
  dorian: 2, phrygian: 2, lydian: 2, mixolydian: 2, locrian: 2,
  harmonicMinor: 3, melodicMinor: 3, pentatonicMajor: 3, pentatonicMinor: 3, blues: 3
};

/** Recommended trainer level for a "trainer:label" category key. */
export function levelForCategory(key) {
  const [trainer, label] = key.split(":");
  if (trainer === "chord") return CHORD_LEVEL[label] || 1;
  if (trainer === "scale") return SCALE_LEVEL[label] || 1;
  if (trainer === "note") return 2;
  return 1;
}

export const LABELS = {
  chord: { dominant7: "Dominant 7th", major7: "Major 7th", minor7: "Minor 7th", halfDiminished7: "Half-Diminished 7th", diminished7: "Diminished 7th", diminished: "Diminished", augmented: "Augmented", sus2: "Sus2", sus4: "Sus4", major: "Major", minor: "Minor" },
  scale: { naturalMinor: "Natural Minor", harmonicMinor: "Harmonic Minor", melodicMinor: "Melodic Minor", pentatonicMajor: "Major Pentatonic", pentatonicMinor: "Minor Pentatonic", major: "Major", blues: "Blues", dorian: "Dorian", phrygian: "Phrygian", lydian: "Lydian", mixolydian: "Mixolydian", locrian: "Locrian" }
};

function recForCategory(key, stats) {
  const [trainer, label] = key.split(":");
  const acc = Math.round((stats.correct / stats.attempts) * 100);
  if (trainer === "chord") {
    const name = LABELS.chord[label] || label;
    return { id: `w-${key}`, title: `Drill ${name} chords`, detail: `Your accuracy on ${name} chords is ${acc}%.`, action: { trainer: "chord", level: CHORD_LEVEL[label] || 1 } };
  }
  if (trainer === "scale") {
    const name = LABELS.scale[label] || label;
    return { id: `w-${key}`, title: `Practice the ${name} scale`, detail: `Your accuracy on ${name} is ${acc}%.`, action: { trainer: "scale", level: SCALE_LEVEL[label] || 1 } };
  }
  if (trainer === "interval") {
    return { id: `w-${key}`, title: `Review the ${label}`, detail: `You're at ${acc}% on the ${label}.`, action: { trainer: "interval", level: 1 } };
  }
  if (trainer === "note") {
    return { id: `w-${key}`, title: `Find ${label} faster`, detail: `Note recognition for ${label} is ${acc}%.`, action: { trainer: "note", level: 2 } };
  }
  return { id: `w-${key}`, title: "Keep practicing", detail: `Accuracy ${acc}%.`, action: { trainer, level: 1 } };
}

export function getRecommendations(analytics) {
  const recs = [];

  if (!analytics.totalSessions) {
    return [{ id: "start", title: "Start with the Note Trainer", detail: "Build a foundation by naming notes on your instrument.", action: { trainer: "note", level: 1 } }];
  }

  const weak = Object.entries(analytics.categories || {})
    .filter(([, v]) => v.attempts >= MIN_ATTEMPTS && v.correct / v.attempts < WEAK_THRESHOLD)
    .sort((a, b) => (a[1].correct / a[1].attempts) - (b[1].correct / b[1].attempts));
  weak.slice(0, 3).forEach(([key, v]) => recs.push(recForCategory(key, v)));

  if (recs.length < 3) {
    const { avgAccuracy } = derivedStats(analytics);
    if (avgAccuracy >= STRONG_THRESHOLD) {
      recs.push({ id: "levelup", title: "Level up", detail: "Your accuracy is excellent — try a higher level.", action: { trainer: "chord", level: 2 } });
    } else {
      recs.push({ id: "keep", title: "Keep your streak going", detail: "Consistency beats intensity. Do a quick set.", action: { trainer: "note", level: 1 } });
    }
  }
  return recs;
}
