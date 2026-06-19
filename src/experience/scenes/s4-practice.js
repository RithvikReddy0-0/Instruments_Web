/**
 * Scene 4 — "The Practice Arena".
 *
 * Concentric target rings with note-trails streaking inward to a glowing
 * bullseye. Each note that lands fires an expanding mint feedback pulse and
 * flashes the centre — aim, repetition, feedback. Streak speed and pulse
 * intensity ride the audio energy. Scene contract: { group, waypoint, caption,
 * update, dispose }.
 */
import * as THREE from "three";
import { PALETTE } from "../rig/materials.js";

const OUTER = 3.4;

export function createPracticeScene() {
  const group = new THREE.Group();
  group.position.set(-2, -6, -30);
  group.rotation.set(0.12, 0, 0);

  // Concentric target rings (Torus normal faces +Z toward the camera).
  const rings = [0.7, 1.5, 2.3, 3.1].map((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.018, 8, 120),
      new THREE.MeshBasicMaterial({ color: i % 2 ? PALETTE.brass2 : PALETTE.brass, transparent: true, opacity: 0.35 })
    );
    group.add(ring);
    return ring;
  });

  // Bullseye.
  const bull = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 3),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass, emissive: PALETTE.brass2, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.3 })
  );
  group.add(bull);
  let bullGlow = 0;

  // Note-trails streaking inward.
  const streakGeo = new THREE.BoxGeometry(0.035, 0.5, 0.035);
  const streaks = Array.from({ length: 8 }, (_, i) => {
    const mesh = new THREE.Mesh(
      streakGeo,
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? PALETTE.cyan : PALETTE.brass2, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    group.add(mesh);
    return { mesh, angle: Math.random() * Math.PI * 2, r: OUTER * (0.4 + Math.random() * 0.6), speed: 1.6 + Math.random() * 1.4 };
  });

  // Pool of expanding feedback pulses (mint = "hit").
  const pulseGeo = new THREE.TorusGeometry(1, 0.02, 8, 96);
  const pulses = Array.from({ length: 4 }, () => {
    const mesh = new THREE.Mesh(
      pulseGeo,
      new THREE.MeshBasicMaterial({ color: PALETTE.mint, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.visible = false;
    group.add(mesh);
    return { mesh, life: 0 };
  });
  function spawnPulse() {
    const p = pulses.find((x) => x.life <= 0);
    if (p) p.life = 1;
  }

  let t = 0;
  function update(dt, energy) {
    t += dt;

    streaks.forEach((s) => {
      s.r -= s.speed * (0.6 + energy * 1.1) * dt;
      if (s.r <= 0.24) {
        s.r = OUTER;
        s.angle = Math.random() * Math.PI * 2;
        s.speed = 1.6 + Math.random() * 1.4;
        spawnPulse();
        bullGlow = 1; // hit flash
      }
      const x = Math.cos(s.angle) * s.r;
      const y = Math.sin(s.angle) * s.r;
      s.mesh.position.set(x, y, 0);
      s.mesh.rotation.z = s.angle - Math.PI / 2; // point toward centre
      s.mesh.material.opacity = 0.25 + (1 - s.r / OUTER) * 0.75;
    });

    bullGlow = Math.max(0, bullGlow - dt * 2.2);
    bull.material.emissiveIntensity = 0.45 + bullGlow * 2.2 + energy * 0.8;
    bull.scale.setScalar(1 + bullGlow * 0.5 + energy * 0.2);

    pulses.forEach((p) => {
      if (p.life > 0) {
        p.life -= dt / 0.6;
        const k = 1 - Math.max(0, p.life);
        p.mesh.visible = true;
        p.mesh.scale.setScalar(0.25 + k * 3.2);
        p.mesh.material.opacity = Math.max(0, p.life) * 0.7;
      } else if (p.mesh.visible) {
        p.mesh.visible = false;
      }
    });

    rings.forEach((r, i) => { r.material.opacity = 0.3 + energy * 0.3 + bullGlow * 0.2 * (1 - i / rings.length); });
    group.rotation.z += dt * 0.03;
  }

  function dispose() {
    streakGeo.dispose();
    pulseGeo.dispose();
    rings.forEach((r) => { r.geometry.dispose(); r.material.dispose(); });
    bull.geometry.dispose();
    bull.material.dispose();
    streaks.forEach((s) => s.mesh.material.dispose());
    pulses.forEach((p) => p.mesh.material.dispose());
  }

  return {
    group,
    waypoint: { pos: [-2, -5.6, -23], look: [-2, -6, -30] },
    caption: { title: "The Practice Arena", sub: "Where repetition becomes precision." },
    update,
    dispose
  };
}
