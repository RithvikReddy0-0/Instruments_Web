/**
 * Strength detection — pure. Strengths are categories well above the user's own
 * average with enough attempts to trust. Every strength carries a confidence and
 * a data-derived reason (no black box).
 */

import { sampleConfidence } from "./analysis.js";

const pct = (n) => `${Math.round(n * 100)}%`;

export function detectStrengths(analysis, { minAttempts = 4, floor = 0.85 } = {}) {
  const avgAcc = analysis.overallAccuracy;
  return analysis.categories
    .filter((c) => c.attempts >= minAttempts && c.accuracy >= floor && c.accuracy >= avgAcc)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5)
    .map((c) => ({
      key: c.key,
      trainer: c.trainer,
      label: c.displayLabel,
      accuracy: c.accuracy,
      attempts: c.attempts,
      confidence: sampleConfidence(c.attempts),
      reason: `${pct(c.accuracy)} accuracy across ${c.attempts} attempts.`
    }));
}
