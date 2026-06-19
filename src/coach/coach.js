/**
 * AI Practice Coach — orchestrator + dashboard.
 *
 * Pure intelligence layer composed of analysis/trends/strengths/weaknesses/
 * recommendations/insights, all fed by the existing practice analytics in
 * IndexedDB. Recomputes when a practice session completes (bus event); its
 * "Start" buttons emit coach:start-practice so the Practice Platform launches the
 * exact session. No LLM, no chat — every line is backed by the user's data.
 */

import { EMPTY_ANALYTICS } from "../practice/analytics.js";
import { analyzeSkills, buildSkillGraph } from "./analysis.js";
import { computeTrends } from "./trends.js";
import { detectStrengths } from "./strengths.js";
import { detectWeaknesses } from "./weaknesses.js";
import { rankRecommendations, generatePracticePlan } from "./recommendations.js";
import { buildInsights } from "./insights.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const TREND_ICON = { up: "▲", down: "▼", flat: "—" };

// Progress ring (SVG). Pure visual.
function ringSVG(value, size = 88, stroke = 9) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - v);
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" role="img" aria-label="${Math.round(v * 100)}% accuracy">
      <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs>
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg><span class="ring-label">${Math.round(v * 100)}%</span></div>`;
}

// Level + XP derived purely from existing analytics (no new state/feature).
function heroSection(analytics) {
  const xp = (analytics.totalCorrect || 0) * 10;
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const base = (level - 1) ** 2 * 40;
  const next = level ** 2 * 40;
  const progress = next > base ? Math.round(((xp - base) / (next - base)) * 100) : 0;
  const acc = analytics.totalAttempts ? analytics.totalCorrect / analytics.totalAttempts : 0;
  return `<section class="coach-hero" aria-label="Level and progress">
    <div class="coach-level"><span class="coach-level-num">${level}</span><span class="coach-level-cap">Level</span></div>
    <div class="coach-xp">
      <div class="coach-xp-top"><span>${xp} XP</span><span>${next} XP</span></div>
      <span class="coach-xp-bar"><span class="coach-xp-fill" style="width:${progress}%"></span></span>
      <div class="coach-xp-top"><span>Level ${level}</span><span>Level ${level + 1}</span></div>
    </div>
    ${ringSVG(acc)}
    <div class="coach-streak"><span class="coach-streak-flame" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></span><span class="coach-streak-num">${analytics.bestStreak || 0}</span><span class="coach-streak-cap">Best streak</span></div>
  </section>`;
}

export function initCoach({ bus, state, storage, mount }) {
  async function updateSnapshot(analytics) {
    let snaps = (await storage.get("practice", "coach-snapshots")) || [];
    const date = new Date().toISOString().slice(0, 10);
    const accuracy = analytics.totalAttempts ? analytics.totalCorrect / analytics.totalAttempts : 0;
    const entry = { date, accuracy, totalAttempts: analytics.totalAttempts || 0 };
    const i = snaps.findIndex((s) => s.date === date);
    if (i >= 0) snaps[i] = entry; else snaps.push(entry);
    snaps = snaps.slice(-60);
    await storage.put("practice", "coach-snapshots", snaps);
    return snaps;
  }

  async function recompute() {
    const analytics = (await storage.get("practice", "analytics")) || { ...EMPTY_ANALYTICS };
    const snapshots = await updateSnapshot(analytics);
    const analysis = analyzeSkills(analytics);
    const trends = computeTrends(analytics.history, snapshots);
    const strengths = detectStrengths(analysis);
    const weaknesses = detectWeaknesses(analysis);
    const recommendations = rankRecommendations({ weaknesses, trends, analysis });
    const plan = generatePracticePlan({ weaknesses, analysis });
    const skillGraph = buildSkillGraph(analysis, trends);
    const insights = buildInsights({ analysis, trends, strengths, weaknesses });

    const report = { hasData: (analytics.totalSessions || 0) > 0, analytics, analysis, trends, strengths, weaknesses, recommendations, plan, skillGraph, insights };
    state.set("coach.report", report);
    render(report);
  }

  // ---- rendering ----
  function radarSVG(graph) {
    const size = 240;
    const cx = size / 2;
    const cy = size / 2;
    const R = 92;
    const n = graph.length;
    const point = (value, i) => {
      const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
      const r = (value / 100) * R;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    };
    const rings = [25, 50, 75, 100].map((lvl) => {
      const pts = graph.map((_, i) => point(lvl, i).map((v) => v.toFixed(1)).join(",")).join(" ");
      return `<polygon points="${pts}" class="coach-radar-ring" />`;
    }).join("");
    const axes = graph.map((g, i) => {
      const [x, y] = point(100, i);
      const [lx, ly] = point(118, i);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="coach-radar-axis" />
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="coach-radar-label" text-anchor="middle" dominant-baseline="middle">${esc(g.label)}</text>`;
    }).join("");
    const dataPts = graph.map((g, i) => point(g.score, i).map((v) => v.toFixed(1)).join(",")).join(" ");
    const summary = graph.map((g) => `${g.label} ${g.score}%`).join(", ");
    return `<svg viewBox="0 0 ${size} ${size}" class="coach-radar" role="img" aria-label="Skill graph: ${esc(summary)}">
      ${rings}${axes}<polygon points="${dataPts}" class="coach-radar-data" /></svg>`;
  }

  function render(report) {
    if (!report.hasData) {
      mount.innerHTML = `<div class="coach"><div class="coach-empty">
        <h3>Your coach is warming up</h3>
        <p class="coach-hint">Complete a session in the Practice Platform and your personalised analysis, strengths, weaknesses, and daily plan will appear here.</p>
      </div></div>`;
      return;
    }

    const { insights, skillGraph, strengths, weaknesses, recommendations, plan, trends } = report;

    const insightCards = insights.map((i) => `
      <div class="coach-insight"><dt>${esc(i.question)}</dt><dd>${esc(i.answer)}</dd></div>`).join("");

    const bars = skillGraph.map((g) => `
      <div class="coach-bar-row">
        <span class="coach-bar-label">${esc(g.label)} <span class="coach-trend coach-${g.trend}">${TREND_ICON[g.trend]}</span></span>
        <span class="coach-bar"><span class="coach-bar-fill" style="width:${g.score}%"></span></span>
        <span class="coach-bar-val">${g.score}% · ${pct(g.confidence)} conf</span>
      </div>`).join("");

    const strengthList = strengths.length
      ? strengths.map((s) => `<li><strong>${esc(s.label)}</strong><span>${esc(s.reason)}</span><span class="coach-conf">confidence ${pct(s.confidence)}</span></li>`).join("")
      : `<li class="coach-hint">No clear strengths yet — keep going.</li>`;

    const weaknessList = weaknesses.length
      ? weaknesses.map((w) => `<li><strong>${esc(w.label)}</strong><span>${esc(w.reason)}</span></li>`).join("")
      : `<li class="coach-hint">No weaknesses detected. Excellent consistency.</li>`;

    const recList = recommendations.length
      ? recommendations.map((r) => `
        <div class="coach-rec">
          <div class="coach-rec-body"><strong>${esc(r.title)}</strong>
            <span class="coach-why"><em>Why:</em> ${esc(r.reason)}</span></div>
          <button class="coach-start" type="button" data-trainer="${esc(r.action.trainer)}" data-level="${r.action.level}">Start</button>
        </div>`).join("")
      : `<p class="coach-hint">No recommendations — you're on track.</p>`;

    const planList = plan.items.map((p) => `
      <div class="coach-plan-item">
        <span class="coach-plan-min">${p.minutes}m</span>
        <span class="coach-plan-body"><strong>${esc(p.skill || p.trainer)}</strong><span>${esc(p.reason)}</span></span>
        <button class="coach-start coach-ghost" type="button" data-trainer="${esc(p.trainer)}" data-level="${p.level}">Start</button>
      </div>`).join("");

    const o = trends.overall;
    const progressNote = o.samples >= 2
      ? `Accuracy ${pct(o.previous)} → ${pct(o.current)} <span class="coach-trend coach-${o.direction}">${TREND_ICON[o.direction]} ${o.delta >= 0 ? "+" : ""}${pct(o.delta)}</span> over ${o.samples} sessions`
      : "Complete a few more sessions to chart your progress.";

    mount.innerHTML = `
      <div class="coach">
        ${heroSection(report.analytics)}
        <section class="coach-panel coach-insights" aria-label="Your summary">
          <h3 class="coach-subhead">Your summary</h3>
          <dl class="coach-insight-grid">${insightCards}</dl>
        </section>

        <div class="coach-cols">
          <section class="coach-panel" aria-label="Skill graph">
            <h3 class="coach-subhead">Skill graph</h3>
            <div class="coach-graph">${radarSVG(skillGraph)}<div class="coach-bars">${bars}</div></div>
          </section>
          <section class="coach-panel" aria-label="Recent progress">
            <h3 class="coach-subhead">Recent progress</h3>
            <p class="coach-progress">${progressNote}</p>
            <h4 class="coach-mini">Recommended next</h4>
            <div class="coach-recs">${recList}</div>
          </section>
        </div>

        <div class="coach-cols">
          <section class="coach-panel" aria-label="Strengths">
            <h3 class="coach-subhead">Strengths</h3>
            <ul class="coach-list">${strengthList}</ul>
          </section>
          <section class="coach-panel" aria-label="Weaknesses">
            <h3 class="coach-subhead">Focus areas</h3>
            <ul class="coach-list">${weaknessList}</ul>
          </section>
        </div>

        <section class="coach-panel" aria-label="Daily practice plan">
          <h3 class="coach-subhead">Today's plan <span class="coach-total">${plan.totalMinutes} min</span></h3>
          <div class="coach-plan">${planList}</div>
        </section>
      </div>`;
  }

  // ---- events ----
  mount.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-trainer]");
    if (!btn) return;
    bus.emit("coach:start-practice", { trainer: btn.dataset.trainer, level: Number(btn.dataset.level) || 1 });
  });

  bus.on("practice:session-complete", () => recompute());

  recompute();
  return { recompute };
}
