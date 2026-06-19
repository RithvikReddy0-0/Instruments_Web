/**
 * Theory profile — the celestial machine (baseline world).
 *
 * 24 nodes: 12 on the outer Circle of Fifths, 12 relative minors inside. Links:
 * the 12-gon of fifth-neighbours, the {12/5} fifths-star webbing related chords,
 * and spokes to the relative minors. A real chord progression (TheoryEngine)
 * walks the wheel, lighting its chord tones. Emotion: wonder.
 */
import * as THREE from "three";
import TheoryEngine from "../../theory/theory-engine.js";

const theory = new TheoryEngine();
const R = 6.0;
const Ri = 3.9;
const nodeOf = (note) => ((theory.fifthsOf(note) % 12) + 12) % 12;
const ang = (i) => Math.PI / 2 - (i / 12) * Math.PI * 2;
const PROG = [["C", "major"], ["G", "major"], ["A", "minor"], ["F", "major"], ["D", "minor"], ["G", "major"]];

const links = [];
for (let i = 0; i < 12; i += 1) {
  links.push([i, (i + 1) % 12]);   // outer 12-gon (fifth neighbours)
  links.push([i, (i + 5) % 12]);   // fifths-star
  links.push([i, i + 12]);         // spoke to relative minor
}

export const theoryProfile = {
  id: "theory",
  accent: new THREE.Color(0x6ee7ff),
  coreColor: new THREE.Color(0x9ef0ff),
  core: 0.6,
  layout(i) {
    if (i < 12) return [Math.cos(ang(i)) * R, Math.sin(ang(i)) * R, 0];
    const j = i - 12;
    return [Math.cos(ang(j)) * Ri, Math.sin(ang(j)) * Ri, -0.4];
  },
  behavior(ctx, dt, e, presence, t) {
    const idx = Math.floor(t / 1.6) % PROG.length;
    const [root, type] = PROG[idx];
    const tones = theory.getChord(root, type).map(nodeOf);
    const pulse = 0.6 + 0.4 * Math.sin(t * 2.2);
    tones.forEach((n) => {
      ctx.boost[n] += (0.9 + e.treble) * pulse * presence;
      ctx.boost[n + 12] += 0.4 * pulse * presence; // relative minor glints
    });
  }
};
