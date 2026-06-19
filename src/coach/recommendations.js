/**
 * Recommendation Engine v2 + Practice Plan generator — pure.
 *
 * Builds on the practice rule engine but adds prioritization, trend awareness,
 * and mandatory explainability: every recommendation has an evidence-based
 * `reason`. Anything that can't justify itself from user data is not produced.
 *
 * Replaceable by ML: keep rankRecommendations()/generatePracticePlan() shapes.
 */

import { TRAINER_LABELS } from "./analysis.js";

const pct = (n) => `${Math.round(n * 100)}%`;

export function rankRecommendations({ weaknesses = [], trends = { byTrainer: {} }, analysis = {} }) {
  const recs = [];

  // 1) Weakness-driven (already evidence-bearing, already prioritized).
  weaknesses.forEach((w) => {
    recs.push({
      id: `rec-${w.key}`,
      title: `${TRAINER_LABELS[w.trainer] || w.trainer} Trainer · Level ${w.level}`,
      action: { trainer: w.trainer, level: w.level },
      reason: w.reason,
      priority: w.priority,
      skill: w.label
    });
  });

  // 2) Trend-driven: a trainer slipping even if not yet "weak".
  Object.entries(trends.byTrainer || {}).forEach(([t, tr]) => {
    if (tr.direction === "down" && tr.delta <= -0.08 && !recs.some((r) => r.action.trainer === t)) {
      recs.push({
        id: `rec-trend-${t}`,
        title: `${TRAINER_LABELS[t] || t} Trainer · refresher`,
        action: { trainer: t, level: 1 },
        reason: `Your ${TRAINER_LABELS[t] || t} accuracy dropped ${pct(-tr.delta)} recently (${pct(tr.previous)} → ${pct(tr.current)}).`,
        priority: 0.5 + (-tr.delta),
        skill: TRAINER_LABELS[t]
      });
    }
  });

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

/**
 * Daily practice plan that adapts to weaknesses: weaker skills get more time.
 * Falls back to a balanced breadth plan when there are no clear weaknesses.
 */
export function generatePracticePlan({ weaknesses = [], analysis = {} }, { minutes = 15 } = {}) {
  const items = [];
  const top = weaknesses.slice(0, 3);

  if (top.length) {
    const weights = top.map((_, i) => top.length - i); // 3,2,1…
    const totalW = weights.reduce((a, b) => a + b, 0);
    top.forEach((w, i) => {
      items.push({
        trainer: w.trainer,
        level: w.level,
        minutes: Math.max(3, Math.round((minutes * weights[i]) / totalW)),
        skill: w.label,
        reason: w.reason
      });
    });
  } else {
    // No weaknesses yet — keep breadth across foundational skills.
    const least = (analysis.leastPracticed || []).slice(0, 3);
    const fallback = least.length ? least.map((c) => ({ trainer: c.trainer, level: c.level })) : [
      { trainer: "note", level: 1 }, { trainer: "chord", level: 1 }, { trainer: "rhythm", level: 1 }
    ];
    fallback.forEach((f) => items.push({
      trainer: f.trainer, level: f.level,
      minutes: Math.max(3, Math.round(minutes / fallback.length)),
      skill: TRAINER_LABELS[f.trainer],
      reason: "Maintain breadth and keep your streak alive."
    }));
  }

  return { items, totalMinutes: items.reduce((s, i) => s + i.minutes, 0) };
}
