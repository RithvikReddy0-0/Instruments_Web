/**
 * Practice profile — the Energy Arena.
 *
 * The 24 nodes reorganize into 4 concentric rings (an arena). Growth becomes
 * geometry: a ring of light ripples OUTWARD through the levels (progress made
 * visible), while a runner sweeps the outer ring leaving a glowing trail
 * (streaks become trails). Emotion: growth. Signal Mint.
 */
import * as THREE from "three";

const RINGS = 4;
const PER = 6;
const ringOf = (i) => Math.floor(i / PER);
const kOf = (i) => i % PER;
const radius = (r) => 2.0 + r * 1.5;
const ang = (i) => (kOf(i) / PER) * Math.PI * 2 + ringOf(i) * 0.4;

const links = [];
for (let i = 0; i < RINGS * PER; i += 1) {
  const r = ringOf(i); const k = kOf(i);
  links.push([i, r * PER + ((k + 1) % PER)]); // ring arc
  if (r > 0) links.push([i, i - PER]);         // radial spoke (growth path)
}

export const practiceProfile = {
  id: "practice",
  accent: new THREE.Color(0x72f1b8),
  coreColor: new THREE.Color(0x72f1b8),
  core: 0.5,
  layout(i) {
    const r = ringOf(i);
    return [Math.cos(ang(i)) * radius(r), Math.sin(ang(i)) * radius(r), r * 0.15 - 0.4];
  },
  behavior(ctx, dt, e, presence, t) {
    const ripple = (t * 0.7) % (RINGS + 1.2);     // expanding ring of progress
    const head = (t * 0.95) % PER;                 // runner around the outer ring
    for (let i = 0; i < ctx.N; i += 1) {
      const r = ringOf(i); const k = kOf(i);
      const grow = Math.exp(-((r - ripple) * (r - ripple)) * 1.4) * (0.6 + e.mid);
      let trail = 0;
      if (r === RINGS - 1) {
        let d = Math.abs(k - head); d = Math.min(d, PER - d);
        trail = Math.exp(-d * d * 1.1) * (0.9 + e.treble);
      }
      ctx.boost[i] += (grow + trail) * presence;
    }
  }
};
