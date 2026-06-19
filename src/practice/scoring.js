/**
 * Scoring engine — shared by every trainer.
 *
 * points = 100 × speedBonus × streakMultiplier
 *   speedBonus      : faster answers score more (floor 0.4)
 *   streakMultiplier: rewards consecutive correct answers (caps at ×2)
 */

const BASE = 100;
const MAX_RESPONSE = 8000; // ms beyond which speed bonus bottoms out

export function pointsFor(correct, responseMs, streakAfter) {
  if (!correct) return 0;
  const speed = Math.max(0.4, 1 - Math.min(responseMs, MAX_RESPONSE) / MAX_RESPONSE);
  const streakMult = 1 + Math.min(streakAfter, 10) * 0.1;
  return Math.round(BASE * speed * streakMult);
}

export class Scorer {
  constructor() { this.reset(); }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.attempts = 0;
    this.correct = 0;
    this.responseTimes = [];
  }

  record(correct, responseMs = 0) {
    this.attempts += 1;
    if (correct) {
      this.correct += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.responseTimes.push(responseMs);
    } else {
      this.streak = 0;
    }
    const points = pointsFor(correct, responseMs, this.streak);
    this.score += points;
    return { points, streak: this.streak, correct };
  }

  get accuracy() { return this.attempts ? this.correct / this.attempts : 0; }
  get avgResponse() {
    return this.responseTimes.length
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;
  }

  summary() {
    return {
      score: this.score,
      bestStreak: this.bestStreak,
      attempts: this.attempts,
      correct: this.correct,
      accuracy: this.accuracy,
      avgResponse: this.avgResponse
    };
  }
}
