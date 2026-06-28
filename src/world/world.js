/**
 * The persistent world — one long-lived renderer behind the entire application.
 *
 * It is the page's living backdrop: the app DOM sits on top, panels translucent
 * so this shows through ("embedded inside the instrument"). Owns a slow camera
 * drift (+ subtle mouse parallax), the energy field, and the reactive substrate.
 *
 * Lifecycle discipline (it runs forever, alongside the app):
 *  - paused while the intro overlay (#experience) is on top — no double cost;
 *  - paused when the tab is hidden;
 *  - throttled to ~30fps when the field is calm (no audio, no interaction);
 *  - full 60fps when there's energy.
 */
import * as THREE from "three";
import "./world.css";
import { createField } from "./field.js";
import { createGround } from "./ground.js";
import { createEnergy } from "./energy.js";
import { createZones } from "./zones.js";
import { createCameraChoreography } from "./camera-choreo.js";
import { createInstruments } from "./instruments.js";
import { installBridge } from "./bridge.js";

export function startWorld({ mobile } = {}) {
  const canvas = document.createElement("canvas");
  canvas.id = "ihWorldCanvas";
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b15, 0.02);

  // "Deep Aurora" backdrop — instead of a flat fill, the void is a painted
  // gradient with soft radial colour pools (cyan/mint + a rare violet on dark;
  // teal/mint on the light/dusk theme). Cheap (one CanvasTexture), regenerated
  // only on the theme toggle. Fog still fades distant geometry to a base tone.
  function auroraPool(x, cx, cy, rgb, a, r) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  }
  function makeAurora(isLight) {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 1024);
    if (isLight) {
      g.addColorStop(0, "#eef4fb"); g.addColorStop(0.55, "#e4edf5"); g.addColorStop(1, "#dde8f1");
      x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
      auroraPool(x, 205, 270, "120,210,190", 0.5, 720);  // teal
      auroraPool(x, 840, 230, "150,200,235", 0.42, 680); // cool blue
      auroraPool(x, 512, 885, "150,225,205", 0.5, 840);  // mint horizon
    } else {
      g.addColorStop(0, "#06060f"); g.addColorStop(0.5, "#080a18"); g.addColorStop(0.82, "#0b1024"); g.addColorStop(1, "#0e1430");
      x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
      x.globalCompositeOperation = "lighter"; // pools glow additively on black
      auroraPool(x, 175, 280, "28,92,138", 0.85, 760);  // cyan
      auroraPool(x, 860, 235, "78,58,158", 0.6, 720);   // violet (elevated)
      auroraPool(x, 512, 905, "26,86,124", 0.9, 880);   // horizon cyan
      auroraPool(x, 690, 600, "104,76,196", 0.5, 640);  // violet glow
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Theme-aware world: dark is the cinematic canonical mood; light is a restrained
  // dusk. Reacts live to the theme toggle.
  let light = document.documentElement.classList.contains("light-theme");
  let auroraTex = null;
  function applyTheme() {
    light = document.documentElement.classList.contains("light-theme");
    auroraTex?.dispose();
    auroraTex = makeAurora(light);
    scene.background = auroraTex;
    scene.fog.color.set(light ? 0xe3ecf5 : 0x080a18);
  }
  applyTheme();
  const themeMo = new MutationObserver(applyTheme);
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0, 6);

  const energy = createEnergy();
  const field = createField(scene, { mobile });
  const ground = createGround(scene, { mobile });
  const zones = createZones(scene, { mobile });
  const cameraChoreo = createCameraChoreography();
  const instruments = createInstruments(scene, { mobile });

  // Reactive lighting — the only lit geometry is the floating instrument, so
  // these PointLights wash across it and pulse with the audio energy + shift
  // toward the active zone's colour. Field/universe stay additive (unlit).
  const keyLight = new THREE.PointLight(0x6ee7ff, 9, 50, 1.4);
  keyLight.position.set(5, 4, 1);
  const rimLight = new THREE.PointLight(0xd8a24a, 6, 50, 1.4); // warm brass rim (hardware)
  rimLight.position.set(-5, -2, -1);
  const ambient = new THREE.AmbientLight(0x2a3442, 0.8);
  scene.add(keyLight, rimLight, ambient);
  const _mint = new THREE.Color(0x72f1b8);
  const _white = new THREE.Color(0xf2f6ff);
  const _lc = new THREE.Color();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // Subtle mouse parallax adds interaction-driven depth.
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  function onMove(ev) { mouse.tx = (ev.clientX / window.innerWidth - 0.5); mouse.ty = (ev.clientY / window.innerHeight - 0.5); }
  window.addEventListener("pointermove", onMove, { passive: true });

  // The world is the single ambient backdrop: retire the legacy 2D ambient AND
  // the hero's decorative brass-dot canvas so the living world shows through from
  // the first frame. They're created later by the app, so watch for them.
  const LEGACY_IDS = ["ambientCanvas", "heroCanvas"];
  function hideLegacy() {
    let allDone = true;
    LEGACY_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.dataset.ihHidden = "1"; el.style.display = "none"; }
      else allDone = false;
    });
    return allDone;
  }
  let legacyMo = null;
  if (!hideLegacy()) {
    legacyMo = new MutationObserver(() => { if (hideLegacy()) { legacyMo.disconnect(); legacyMo = null; } });
    legacyMo.observe(document.body, { childList: true });
  }

  // --- Scroll-coupled zone blend ---
  // Turn scroll position into continuous zone weights so the universe morphs as
  // you TRAVEL between workspaces, not just on section-enter. Section offsets are
  // cached (no per-frame layout reflow) and refreshed on resize + periodically as
  // the app's workspace content mounts and changes height.
  const ZONE_IDS = ["theory", "practice", "coach", "studio"];
  let sections = [];
  function refreshSections() {
    sections = [...document.querySelectorAll("[data-zone]")]
      .filter((el) => ZONE_IDS.includes(el.getAttribute("data-zone")))
      .map((el) => { const r = el.getBoundingClientRect(); const top = r.top + window.scrollY; return { id: el.getAttribute("data-zone"), top, bottom: top + r.height }; });
  }
  refreshSections();
  window.addEventListener("resize", refreshSections);

  // A zone reads ~1.0 while its section spans the viewport centre (handles very
  // tall sections), and blends with its neighbour across the gap between them —
  // so the universe morphs continuously as you travel, with a clean identity at
  // each workspace.
  function computeBlend() {
    if (!sections.length) return null;
    const vh = window.innerHeight;
    const focus = window.scrollY + vh * 0.5;
    const fall = vh * 0.6; // transition reach outside a section
    const weights = {};
    let strength = 0;
    sections.forEach((s) => {
      let w;
      if (focus >= s.top && focus <= s.bottom) w = 1;
      else { const d = focus < s.top ? s.top - focus : focus - s.bottom; w = Math.exp(-(d / fall) * (d / fall)); }
      weights[s.id] = w;
      strength = Math.max(strength, w);
    });
    return { weights, strength };
  }

  let running = true;
  let last = performance.now();
  let calmFrame = 0;
  let mobileFrame = 0;
  let frameCount = 0;

  function introOnTop() {
    const el = document.getElementById("experience");
    return !!(el && !el.hidden && el.childElementCount > 0);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    // Pause behind the intro or when hidden.
    if (document.hidden || introOnTop()) { last = now; return; }

    const e = energy.update(dt);
    e.light = light; // field + universe dim themselves on a daylight backdrop
    // Mobile: steady ~30fps backdrop. Desktop: 60fps active, ~30fps when calm.
    if (mobile) { mobileFrame ^= 1; if (mobileFrame) { last = now; return; } }
    else if (e.calm > 0.85) { calmFrame ^= 1; if (calmFrame) { last = now; return; } }
    last = now;

    frameCount += 1;
    if ((frameCount & 63) === 0) refreshSections(); // re-measure as content settles

    const blend = computeBlend();
    field.update(dt, e);
    zones.update(dt, e, blend);
    instruments.update(dt, e);

    // Reactive lighting on the floating instrument: pulse with energy + tint
    // toward the active zone (mint in Practice, cooler/white in Coach, else cyan).
    _lc.setHex(0x6ee7ff);
    if (blend && blend.weights) {
      _lc.lerp(_mint, Math.min(1, blend.weights.practice || 0));
      _lc.lerp(_white, Math.min(1, (blend.weights.coach || 0) * 0.7));
    }
    keyLight.color.copy(_lc);
    keyLight.intensity = (15 + e.treble * 16 + e.bass * 4) * (light ? 0.8 : 1);
    rimLight.intensity = (10 + e.bass * 9) * (light ? 0.8 : 1);
    ambient.intensity = light ? 1.7 : 1.1;

    // Per-zone camera choreography, blended by the same scroll weights as the
    // universe → the move morphs continuously (theory orbit → practice push →
    // coach drift → studio converge), never snapping between sections.
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    cameraChoreo.apply(camera, dt, e, blend, mouse);

    // Ground runs last so its distance-fade + cursor raycast use the camera's
    // current (post-choreography) position.
    ground.update(dt, e, camera, blend);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  const world = {
    setZone: (id) => { field.setZone(id); zones.setZone(id); },
    setInstrument: (id) => instruments.setInstrument(id),
    stop() { running = false; },
    resume() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } },
    dispose() {
      running = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", refreshSections);
      themeMo.disconnect();
      window.removeEventListener("pointermove", onMove);
      instruments.dispose();
      scene.remove(keyLight, rimLight, ambient);
      zones.dispose();
      ground.dispose();
      field.dispose();
      auroraTex?.dispose();
      renderer.dispose();
      canvas.remove();
      legacyMo?.disconnect();
      LEGACY_IDS.forEach((id) => { const el = document.getElementById(id); if (el && el.dataset.ihHidden) el.style.display = ""; });
    }
  };

  installBridge(world, energy);
  return world;
}
