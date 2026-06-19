/**
 * Skill Analysis Engine — pure, UI-free.
 *
 * Consumes the practice analytics aggregate and derives structured skill data:
 * strongest/weakest/fastest/slowest/most-/least-practiced categories, per-trainer
 * stats, and a skill-graph model. No UI, no persistence — just analysis.
 *
 * Replaceable by an ML model: keep the analyzeSkills(analytics) → report shape.
 */

import { LABELS } from "../practice/recommendations.js";
import { levelForCategory } from "../practice/recommendations.js";

const MIN_ATTEMPTS = 3;

const TRAINER_LABELS = {
  note: "Notes", interval: "Intervals", chord: "Chords", scale: "Scales", rhythm: "Rhythm"
};
const INTERVAL_SHORT = (label) => label; // interval labels are already human-readable

export function categoryLabel(trainer, label) {
  if (trainer === "chord") return `${LABELS.chord?.[label] || label} chords`;
  if (trainer === "scale") return `${LABELS.scale?.[label] || label}`;
  if (trainer === "interval") return INTERVAL_SHORT(label);
  if (trainer === "note") return `Note ${label}`;
  if (trainer === "rhythm") return `${label} BPM rhythm`;
  return label;
}

function toCategory([key, v]) {
  const [trainer, ...rest] = key.split(":");
  const label = rest.join(":");
  return {
    key,
    trainer,
    label,
    displayLabel: categoryLabel(trainer, label),
    level: levelForCategory(key),
    attempts: v.attempts || 0,
    correct: v.correct || 0,
    accuracy: v.attempts ? v.correct / v.attempts : 0,
    avgResponse: v.correct ? (v.totalMs || 0) / v.correct : 0
  };
}

function trainerStats(analytics) {
  const out = {};
  Object.entries(analytics.byType || {}).forEach(([t, v]) => {
    out[t] = {
      trainer: t,
      label: TRAINER_LABELS[t] || t,
      attempts: v.attempts || 0,
      correct: v.correct || 0,
      accuracy: v.attempts ? v.correct / v.attempts : 0,
      bestStreak: v.bestStreak || 0
    };
  });
  return out;
}

export function analyzeSkills(analytics) {
  const categories = Object.entries(analytics.categories || {}).map(toCategory);
  const ranked = categories.filter((c) => c.attempts >= MIN_ATTEMPTS);
  const withResponse = ranked.filter((c) => c.avgResponse > 0);

  return {
    overallAccuracy: analytics.totalAttempts ? analytics.totalCorrect / analytics.totalAttempts : 0,
    totalAttempts: analytics.totalAttempts || 0,
    categories,
    strongest: [...ranked].sort((a, b) => b.accuracy - a.accuracy).slice(0, 5),
    weakest: [...ranked].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5),
    fastest: [...withResponse].sort((a, b) => a.avgResponse - b.avgResponse).slice(0, 5),
    slowest: [...withResponse].sort((a, b) => b.avgResponse - a.avgResponse).slice(0, 5),
    mostPracticed: [...categories].sort((a, b) => b.attempts - a.attempts).slice(0, 5),
    leastPracticed: [...categories].sort((a, b) => a.attempts - b.attempts).slice(0, 5),
    byTrainer: trainerStats(analytics)
  };
}

/** Confidence purely from sample size (more attempts → more trustworthy). */
export function sampleConfidence(attempts) {
  return Math.min(1, attempts / 12);
}

/**
 * Skill-graph model: one node per trainer with score (0-100), confidence, and
 * trend direction. Feeds the radar chart + progress bars.
 */
export function buildSkillGraph(analysis, trends = { byTrainer: {} }) {
  return ["note", "interval", "chord", "scale", "rhythm"].map((t) => {
    const stat = analysis.byTrainer[t];
    const tr = trends.byTrainer?.[t];
    return {
      skill: t,
      label: TRAINER_LABELS[t],
      score: stat ? Math.round(stat.accuracy * 100) : 0,
      attempts: stat ? stat.attempts : 0,
      confidence: stat ? sampleConfidence(stat.attempts) : 0,
      trend: tr ? tr.direction : "flat",
      delta: tr ? tr.delta : 0
    };
  });
}

export { TRAINER_LABELS, MIN_ATTEMPTS };
