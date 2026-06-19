/**
 * The Stage — one persistent Three.js set (renderer, camera, light rig) shared
 * by every scene. Scenes are groups added to this single THREE.Scene so the
 * camera flies through one continuous space rather than cutting between scenes.
 *
 * Performance: single renderer, capped pixel ratio, ACES tone mapping, ≤3
 * lights, no shadows. A frame-callback registry lets the orchestrator drive all
 * per-frame updates from one rAF (gsap.ticker) instead of many loops.
 */
import * as THREE from "three";
import { PALETTE } from "./rig/materials.js";

export function createStage(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    powerPreference: "high-performance",
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.bg, 0.04);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0, 8);

  // Light rig: warm brass key, cool rim for depth, soft ambient lift.
  const key = new THREE.PointLight(PALETTE.brass2, 60, 80, 1.4);
  key.position.set(4, 6, 6);
  const rim = new THREE.PointLight(PALETTE.cyan, 26, 80, 1.6);
  rim.position.set(-6, -3, -5);
  const amb = new THREE.AmbientLight(0x20242c, 1.4);
  scene.add(key, rim, amb);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const frameCbs = new Set();
  function onFrame(cb) { frameCbs.add(cb); return () => frameCbs.delete(cb); }
  function render(dt) {
    frameCbs.forEach((cb) => cb(dt));
    renderer.render(scene, camera);
  }

  function dispose() {
    window.removeEventListener("resize", resize);
    frameCbs.clear();
    renderer.dispose();
  }

  return { renderer, scene, camera, key, rim, amb, onFrame, render, dispose };
}
