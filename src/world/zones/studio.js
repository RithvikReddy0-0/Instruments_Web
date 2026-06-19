/**
 * Studio profile — the Core Reactor.
 *
 * The nodes collapse onto six signal paths radiating from the central core.
 * Audio energy pulses travel OUTWARD along the paths from the reactor — a
 * reactive creation environment where sound becomes light. The core itself is
 * brass: the hardware heart of the instrument (brass = hardware only). Signal
 * paths glow cyan. Emotion: creation.
 */
import * as THREE from "three";

const SPOKES = 6;
const STEPS = 4;
const spokeOf = (i) => Math.floor(i / STEPS);
const stepOf = (i) => i % STEPS;
const ang = (s) => (s / SPOKES) * Math.PI * 2;
const radius = (st) => 1.7 + st * 1.5;

const links = [];
for (let i = 0; i < SPOKES * STEPS; i += 1) {
  const s = spokeOf(i); const st = stepOf(i);
  if (st < STEPS - 1) links.push([i, i + 1]);                 // along the signal path
  if (st === 0) links.push([i, ((s + 1) % SPOKES) * STEPS]);  // inner reactor ring
}

export const studioProfile = {
  id: "studio",
  accent: new THREE.Color(0x6ee7ff),
  coreColor: new THREE.Color(0xd8a24a), // brass reactor core = hardware
  core: 1.0,
  layout(i) {
    const s = spokeOf(i); const st = stepOf(i);
    return [Math.cos(ang(s)) * radius(st), Math.sin(ang(s)) * radius(st), 0];
  },
  behavior(ctx, dt, e, presence, t) {
    // Pulses race outward along every spoke; bass fires brighter pulses.
    const phase = (t * (1.2 + e.bass * 1.4)) % (STEPS + 1.2);
    for (let i = 0; i < ctx.N; i += 1) {
      const st = stepOf(i);
      const d = st - phase;
      const pulse = Math.exp(-d * d * 1.3) * (0.7 + e.treble + e.bass * 0.8);
      ctx.boost[i] += pulse * presence;
    }
  }
};
