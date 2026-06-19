/**
 * PracticeSession — a single run of exercises.
 *
 * Wraps a Scorer and tallies per-category results so analytics can later spot
 * weaknesses. Pure aside from timing; no persistence here (analytics owns that).
 */

import { Scorer } from "./scoring.js";

export class PracticeSession {
  constructor({ trainer, level, count }) {
    this.trainer = trainer;
    this.level = level;
    this.count = count;
    this.scorer = new Scorer();
    this.categories = {}; // key -> { attempts, correct }
    this.startedAt = Date.now();
  }

  record({ category, correct, responseMs }) {
    const result = this.scorer.record(correct, responseMs);
    if (category) {
      const c = this.categories[category] || { attempts: 0, correct: 0, totalMs: 0 };
      c.attempts += 1;
      if (correct) { c.correct += 1; c.totalMs += responseMs || 0; } // response time on correct answers
      this.categories[category] = c;
    }
    return result;
  }

  summary() {
    return {
      at: Date.now(),
      trainer: this.trainer,
      level: this.level,
      durationMs: Date.now() - this.startedAt,
      ...this.scorer.summary(),
      categories: this.categories
    };
  }
}
