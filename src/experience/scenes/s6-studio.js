/**
 * Scene 6 — "The Studio" (finale).
 *
 * A piano-roll grid floating in space: brass note clips on a lit grid with a
 * playhead sweeping left→right, lighting each clip as it "plays". This is where
 * the camera ends — the CTA dive plunges straight into the grid for the whiteout
 * handoff into the real application (which opens on its own piano roll).
 * Scene contract: { group, waypoint, caption, update, dispose }.
 */
import * as THREE from "three";
import { PALETTE } from "../rig/materials.js";

const W = 8;
const H = 4.5;
const COLS = 16;
const ROWS = 9;

// A little melody laid across the grid: { c: startCol, r: row, l: length }.
const MELODY = [
  { c: 0, r: 4, l: 2 }, { c: 2, r: 5, l: 1 }, { c: 3, r: 6, l: 2 }, { c: 5, r: 4, l: 1 },
  { c: 6, r: 3, l: 2 }, { c: 8, r: 5, l: 2 }, { c: 10, r: 6, l: 1 }, { c: 11, r: 7, l: 2 },
  { c: 13, r: 4, l: 1 }, { c: 14, r: 5, l: 2 }, { c: 1, r: 2, l: 1 }, { c: 9, r: 2, l: 1 }
];

export function createStudioScene() {
  const group = new THREE.Group();
  group.position.set(-5, -2, -47);
  group.rotation.set(-0.06, 0.12, 0);

  const cellW = W / COLS;
  const cellH = H / ROWS;
  const left = -W / 2;
  const bottom = -H / 2;

  // Grid lines (one LineSegments).
  const gpts = [];
  for (let c = 0; c <= COLS; c += 1) { const x = left + c * cellW; gpts.push(x, bottom, 0, x, bottom + H, 0); }
  for (let r = 0; r <= ROWS; r += 1) { const y = bottom + r * cellH; gpts.push(left, y, 0, left + W, y, 0); }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gpts), 3));
  const grid = new THREE.LineSegments(
    gridGeo,
    new THREE.LineBasicMaterial({ color: PALETTE.brass, transparent: true, opacity: 0.16 })
  );
  group.add(grid);

  // Brass frame around the roll.
  const frameGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(left, bottom, 0), new THREE.Vector3(left + W, bottom, 0),
    new THREE.Vector3(left + W, bottom + H, 0), new THREE.Vector3(left, bottom + H, 0),
    new THREE.Vector3(left, bottom, 0)
  ]);
  const frame = new THREE.Line(frameGeo, new THREE.LineBasicMaterial({ color: PALETTE.brass2, transparent: true, opacity: 0.5 }));
  group.add(frame);

  // Note clips.
  const clips = MELODY.map((n) => {
    const w = n.l * cellW - cellW * 0.18;
    const geo = new THREE.BoxGeometry(w, cellH * 0.66, 0.12);
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.brass, emissive: PALETTE.brass2, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    const xL = left + n.c * cellW;
    mesh.position.set(xL + (n.l * cellW) / 2, bottom + (n.r + 0.5) * cellH, 0.06);
    group.add(mesh);
    return { mesh, xL, xR: xL + n.l * cellW };
  });

  // Playhead.
  const playGeo = new THREE.BoxGeometry(0.045, H, 0.04);
  const playMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const playhead = new THREE.Mesh(playGeo, playMat);
  playhead.position.y = bottom + H / 2;
  group.add(playhead);

  let t = 0;
  function update(dt, energy) {
    t += dt;
    const cycle = (t * (0.16 + energy * 0.12)) % 1;
    const px = left + cycle * W;
    playhead.position.x = px;
    playMat.opacity = 0.6 + energy * 0.4;

    clips.forEach((clip) => {
      const playing = px >= clip.xL && px <= clip.xR;
      const target = playing ? 1.7 + energy * 1.8 : 0.28;
      clip.mesh.material.emissiveIntensity += (target - clip.mesh.material.emissiveIntensity) * 0.25;
      const s = playing ? 1.12 : 1;
      clip.mesh.scale.z += ((playing ? 1.6 : 1) - clip.mesh.scale.z) * 0.2;
      clip.mesh.scale.y += (s - clip.mesh.scale.y) * 0.2;
    });
    grid.material.opacity = 0.14 + energy * 0.12;
    group.rotation.y = 0.12 + Math.sin(t * 0.2) * 0.05;
  }

  function dispose() {
    gridGeo.dispose();
    frameGeo.dispose();
    playGeo.dispose();
    grid.material.dispose();
    frame.material.dispose();
    playMat.dispose();
    clips.forEach((c) => { c.mesh.geometry.dispose(); c.mesh.material.dispose(); });
  }

  return {
    group,
    waypoint: { pos: [-5, -1.5, -39], look: [-5, -2, -47] },
    caption: { title: "The Studio", sub: "Where it all becomes music." },
    update,
    dispose
  };
}
