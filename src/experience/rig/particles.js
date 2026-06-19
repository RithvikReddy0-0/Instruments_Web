/**
 * Audio-reactive particle field — one BufferGeometry / one PointsMaterial drawn
 * in a single draw call, reused across all scenes (the "ambient" motion system).
 * Size and opacity breathe with the audio energy; the whole field drifts slowly.
 */
import * as THREE from "three";
import { PALETTE } from "./materials.js";

export function createParticles(scene, { count }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    // Spherical shell, flattened on Y for a horizon-like depth field.
    const r = 6 + Math.random() * 22;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: PALETTE.brass,
    size: 0.05,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let energy = 0;
  function update(dt, e) {
    energy += (e - energy) * 0.08;
    points.rotation.y += dt * 0.02;
    points.rotation.x += dt * 0.005;
    mat.size = 0.04 + energy * 0.07;
    mat.opacity = 0.45 + energy * 0.45;
  }

  function dispose() {
    scene.remove(points);
    geo.dispose();
    mat.dispose();
  }

  return { points, update, dispose };
}
