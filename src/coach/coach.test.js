import { describe, it, expect } from "vitest";
import { analyzeSkills, buildSkillGraph, sampleConfidence } from "./analysis.js";
import { computeTrends, windowDelta } from "./trends.js";
import { detectStrengths } from "./strengths.js";
import { detectWeaknesses } from "./weaknesses.js";
import { rankRecommendations, generatePracticePlan } from "./recommendations.js";
import { buildInsights } from "./insights.js";

// Synthetic analytics: strong on major chords, weak on minor7 (lots of attempts).
const analytics = {
  totalSessions: 6,
  totalPracticeMs: 600000,
  bestStreak: 8,
  totalAttempts: 60,
  totalCorrect: 45, // 75% overall
  byType: {
    chord: { attempts: 40, correct: 28, bestStreak: 8 },
    scale: { attempts: 20, correct: 17, bestStreak: 5 }
  },
  categories: {
    "chord:major": { attempts: 20, correct: 19, totalMs: 20000 },     // 95%
    "chord:minor7": { attempts: 18, correct: 8, totalMs: 36000 },     // 44% weak, slow
    "scale:dorian": { attempts: 12, correct: 5, totalMs: 18000 },     // 42% weak
    "scale:major": { attempts: 8, correct: 8, totalMs: 6000 }         // 100% strong, fast
  },
  history: [
    { trainer: "chord", accuracy: 0.8, at: 6 },
    { trainer: "chord", accuracy: 0.7, at: 5 },
    { trainer: "chord", accuracy: 0.6, at: 4 },
    { trainer: "scale", accuracy: 0.5, at: 3 },
    { trainer: "scale", accuracy: 0.45, at: 2 },
    { trainer: "scale", accuracy: 0.4, at: 1 }
  ]
};

describe("skill analysis", () => {
  const a = analyzeSkills(analytics);
  it("ranks strongest/weakest by accuracy", () => {
    expect(a.overallAccuracy).toBeCloseTo(0.75);
    expect(a.strongest[0].key).toBe("scale:major");
    expect(a.weakest[0].accuracy).toBeLessThan(0.5);
  });
  it("ranks fastest/slowest by response time", () => {
    expect(a.fastest[0].key).toBe("scale:major");   // 750ms/answer
    expect(a.slowest[0].avgResponse).toBeGreaterThan(a.fastest[0].avgResponse);
  });
  it("builds a skill graph with score/confidence/trend", () => {
    const graph = buildSkillGraph(a, computeTrends(analytics.history, []));
    const chord = graph.find((g) => g.skill === "chord");
    expect(chord.score).toBe(70); // 28/40
    expect(chord.confidence).toBeGreaterThan(0);
  });
});

describe("trend analysis", () => {
  it("windowDelta compares newer vs older half", () => {
    expect(windowDelta([0.4, 0.6]).direction).toBe("up");
    expect(windowDelta([0.8, 0.4]).direction).toBe("down");
    expect(windowDelta([0.5, 0.5]).direction).toBe("flat");
  });
  it("computes per-trainer trends from history", () => {
    const t = computeTrends(analytics.history, []);
    expect(t.byTrainer.chord.direction).toBe("up");   // 0.6,0.7,0.8 chrono
    expect(t.byTrainer.scale.direction).toBe("up");   // 0.4,0.45,0.5 chrono
  });
});

describe("strength & weakness detection (explainable)", () => {
  const a = analyzeSkills(analytics);
  it("detects strengths above the user's average with confidence + reason", () => {
    const s = detectStrengths(a);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].reason).toMatch(/accuracy across \d+ attempts/);
    expect(s.every((x) => x.confidence > 0)).toBe(true);
  });
  it("detects weaknesses with evidence citing the average", () => {
    const w = detectWeaknesses(a);
    const minor7 = w.find((x) => x.key === "chord:minor7");
    expect(minor7).toBeTruthy();
    expect(minor7.reason).toMatch(/below your average of 75%/);
    // higher-volume weakness should outrank lower-volume one
    expect(w[0].priority).toBeGreaterThanOrEqual(w[w.length - 1].priority);
  });
  it("confidence grows with sample size", () => {
    expect(sampleConfidence(12)).toBeGreaterThan(sampleConfidence(3));
  });
});

describe("recommendations v2", () => {
  const a = analyzeSkills(analytics);
  const w = detectWeaknesses(a);
  const t = computeTrends(analytics.history, []);
  it("are prioritized, actionable, and explainable", () => {
    const recs = rankRecommendations({ weaknesses: w, trends: t, analysis: a });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].action).toHaveProperty("trainer");
    expect(recs[0].action).toHaveProperty("level");
    expect(recs[0].reason).toBeTruthy();
    // minor7 (level 2) should be the top weakness-driven rec
    const minor7 = recs.find((r) => r.skill?.toLowerCase().includes("minor 7"));
    expect(minor7.action.level).toBe(2);
  });
});

describe("practice plan generator", () => {
  it("adapts time to weaknesses and totals correctly", () => {
    const a = analyzeSkills(analytics);
    const w = detectWeaknesses(a);
    const plan = generatePracticePlan({ weaknesses: w, analysis: a }, { minutes: 15 });
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.totalMinutes).toBe(plan.items.reduce((s, i) => s + i.minutes, 0));
    expect(plan.items[0].minutes).toBeGreaterThanOrEqual(plan.items[plan.items.length - 1].minutes);
    expect(plan.items[0].reason).toBeTruthy();
  });
  it("falls back to a breadth plan when there are no weaknesses", () => {
    const strong = analyzeSkills({ totalAttempts: 10, totalCorrect: 10, categories: { "note:C": { attempts: 10, correct: 10, totalMs: 5000 } }, byType: {}, history: [] });
    const plan = generatePracticePlan({ weaknesses: [], analysis: strong }, { minutes: 12 });
    expect(plan.items.length).toBeGreaterThan(0);
  });
});

describe("insights", () => {
  it("answers the product questions from data", () => {
    const a = analyzeSkills(analytics);
    const t = computeTrends(analytics.history, []);
    const ins = buildInsights({ analysis: a, trends: t, strengths: detectStrengths(a), weaknesses: detectWeaknesses(a) });
    expect(ins.find((i) => i.question.includes("good at")).answer).toBeTruthy();
    expect(ins.find((i) => i.question.includes("struggling")).answer).toMatch(/%/);
  });
});
