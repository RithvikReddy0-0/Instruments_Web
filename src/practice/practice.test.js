import { describe, it, expect } from "vitest";
import { TheoryEngine } from "../theory/theory-engine.js";
import { generateExercise, validateAnswer, scoreRhythm, TRAINERS } from "./exercises.js";
import { Scorer, pointsFor } from "./scoring.js";
import { mergeAnalytics, EMPTY_ANALYTICS, derivedStats } from "./analytics.js";
import { getRecommendations } from "./recommendations.js";

const theory = new TheoryEngine();

describe("exercise generation", () => {
  it("generates each trainer with required fields", () => {
    for (const trainer of Object.keys(TRAINERS)) {
      const ex = generateExercise(trainer, 1, theory);
      expect(ex.trainer).toBe(trainer);
      expect(ex.prompt.title).toBeTruthy();
      expect(ex.category).toContain(`${trainer === "rhythm" ? "rhythm" : trainer}:`);
    }
  });

  it("interval identify exercises carry a correct answer among the choices", () => {
    const ex = generateExercise("interval", 1, theory);
    expect(ex.inputMode).toBe("choice");
    expect(ex.choices).toContain(ex.answer);
    expect(ex.choices.length).toBe(4);
  });
});

describe("answer validation (uses TheoryEngine + detection)", () => {
  it("note: enharmonic-aware pitch match", () => {
    const ex = { inputMode: "note", target: "C#" };
    expect(validateAnswer(ex, "C#4", theory).correct).toBe(true);
    expect(validateAnswer(ex, "Db3", theory).correct).toBe(true); // enharmonic
    expect(validateAnswer(ex, "D4", theory).correct).toBe(false);
  });

  it("chord: validated via detectChord", () => {
    const ex = { inputMode: "chord", target: { root: "C", type: "major" } };
    expect(validateAnswer(ex, ["C4", "E4", "G4"], theory).correct).toBe(true);
    expect(validateAnswer(ex, ["C4", "Eb4", "G4"], theory).correct).toBe(false); // minor
    const m7 = { inputMode: "chord", target: { root: "A", type: "minor7" } };
    expect(validateAnswer(m7, ["A3", "C4", "E4", "G4"], theory).correct).toBe(true);
  });

  it("scale: validated via detectScale / note set", () => {
    const ex = { inputMode: "scale", target: { root: "C", scaleType: "major" } };
    expect(validateAnswer(ex, ["C4", "D4", "E4", "F4", "G4", "A4", "B4"], theory).correct).toBe(true);
    expect(validateAnswer(ex, ["C4", "D4", "E4"], theory).correct).toBe(false); // incomplete
  });

  it("interval choice + sequence", () => {
    expect(validateAnswer({ inputMode: "choice", answer: "Perfect Fifth" }, "Perfect Fifth", theory).correct).toBe(true);
    const seq = { inputMode: "sequence", target: { root: "C", name: "Perfect Fifth" } };
    expect(validateAnswer(seq, ["C4", "G4"], theory).correct).toBe(true);
    expect(validateAnswer(seq, ["C4", "F4"], theory).correct).toBe(false);
  });
});

describe("scoring engine (shared)", () => {
  it("awards points only when correct, scaled by streak", () => {
    expect(pointsFor(false, 100, 0)).toBe(0);
    expect(pointsFor(true, 0, 1)).toBeGreaterThan(pointsFor(true, 8000, 1)); // speed bonus
    expect(pointsFor(true, 0, 5)).toBeGreaterThan(pointsFor(true, 0, 1));    // streak bonus
  });

  it("tracks streak, bestStreak, and accuracy", () => {
    const s = new Scorer();
    s.record(true, 500); s.record(true, 500); s.record(false, 500); s.record(true, 500);
    expect(s.correct).toBe(3);
    expect(s.attempts).toBe(4);
    expect(s.bestStreak).toBe(2);
    expect(s.streak).toBe(1);
    expect(s.accuracy).toBeCloseTo(0.75);
  });
});

describe("analytics aggregation", () => {
  it("merges a session summary into totals, categories, and history", () => {
    const summary = {
      at: 1, trainer: "chord", level: 2, durationMs: 60000,
      score: 800, bestStreak: 4, attempts: 8, correct: 6, accuracy: 0.75,
      categories: { "chord:minor7": { attempts: 4, correct: 2 } }
    };
    const merged = mergeAnalytics(EMPTY_ANALYTICS, summary);
    expect(merged.totalSessions).toBe(1);
    expect(merged.totalAttempts).toBe(8);
    expect(merged.totalCorrect).toBe(6);
    expect(merged.bestStreak).toBe(4);
    expect(merged.byType.chord).toMatchObject({ attempts: 8, correct: 6 });
    expect(merged.categories["chord:minor7"]).toMatchObject({ attempts: 4, correct: 2 });
    expect(merged.history).toHaveLength(1);
    expect(derivedStats(merged).avgAccuracy).toBeCloseTo(0.75);

    const merged2 = mergeAnalytics(merged, summary);
    expect(merged2.totalSessions).toBe(2);
    expect(merged2.categories["chord:minor7"]).toMatchObject({ attempts: 8, correct: 4 });
  });
});

describe("recommendations (rule-based, AI-pluggable)", () => {
  it("recommends starting when there is no history", () => {
    const recs = getRecommendations(EMPTY_ANALYTICS);
    expect(recs[0].action).toEqual({ trainer: "note", level: 1 });
  });

  it("targets a weak category", () => {
    const data = mergeAnalytics(EMPTY_ANALYTICS, {
      at: 1, trainer: "chord", level: 2, durationMs: 1000,
      score: 0, bestStreak: 1, attempts: 5, correct: 1, accuracy: 0.2,
      categories: { "chord:minor7": { attempts: 5, correct: 1 } }
    });
    const recs = getRecommendations(data);
    const weak = recs.find((r) => r.action.trainer === "chord");
    expect(weak).toBeTruthy();
    expect(weak.action.level).toBe(2); // minor7 maps to level 2
  });
});

describe("rhythm scoring", () => {
  it("counts taps within tolerance of beats", () => {
    const beats = [1, 2, 3, 4];
    const taps = [1.02, 1.98, 3.5, 4.05]; // 3rd tap is way off
    const r = scoreRhythm(taps, beats, 140);
    expect(r.hits).toBe(3);
    expect(r.accuracy).toBeCloseTo(0.75);
  });
});
