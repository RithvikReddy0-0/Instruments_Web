/**
 * Floating instrument in the world — the signature hero object.
 *
 * Real-glTF pipeline with graceful fallback: each instrument shows an on-brand
 * PROCEDURAL placeholder immediately (lit MeshStandard, so the reactive lights
 * play across it), then tries to load a real model from `/models/<id>.glb`. Drop
 * a .glb there (or hand over URLs) and it swaps in automatically — no code change.
 * If the file is absent the placeholder simply stays, so the world is never empty
 * and stays offline-safe.
 *
 * Placeholders are stylized silhouettes (brass body + dark detail + cyan accent),
 * not photoreal — they read as "piano / synth / guitar / violin" and hold the
 * slot until real assets arrive.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BRASS = 0xc8a24b;
const DARK = 0x14161b;
const LIGHT = 0xe8e4d8;
const CYAN = 0x6ee7ff;

const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, metalness: opts.m ?? 0.55, roughness: opts.r ?? 0.45, emissive: opts.e ?? 0x000000, emissiveIntensity: opts.ei ?? 0 });

function buildPiano() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 1.6), std(DARK, { m: 0.4 }));
  body.position.y = -0.35; g.add(body);
  g.add(plate(new THREE.BoxGeometry(4.2, 0.06, 0.16), BRASS, { m: 0.9, r: 0.3, e: BRASS, ei: 0.3 }, 0, -0.06, -0.78));
  const whiteW = 0.34;
  for (let i = 0; i < 11; i += 1) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(whiteW, 0.16, 1.4), std(LIGHT, { m: 0.2, r: 0.5 }));
    k.position.set(-1.9 + i * (whiteW + 0.04), 0, 0); g.add(k);
  }
  [0, 1, 3, 4, 5, 7, 8].forEach((wi) => {
    const k = new THREE.Mesh(new THREE.BoxGeometry(whiteW * 0.55, 0.22, 0.9), std(0x0a0b0d, { m: 0.3, r: 0.4 }));
    k.position.set(-1.9 + (wi + 1) * (whiteW + 0.04) - (whiteW + 0.04) / 2, 0.06, -0.22); g.add(k);
  });
  g.userData.baseScale = 1.0;
  return g;
}

function buildSynth() {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 2.0), std(DARK, { m: 0.5 }));
  panel.rotation.x = -0.5; g.add(panel);
  for (let i = 0; i < 5; i += 1) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 20), std(BRASS, { m: 0.9, r: 0.3, e: BRASS, ei: 0.25 }));
    knob.position.set(-1.3 + i * 0.65, 0.45, 0.45); knob.rotation.x = -0.5 + Math.PI / 2; g.add(knob);
  }
  for (let i = 0; i < 8; i += 1) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), std(CYAN, { e: CYAN, ei: 1.2, m: 0.2 }));
    led.position.set(-1.4 + i * 0.4, 0.5, -0.3); g.add(led);
  }
  g.userData.baseScale = 1.0;
  return g;
}

function buildGuitar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 20), std(BRASS, { m: 0.6, r: 0.4 }));
  body.scale.set(1.1, 1.25, 0.32); body.position.y = -0.8; g.add(body);
  const hole = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 12, 28), std(0x0a0b0d, { m: 0.3 }));
  hole.position.set(0, -0.7, 0.34); g.add(hole);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.0, 0.18), std(DARK, { m: 0.4 }));
  neck.position.set(0, 1.4, 0.05); g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.16), std(DARK, { m: 0.4 }));
  head.position.set(0, 3.0, 0.05); g.add(head);
  g.rotation.z = 0.35; g.userData.baseScale = 0.82;
  return g;
}

function buildViolin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 20), std(0x8a3b1e, { m: 0.3, r: 0.5 }));
  body.scale.set(0.95, 1.3, 0.3); body.position.y = -0.7; g.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.16), std(0x2a1810, { m: 0.3 }));
  neck.position.set(0, 1.3, 0.04); g.add(neck);
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 10, 20), std(0x2a1810, { m: 0.3 }));
  scroll.position.set(0, 2.55, 0.04); g.add(scroll);
  // strings
  for (let i = 0; i < 4; i += 1) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.0, 6), std(LIGHT, { e: CYAN, ei: 0.4, m: 0.6 }));
    s.position.set(-0.09 + i * 0.06, 0.6, 0.16); g.add(s);
  }
  g.rotation.z = 0.3; g.userData.baseScale = 0.92;
  return g;
}

function plate(geo, color, opts, x, y, z) { const m = new THREE.Mesh(geo, std(color, opts)); m.position.set(x, y, z); return m; }

const SPECS = { piano: buildPiano, synth: buildSynth, guitar: buildGuitar, violin: buildViolin };

function disposeObj(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose()); } }); }

function fitModel(obj) {
  // Normalize an arbitrary glTF to ~4 units tall, centered.
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const s = 4 / (Math.max(size.x, size.y, size.z) || 1);
  obj.position.sub(center.multiplyScalar(s));
  obj.scale.setScalar(s);
  const wrap = new THREE.Group(); wrap.add(obj); wrap.userData.baseScale = 1.0;
  return wrap;
}

export function createInstruments(scene, { mobile } = {}) {
  const group = new THREE.Group();
  group.position.set(2.4, -0.2, -6.6); // floats to the side, behind content
  group.rotation.x = 0.42;             // tilt key-tops/face toward the camera
  scene.add(group);

  const loader = new GLTFLoader();
  let current = null;
  let currentId = null;

  function show(id) {
    const key = SPECS[id] ? id : "piano";
    if (key === currentId) return;
    currentId = key;
    if (current) { group.remove(current); disposeObj(current); current = null; }
    current = SPECS[key]();
    group.add(current);
    loader.load(`/models/${key}.glb`,
      (gltf) => { if (currentId !== key) return; group.remove(current); disposeObj(current); current = fitModel(gltf.scene); group.add(current); },
      undefined,
      () => { /* no real model yet → keep the procedural placeholder */ });
  }
  show("piano");

  let t = 0;
  function update(dt, e) {
    t += dt;
    group.rotation.y = 0.5 + Math.sin(t * 0.12) * 0.28;          // slow showcase turn (mostly 3/4)
    group.position.y = -0.2 + Math.sin(t * 0.5) * 0.12 + e.bass * 0.12; // float + bass bob
    if (current) current.scale.setScalar((current.userData.baseScale || 1) * (1 + e.mid * 0.04));
  }

  function dispose() { if (current) disposeObj(current); scene.remove(group); }

  return { group, update, setInstrument: show, dispose };
}
