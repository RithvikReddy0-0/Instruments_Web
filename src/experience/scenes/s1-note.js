/**
 * Scene 1 — "The Note".
 *
 * One glowing brass core wrapped in resonance rings: a single note as the atom
 * of music. The core pulses on a sine and swells with audio energy; the rings
 * counter-rotate and flare. This is the template every later scene follows:
 *   { group, waypoint, caption, update(dt, energy), dispose() }.
 */
import * as THREE from "three";
import { PALETTE } from "../rig/materials.js";

export function createNoteScene() {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 4),
    new THREE.MeshStandardMaterial({
      color: PALETTE.brass,
      emissive: PALETTE.brass2,
      emissiveIntensity: 0.6,
      roughness: 0.28,
      metalness: 0.85,
      flatShading: true
    })
  );
  group.add(core);

  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.7 + i * 0.55, 0.012, 8, 140),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? PALETTE.cyan : PALETTE.brass2,
        transparent: true,
        opacity: 0.5
      })
    );
    ring.rotation.x = Math.PI / 2 + i * 0.22;
    rings.push(ring);
    group.add(ring);
  }

  let t = 0;
  function update(dt, energy) {
    t += dt;
    const s = 1 + Math.sin(t * 2) * 0.04 + energy * 0.22;
    core.scale.setScalar(s);
    core.rotation.y += dt * 0.3;
    core.rotation.x += dt * 0.1;
    core.material.emissiveIntensity = 0.5 + energy * 1.3;
    rings.forEach((r, i) => {
      r.rotation.z += dt * (0.2 + i * 0.1);
      r.scale.setScalar(1 + energy * 0.3);
      r.material.opacity = 0.22 + energy * 0.5;
    });
  }

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  return {
    group,
    waypoint: { pos: [0, 0.3, 5.4], look: [0, 0, 0] },
    caption: { title: "The Note", sub: "Every sound begins as one." },
    update,
    dispose
  };
}
