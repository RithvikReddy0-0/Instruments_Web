/**
 * Coach profile — the Living Intelligence Network.
 *
 * The nodes spread into an organic 3D cloud (a flattened Fibonacci distribution)
 * wired by a nearest-neighbour graph — patterns emerge from connections. A focus
 * of attention roams the network, lighting a node and its neighbours so insights
 * feel discovered rather than displayed. Emotion: intelligence. Cool White.
 */
import * as THREE from "three";

const N = 24;
const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle

const positions = [];
for (let i = 0; i < N; i += 1) {
  const y = 1 - (i / (N - 1)) * 2;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * GA;
  positions.push([Math.cos(th) * rad * 5.5, y * 3.7, Math.sin(th) * rad * 3.0 - 1.0]);
}

// Nearest-neighbour graph: each node linked to its 2 closest (deduped).
const links = [];
const seen = new Set();
for (let i = 0; i < N; i += 1) {
  const d = positions.map((p, j) => {
    const dx = p[0] - positions[i][0]; const dy = p[1] - positions[i][1]; const dz = p[2] - positions[i][2];
    return { j, dist: dx * dx + dy * dy + dz * dz };
  }).filter((o) => o.j !== i).sort((a, b) => a.dist - b.dist);
  for (let n = 0; n < 2; n += 1) {
    const j = d[n].j; const key = i < j ? `${i}_${j}` : `${j}_${i}`;
    if (!seen.has(key)) { seen.add(key); links.push([i, j]); }
  }
}
// Adjacency for the discovery highlight.
const adj = Array.from({ length: N }, () => []);
links.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });

export const coachProfile = {
  id: "coach",
  accent: new THREE.Color(0xf8fafc),
  coreColor: new THREE.Color(0xcfe0f0),
  core: 0.45,
  layout(i) { return positions[i]; },
  behavior(ctx, dt, e, presence, t) {
    const focus = Math.floor(t / 1.3) % N;        // attention roams the graph
    const frac = (t / 1.3) % 1;
    const arrive = Math.sin(Math.min(1, frac * 2) * Math.PI * 0.5); // ease-in glow
    ctx.boost[focus] += (1.1 + e.treble) * arrive * presence;
    adj[focus].forEach((n) => { ctx.boost[n] += (0.55 + e.mid * 0.5) * arrive * presence; });
    // A faint baseline shimmer so the whole network stays alive.
    for (let i = 0; i < N; i += 1) ctx.boost[i] += 0.12 * (0.5 + 0.5 * Math.sin(t * 1.7 + i)) * presence;
  }
};
