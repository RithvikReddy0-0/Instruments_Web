/**
 * The living substrate — a persistent GPU particle field + volumetric glow that
 * never resets (the through-line across every workspace). Particles drift on a
 * vertex shader (cheap for thousands of points) and react to the energy field:
 * mid agitates motion, treble lifts glow, bass swells depth, calm slows it to a
 * breath. Zones retint and re-agitate the SAME field rather than replacing it,
 * so moving between workspaces feels continuous.
 *
 * Palette: Reactive Cyan is the life force; mint = signal; cool white = light;
 * brass is a rare accent only.
 */
import * as THREE from "three";

const PAL = {
  cyan: new THREE.Color(0x6ee7ff),
  mint: new THREE.Color(0x72f1b8),
  white: new THREE.Color(0xf8fafc),
  brass: new THREE.Color(0xd8a24a)
};

// Per-zone mood: tint + agitation + glow bias. Default = the "instrument core".
const ZONES = {
  core: { tint: PAL.cyan, agit: 0.55, glow: 0.5 },
  theory: { tint: PAL.cyan, agit: 0.7, glow: 0.7 },
  practice: { tint: PAL.mint, agit: 0.95, glow: 0.6 },
  coach: { tint: PAL.white, agit: 0.5, glow: 0.55 },
  studio: { tint: PAL.cyan, agit: 1.15, glow: 0.85 }
};

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d").createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  const cx = c.getContext("2d");
  cx.fillStyle = g;
  cx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createField(scene, { mobile }) {
  const group = new THREE.Group();
  scene.add(group);

  const COUNT = mobile ? 2500 : 8000;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const col = new Float32Array(COUNT * 3);
  const pick = () => {
    const r = Math.random();
    return r < 0.66 ? PAL.cyan : r < 0.85 ? PAL.white : r < 0.97 ? PAL.mint : PAL.brass;
  };
  for (let i = 0; i < COUNT; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * 38;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 2] = -38 + Math.random() * 44;
    seed[i] = Math.random();
    const c = pick();
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: mobile ? 80 : 120 }, // visible cyan particles, not a ~2px starfield
    uAgit: { value: 0.55 },
    uOpacity: { value: 0.7 },
    uTint: { value: new THREE.Color(0x6ee7ff) },
    uLight: { value: 0 } // 1 in light theme → darken colors so they read on a bright bg
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uSize; uniform float uAgit;
      attribute float aSeed; attribute vec3 aColor;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec3 p = position;
        float s = aSeed * 6.2831853;
        p.x += sin(uTime * 0.3 + s) * 1.4 * uAgit;
        p.y += cos(uTime * 0.24 + s * 1.3) * 1.0 * uAgit;
        p.z += sin(uTime * 0.19 + s * 0.7) * 1.2 * uAgit;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (1.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vColor = aColor;
        vTw = 0.45 + 0.55 * sin(uTime * 1.3 + s * 4.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float uOpacity; uniform vec3 uTint; uniform float uLight;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r) * vTw * uOpacity;
        // Light theme uses normal blending; darken + saturate toward the tint so
        // particles read as crisp cyan/colour on a bright bg (not washed white).
        vec3 col = mix(vColor, uTint, 0.35 + 0.35 * uLight);
        col = mix(col, col * 0.34, uLight);
        gl_FragColor = vec4(col, a);
      }
    `
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // Volumetric glow — a few big soft sprites drifting in depth.
  const tex = glowTexture();
  const glows = Array.from({ length: mobile ? 3 : 5 }, (_, i) => {
    const m = new THREE.SpriteMaterial({ map: tex, color: i % 2 ? 0x72f1b8 : 0x6ee7ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.position.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 13, -9 - Math.random() * 14);
    s.scale.setScalar(9 + Math.random() * 9);
    s.userData = { seed: Math.random() * 6.28, base: s.position.clone() };
    group.add(s);
    return s;
  });

  // Zone mood (lerped toward target).
  let mood = { ...ZONES.core, tint: ZONES.core.tint.clone() };
  let target = ZONES.core;
  function setZone(id) { target = ZONES[id] || ZONES.core; }

  const _t = new THREE.Color();
  function update(dt, e) {
    uniforms.uTime.value = e.t;

    // Switch blending with the theme: additive glow on dark, normal (so darkened
    // colours stay coloured, not white) on light. Only flips on actual change.
    const lightOn = e.light ? 1 : 0;
    if (uniforms.uLight.value !== lightOn) {
      uniforms.uLight.value = lightOn;
      const blend = lightOn ? THREE.NormalBlending : THREE.AdditiveBlending;
      mat.blending = blend; mat.needsUpdate = true;
      glows.forEach((s) => { s.material.blending = blend; s.material.needsUpdate = true; });
    }

    // Ease mood toward the active zone.
    mood.agit += (target.agit - mood.agit) * 0.03;
    mood.glow += (target.glow - mood.glow) * 0.03;
    mood.tint.lerp(target.tint, 0.03);

    const calmness = e.calm; // 1 = silent
    // Keep a living baseline drift even at rest (calm breathing, never frozen).
    const move = mood.agit * (0.6 + e.mid * 1.3 + e.bass * 0.4) * (1 - 0.4 * calmness) + 0.32 * calmness;
    uniforms.uAgit.value += (move - uniforms.uAgit.value) * 0.1;
    // Normal blending needs solid alpha to show colour; additive wants less.
    uniforms.uOpacity.value = (0.8 + e.treble * 0.4 + e.breath * 0.1 * calmness) * (e.light ? 0.85 : 1);
    uniforms.uTint.value.copy(mood.tint);

    group.rotation.y += dt * (0.01 + e.bass * 0.05);
    group.rotation.x = Math.sin(e.t * 0.05) * 0.04;

    glows.forEach((s, i) => {
      const ph = s.userData.seed;
      s.position.x = s.userData.base.x + Math.sin(e.t * 0.1 + ph) * 2.2;
      s.position.y = s.userData.base.y + Math.cos(e.t * 0.08 + ph) * 1.6;
      const glowE = mood.glow * (0.5 + e.treble * 1.1 + e.bass * 0.3) * (0.7 + 0.3 * (1 - calmness)) + 0.08 * e.breath;
      s.material.opacity = (0.18 + glowE * 0.22) * (e.light ? 0.5 : 1);
      // On light, deepen the glow tint so it reads as soft colour, not white haze.
      s.material.color.copy(i % 2 ? _t.copy(mood.tint).lerp(PAL.mint, 0.5) : _t.copy(mood.tint));
      if (e.light) s.material.color.multiplyScalar(0.5);
      s.scale.setScalar((8 + i * 2) * (1 + e.bass * 0.12));
    });
  }

  function dispose() {
    geo.dispose();
    mat.dispose();
    tex.dispose();
    glows.forEach((s) => s.material.dispose());
    scene.remove(group);
  }

  return { group, setZone, update, dispose };
}
