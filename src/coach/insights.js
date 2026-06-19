/**
 * Insights — templated, data-derived answers to the questions the coach exists
 * to answer. NOT an LLM and NOT generic motivation: every sentence is built from
 * the user's own numbers, and questions with no data say so honestly.
 */

const pct = (n) => `${Math.round(n * 100)}%`;
const dirWord = { up: "improving", down: "slipping", flat: "holding steady" };

export function buildInsights({ analysis, trends, strengths, weaknesses }) {
  const out = [];

  out.push({
    question: "What am I good at?",
    answer: strengths.length
      ? `${strengths.slice(0, 3).map((s) => s.label).join(", ")} — strongest is ${strengths[0].label} at ${pct(strengths[0].accuracy)}.`
      : "Not enough data yet. Keep practicing to reveal your strengths."
  });

  out.push({
    question: "What am I struggling with?",
    answer: weaknesses.length
      ? `${weaknesses.slice(0, 3).map((w) => w.label).join(", ")} — ${weaknesses[0].label} is lowest at ${pct(weaknesses[0].accuracy)}.`
      : "Nothing stands out as a weakness right now — nice work."
  });

  const o = trends.overall;
  out.push({
    question: "Am I improving?",
    answer: o.samples >= 2
      ? `Your accuracy is ${dirWord[o.direction]}: ${pct(o.previous)} → ${pct(o.current)} (${o.delta >= 0 ? "+" : ""}${pct(o.delta)}) over your last ${o.samples} sessions.`
      : "Complete a few more sessions to see your trend."
  });

  out.push({
    question: "What should I focus on?",
    answer: weaknesses.length
      ? `Prioritise ${weaknesses[0].label}. ${weaknesses[0].reason}`
      : analysis.leastPracticed?.length
        ? `Broaden your skills — you've barely touched ${analysis.leastPracticed[0].displayLabel}.`
        : "Start with the Note Trainer to build a baseline."
  });

  return out;
}
