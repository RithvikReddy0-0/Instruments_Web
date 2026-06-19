/**
 * Trend analysis — improvement over time, derived from session history and
 * daily snapshots. Pure. A future predictive model can replace computeTrends()
 * while keeping the { current, previous, delta, direction } shape.
 */

const FLAT_BAND = 0.02;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Compare the newer half of a sequence to the older half. */
export function windowDelta(seq) {
  if (!seq.length) return { current: 0, previous: 0, delta: 0, direction: "flat", samples: 0 };
  if (seq.length === 1) return { current: seq[0], previous: seq[0], delta: 0, direction: "flat", samples: 1 };
  const half = Math.floor(seq.length / 2);
  const previous = avg(seq.slice(0, half));
  const current = avg(seq.slice(half));
  const delta = current - previous;
  const direction = delta > FLAT_BAND ? "up" : delta < -FLAT_BAND ? "down" : "flat";
  return { current, previous, delta, direction, samples: seq.length };
}

function dailyTrend(snapshots) {
  if (!snapshots || snapshots.length < 2) {
    const last = snapshots?.[snapshots.length - 1];
    return { current: last?.accuracy || 0, previous: last?.accuracy || 0, delta: 0, direction: "flat", days: snapshots?.length || 0 };
  }
  const first = snapshots[0].accuracy;
  const last = snapshots[snapshots.length - 1].accuracy;
  const delta = last - first;
  return {
    current: last, previous: first, delta,
    direction: delta > FLAT_BAND ? "up" : delta < -FLAT_BAND ? "down" : "flat",
    days: snapshots.length
  };
}

const TRAINERS = ["note", "interval", "chord", "scale", "rhythm"];

/**
 * @param history  newest-first session summaries ({ trainer, accuracy, at })
 * @param snapshots chronological daily cumulative snapshots ({ date, accuracy })
 */
export function computeTrends(history = [], snapshots = []) {
  const chrono = [...history].reverse(); // oldest → newest
  const overall = windowDelta(chrono.map((h) => h.accuracy));

  const byTrainer = {};
  TRAINERS.forEach((t) => {
    const seq = chrono.filter((h) => h.trainer === t).map((h) => h.accuracy);
    if (seq.length >= 2) byTrainer[t] = windowDelta(seq);
  });

  return { overall, byTrainer, daily: dailyTrend(snapshots), sessions: chrono.length };
}
