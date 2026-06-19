/**
 * Scene 2 — "The Instrument".
 *
 * The single note multiplies into a playable keybed — a stylized IH-1 unit:
 * dark chassis, brass seam, white + black keys. A highlight "plays" across the
 * bed in a wave (sequencer feel) and the whole unit glows with audio energy.
 * Follows the scene contract: { group, waypoint, caption, update, dispose }.
 *
 * Positioned down-and-back in the shared space so the camera travels from the
 * Note (origin) to the Instrument — the first real flight through the set.
 */
import * as THREE from "three";
import { PALETTE } from "../rig/materials.js";

export function createInstrumentScene() {
  const group = new THREE.Group();
  group.position.set(-8, -4.5, -12);
  group.rotation.set(-0.32, 0.5, 0); // 3/4 hardware tilt

  const WHITE = 10;
  const whiteW = 0.62;
  const whiteD = 2.6;
  const whiteH = 0.22;
  const gap = 0.06;
  const totalW = WHITE * (whiteW + gap);
  const startX = -totalW / 2;

  // Chassis body (the IH-1 unit) + brass back seam.
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(totalW + 0.5, 0.42, whiteD + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.5, metalness: 0.6 })
  );
  chassis.position.set(0, -0.34, -0.1);
  group.add(chassis);

  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(totalW + 0.5, 0.06, 0.14),
    new THREE.MeshStandardMaterial({
      color: PALETTE.brass, emissive: PALETTE.brass2, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.3
    })
  );
  seam.position.set(0, -0.04, -whiteD / 2 - 0.2);
  group.add(seam);

  const keys = [];

  for (let i = 0; i < WHITE; i += 1) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(whiteW, whiteH, whiteD),
      new THREE.MeshStandardMaterial({ color: 0x161619, roughness: 0.35, metalness: 0.5, emissive: PALETTE.brass, emissiveIntensity: 0 })
    );
    m.position.set(startX + i * (whiteW + gap) + whiteW / 2, 0, 0);
    keys.push({ mesh: m, base: 0, phase: i * 0.5, black: false });
    group.add(m);
  }

  // Black keys nestled between selected white keys (classic gaps at 2 & 6).
  [0, 1, 3, 4, 5, 7, 8].forEach((wi) => {
    if (wi >= WHITE - 1) return;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(whiteW * 0.58, whiteH * 1.6, whiteD * 0.62),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.4, metalness: 0.4, emissive: PALETTE.cyan, emissiveIntensity: 0 })
    );
    m.position.set(startX + (wi + 1) * (whiteW + gap), whiteH * 0.5, -whiteD * 0.18);
    keys.push({ mesh: m, base: whiteH * 0.5, phase: wi * 0.5 + 0.25, black: true });
    group.add(m);
  });

  let t = 0;
  function update(dt, energy) {
    t += dt;
    keys.forEach((k) => {
      const wave = Math.sin(t * 3 - k.phase * 1.3);
      const active = Math.max(0, wave) ** 3; // sharp, percussive peaks
      k.mesh.position.y = k.base - active * (0.06 + energy * 0.05);
      k.mesh.material.emissiveIntensity = (k.black ? 0.2 : 0.15) + active * (0.6 + energy * 1.4);
    });
    group.rotation.y = 0.5 + Math.sin(t * 0.3) * 0.06; // gentle breathing
  }

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  return {
    group,
    waypoint: { pos: [-8, -3.6, -6.2], look: [-8, -4.5, -12] },
    caption: { title: "The Instrument", sub: "One note becomes many." },
    update,
    dispose
  };
}
