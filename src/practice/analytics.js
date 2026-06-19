/**
 * Practice analytics — aggregate stats persisted via the shared Storage layer
 * (the "practice" IndexedDB store, key "analytics"). No separate persistence.
 *
 * The merge is a pure function so it can be unit-tested without IndexedDB.
 */

export const EMPTY_ANALYTICS = {
  totalSessions: 0,
  totalPracticeMs: 0,
  bestStreak: 0,
  totalAttempts: 0,
  totalCorrect: 0,
  byType: {},      // trainer -> { attempts, correct, bestStreak }
  categories: {},  // "chord:minor7" -> { attempts, correct }
  history: []      // recent session summaries (capped)
};

const HISTORY_CAP = 50;

export function mergeAnalytics(data, summary) {
  const next = {
    ...EMPTY_ANALYTICS,
    ...data,
    byType: { ...(data.byType || {}) },
    categories: { ...(data.categories || {}) },
    history: [...(data.history || [])]
  };

  next.totalSessions += 1;
  next.totalPracticeMs += summary.durationMs || 0;
  next.totalAttempts += summary.attempts || 0;
  next.totalCorrect += summary.correct || 0;
  next.bestStreak = Math.max(next.bestStreak, summary.bestStreak || 0);

  const t = next.byType[summary.trainer] || { attempts: 0, correct: 0, bestStreak: 0 };
  t.attempts += summary.attempts || 0;
  t.correct += summary.correct || 0;
  t.bestStreak = Math.max(t.bestStreak, summary.bestStreak || 0);
  next.byType[summary.trainer] = t;

  Object.entries(summary.categories || {}).forEach(([key, val]) => {
    const c = next.categories[key] || { attempts: 0, correct: 0, totalMs: 0 };
    c.attempts += val.attempts;
    c.correct += val.correct;
    c.totalMs += val.totalMs || 0;
    next.categories[key] = c;
  });

  next.history.unshift({
    at: summary.at,
    trainer: summary.trainer,
    level: summary.level,
    accuracy: summary.accuracy,
    score: summary.score,
    attempts: summary.attempts,
    bestStreak: summary.bestStreak,
    durationMs: summary.durationMs
  });
  next.history = next.history.slice(0, HISTORY_CAP);
  return next;
}

export function derivedStats(data) {
  return {
    avgAccuracy: data.totalAttempts ? data.totalCorrect / data.totalAttempts : 0,
    totalPracticeMin: Math.round((data.totalPracticeMs || 0) / 60000)
  };
}

export class Analytics {
  constructor(storage) {
    this.storage = storage;
    this.data = { ...EMPTY_ANALYTICS };
  }

  async load() {
    const stored = await this.storage.get("practice", "analytics");
    this.data = stored ? { ...EMPTY_ANALYTICS, ...stored } : { ...EMPTY_ANALYTICS };
    return this.data;
  }

  async recordSession(summary) {
    this.data = mergeAnalytics(this.data, summary);
    await this.storage.put("practice", "analytics", this.data);
    return this.data;
  }
}
