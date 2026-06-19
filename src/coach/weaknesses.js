/**
 * Weakness detection — pure. A weakness is a category below the user's own
 * average (and below an absolute ceiling) with enough attempts to be real. Each
 * one carries explicit evidence and a priority for ranking.
 *
 * priority = severity (how far below average) × volume (how many attempts),
 * so a 42%-over-18-attempts weakness outranks a 55%-over-4-attempts one.
 */

import { sampleConfidence } from "./analysis.js";

const pct = (n) => `${Math.round(n * 100)}%`;

export function detectWeaknesses(analysis, { minAttempts = 3, ceiling = 0.7 } = {}) {
  const avgAcc = analysis.overallAccuracy || 0;
  const threshold = Math.min(ceiling, avgAcc);

  return analysis.categories
    .filter((c) => c.attempts >= minAttempts && c.accuracy < threshold)
    .map((c) => {
      const severity = Math.max(0, avgAcc - c.accuracy) + (ceiling - c.accuracy) * 0.5;
      return {
        key: c.key,
        trainer: c.trainer,
        label: c.displayLabel,
        level: c.level,
        accuracy: c.accuracy,
        attempts: c.attempts,
        confidence: sampleConfidence(c.attempts),
        priority: severity * Math.min(c.attempts, 20),
        reason: `Accuracy is ${pct(c.accuracy)} across ${c.attempts} attempts, below your average of ${pct(avgAcc)}.`
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}
