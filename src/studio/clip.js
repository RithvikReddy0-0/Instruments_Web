/**
 * Pure clip model and edit operations.
 *
 * A clip is the single source of musical data for the studio. Every edit op is
 * pure (returns a new notes array), which makes editing testable without a
 * canvas and lets StateManager give us undo/redo for free.
 *
 * note = { id, midi, start, duration, velocity, instrument }
 *   start / duration in seconds, midi 0-127, velocity 0-1.
 */

const MIN_DURATION = 0.05;
let counter = 0;

export function uid(prefix = "n") {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createClip(overrides = {}) {
  const now = Date.now();
  return {
    id: uid("clip"),
    name: "Untitled session",
    bpm: 120,
    instrument: "piano",
    notes: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function addNote(notes, note) {
  return [...notes, { id: uid(), velocity: 0.78, instrument: "piano", ...note, duration: Math.max(MIN_DURATION, note.duration ?? 0.5) }];
}

export function updateNote(notes, id, patch) {
  return notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
}

export function moveNote(notes, id, deltaStart, deltaMidi) {
  return notes.map((n) => {
    if (n.id !== id) return n;
    return {
      ...n,
      start: Math.max(0, n.start + deltaStart),
      midi: Math.max(0, Math.min(127, n.midi + deltaMidi))
    };
  });
}

export function resizeNote(notes, id, duration) {
  return notes.map((n) => (n.id === id ? { ...n, duration: Math.max(MIN_DURATION, duration) } : n));
}

export function deleteNotes(notes, ids) {
  const set = new Set(Array.isArray(ids) ? ids : [ids]);
  return notes.filter((n) => !set.has(n.id));
}

export function clipDuration(clip) {
  return (clip.notes || []).reduce((max, n) => Math.max(max, n.start + n.duration), 0);
}

export function pitchRange(clip) {
  if (!clip.notes || clip.notes.length === 0) return { min: 48, max: 72 };
  let min = Infinity;
  let max = -Infinity;
  clip.notes.forEach((n) => { min = Math.min(min, n.midi); max = Math.max(max, n.midi); });
  return { min, max };
}

export { MIN_DURATION };
