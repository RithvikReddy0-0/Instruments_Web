/**
 * The Universe — one evolving structure, four worlds.
 *
 * Instead of fading separate scenes in and out, the world is a SINGLE pool of
 * nodes + links whose layout, topology, colour and motion are a presence-weighted
 * BLEND of four zone "profiles". When the active zone changes, presence eases and
 * every node flies from one arrangement into the next — Theory's circle of fifths
 * becomes Practice's arena, becomes Coach's network, becomes Studio's reactor.
 * Nothing disappears; the world evolves.
 *
 * Profiles (zones/<id>.js) are pure descriptors:
 *   { id, accent, coreColor, core, layout(i,N)->[x,y,z], links:[[a,b]...],
 *     behavior(ctx, dt, energy, presence, t) }
 * `behavior` may write per-node `ctx.boost[i]` (extra brightness/size) — the
 * universe handles all morphing, colour and the central core.
 *
 * Exposes the existing zone API so world.js is unchanged:
 *   createZones(scene, opts) -> { setZone(id), update(dt, energy), dispose() }
 */
import * as THREE from "three";
import { theoryProfile } from "./zones/theory.js";
import { practiceProfile } from "./zones/practice.js";
import { coachProfile } from "./zones/coach.js";
import { studioProfile } from "./zones/studio.js";

const N = 24;

function radialTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const cx = c.getContext("2d");
  const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = g;
  cx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createZones(scene, { mobile } = {}) {
  const group = new THREE.Group();
  group.position.set(0, 0, -11);
  scene.add(group);

  const profiles = { theory: theoryProfile, practice: practiceProfile, coach: coachProfile, studio: studioProfile };
  const ids = Object.keys(profiles);
  const layouts = {};
  ids.forEach((id) => { layouts[id] = Array.from({ length: N }, (_, i) => profiles[id].layout(i, N)); });

  // --- nodes (one Points cloud, additive glow) ---
  const pos = new Float32Array(N * 3);
  const acol = new Float32Array(N * 3);
  const asize = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(acol, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(asize, 1));
  const baseSize = mobile ? 210 : 330;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * (1.0 / -mv.z); gl_Position = projectionMatrix * mv; vC = aColor; }`,
    fragmentShader: /* glsl */`
      precision mediump float; varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        gl_FragColor = vec4(vC, smoothstep(0.5, 0.0, r)); }`
  });
  const nodes = new THREE.Points(geo, mat);
  group.add(nodes);

  // --- links: union of every zone's topology (one LineSegments) ---
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const map = new Map();
  ids.forEach((id) => (profiles[id].links || []).forEach(([a, b]) => { const k = key(a, b); if (!map.has(k)) map.set(k, [Math.min(a, b), Math.max(a, b)]); }));
  const links = [...map.values()];
  const L = links.length;
  const lpos = new Float32Array(L * 6);
  const lcol = new Float32Array(L * 6);
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  lgeo.setAttribute("color", new THREE.BufferAttribute(lcol, 3));
  const lineSeg = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(lineSeg);
  const linkInZone = {};
  ids.forEach((id) => { const set = new Set((profiles[id].links || []).map(([a, b]) => key(a, b))); linkInZone[id] = links.map(([a, b]) => (set.has(key(a, b)) ? 1 : 0)); });
  const linkPres = new Float32Array(L);

  // --- central core (the heart of the instrument) ---
  const coreTex = radialTex();
  const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, color: 0x6ee7ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreSprite.scale.setScalar(3);
  group.add(coreSprite);
  const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 3), new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(coreMesh);

  // --- state ---
  const presence = {}; ids.forEach((id) => { presence[id] = id === "theory" ? 1 : 0; });
  const targets = {}; // reused each frame (no per-frame allocation)
  let wsTarget = "theory"; // last real workspace; persists through 'core'/hero
  let inWS = false;
  let intensity = 0.4;
  const boost = new Float32Array(N);
  const _acc = new THREE.Color();
  const _core = new THREE.Color();
  const _tmp = new THREE.Color();
  const ctx = { N, group, pos, boost, coreMesh, coreSprite };
  let t = 0;

  function setZone(id) {
    if (profiles[id]) { wsTarget = id; inWS = true; } else { inWS = false; }
  }

  let lastLight = -1;
  function update(dt, e, blend) {
    t += dt;

    // Match the field: normal blending on a light backdrop (additive washes the
    // colours to white), additive glow on dark. Flips only on theme change.
    const lightOn = e.light ? 1 : 0;
    if (lightOn !== lastLight) {
      lastLight = lightOn;
      const b = lightOn ? THREE.NormalBlending : THREE.AdditiveBlending;
      [mat, lineSeg.material, coreSprite.material, coreMesh.material].forEach((m) => { m.blending = b; m.needsUpdate = true; });
    }

    // Targets: continuous scroll weights when available (the universe morphs as
    // you travel), else the discrete active zone (fallback).
    if (blend && blend.weights) {
      let sum = 0;
      ids.forEach((id) => { sum += blend.weights[id] || 0; });
      ids.forEach((id) => { targets[id] = sum > 1e-4 ? (blend.weights[id] || 0) / sum : (id === wsTarget ? 1 : 0); });
    } else {
      ids.forEach((id) => { targets[id] = id === wsTarget ? 1 : 0; });
    }

    // Ease presence toward targets (smooths scroll jitter) + global intensity.
    let norm = 0;
    ids.forEach((id) => { presence[id] += (targets[id] - presence[id]) * 0.08; norm += presence[id]; });
    norm = norm || 1e-3;
    const targetIntensity = blend ? 0.4 + 0.6 * Math.min(1, blend.strength) : (inWS ? 1 : 0.4);
    intensity += (targetIntensity - intensity) * 0.05;

    // Blended accent + core colour; run each contributing profile's behavior.
    boost.fill(0);
    _acc.setRGB(0, 0, 0); _core.setRGB(0, 0, 0);
    let coreGlow = 0;
    ids.forEach((id) => {
      const w = presence[id] / norm;
      const a = profiles[id].accent;
      // THREE.Color has no addScaledVector — scale-accumulate r/g/b manually.
      _acc.r += a.r * w; _acc.g += a.g * w; _acc.b += a.b * w;
      if (w > 0.002) {
        const p = profiles[id];
        p.behavior?.(ctx, dt, e, w * intensity, t);
        coreGlow += (p.core || 0.5) * w;
        const c = p.coreColor || p.accent;
        _core.r += c.r * w; _core.g += c.g * w; _core.b += c.b * w;
      }
    });

    // Morph node positions (presence-weighted layout blend) + colour/size.
    for (let i = 0; i < N; i += 1) {
      let x = 0; let y = 0; let z = 0;
      ids.forEach((id) => { const w = presence[id] / norm; const lp = layouts[id][i]; x += lp[0] * w; y += lp[1] * w; z += lp[2] * w; });
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const b = (0.9 + boost[i]) * intensity * (0.85 + e.treble * 0.4) * (e.light ? 0.55 : 1);
      acol[i * 3] = _acc.r * b; acol[i * 3 + 1] = _acc.g * b; acol[i * 3 + 2] = _acc.b * b;
      asize[i] = baseSize * (0.62 + boost[i] * 0.9 + e.mid * 0.3) * intensity;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;

    // Links follow their nodes; topology eases between zones.
    for (let l = 0; l < L; l += 1) {
      const [a, b] = links[l];
      lpos[l * 6] = pos[a * 3]; lpos[l * 6 + 1] = pos[a * 3 + 1]; lpos[l * 6 + 2] = pos[a * 3 + 2];
      lpos[l * 6 + 3] = pos[b * 3]; lpos[l * 6 + 4] = pos[b * 3 + 1]; lpos[l * 6 + 5] = pos[b * 3 + 2];
      let target = 0;
      ids.forEach((id) => { target += (presence[id] / norm) * linkInZone[id][l]; });
      linkPres[l] += (target - linkPres[l]) * 0.1;
      const lb = linkPres[l] * intensity * (0.95 + e.mid * 0.5) * (e.light ? 0.5 : 1);
      lcol[l * 6] = _acc.r * lb; lcol[l * 6 + 1] = _acc.g * lb; lcol[l * 6 + 2] = _acc.b * lb;
      lcol[l * 6 + 3] = _acc.r * lb; lcol[l * 6 + 4] = _acc.g * lb; lcol[l * 6 + 5] = _acc.b * lb;
    }
    lgeo.attributes.position.needsUpdate = true;
    lgeo.attributes.color.needsUpdate = true;

    // Core.
    const cg = (0.35 + coreGlow * 0.9) * intensity;
    coreMesh.material.color.copy(_core).multiplyScalar(0.8 + e.bass * 0.7 + coreGlow * 0.4);
    coreMesh.scale.setScalar((0.55 + coreGlow * 0.5 + e.bass * 0.35) * intensity + 0.001);
    coreSprite.material.color.copy(_core);
    coreSprite.material.opacity = (0.15 + cg * 0.4 + e.treble * 0.25) * (e.light ? 0.5 : 1);
    coreSprite.scale.setScalar(2.2 + coreGlow * 2.4 + e.bass * 1.2);

    group.rotation.z += dt * 0.01;
    group.rotation.y = Math.sin(t * 0.05) * 0.06;
  }

  function dispose() {
    geo.dispose(); mat.dispose();
    lgeo.dispose(); lineSeg.material.dispose();
    coreTex.dispose(); coreSprite.material.dispose();
    coreMesh.geometry.dispose(); coreMesh.material.dispose();
    scene.remove(group);
  }

  return { setZone, update, dispose };
}
