/**
 * The Ground — the reactive floor the living instrument stands on.
 *
 * A single GPU shader plane laid flat below the scene. It draws a perspective
 * grid that runs cyan→mint into a luminous horizon, with light pulses travelling
 * toward the viewer ("data on the rails"), a glow that follows the cursor, and a
 * brightness that breathes with the real audio energy. One quad, all fragment
 * work — cheap, no geometry churn.
 *
 * "Deep Aurora" palette (informed by ui-ux-pro-max + 21st):
 *   DARK  → cyan near, mint far, cyan-violet horizon; additive glow.
 *   LIGHT → saturated deep teal near, teal far, emerald horizon; NORMAL blending
 *           (additive washes out on white), so it stays beautiful in light mode.
 *
 * Interactivity is wired here (not CSS):
 *   audio  → grid/pulse/horizon brightness (bass/mid/treble/activity)
 *   cursor → soft proximity glow raycast onto the floor
 *   zones  → far colour drifts toward Practice mint / Coach cool-white
 *   calm   → dims to a slow breath when the room is silent
 */
import * as THREE from "three";

const FLOOR_Y = -4.2;

// Theme palettes. Near = closest grid colour, Far = receding colour (zone-tinted),
// Horizon = the emissive band where the grid converges.
const PAL = {
  dark:  { near: 0x6ee7ff, far: 0x72f1b8, horizon: 0x8aa6ff, opacity: 0.95,
           mint: 0x72f1b8, white: 0xf2f6ff },
  light: { near: 0x0e7490, far: 0x0d9488, horizon: 0x0f766e, opacity: 0.85,
           mint: 0x0a9d6a, white: 0x51647d }
};

export function createGround(scene, { mobile } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: PAL.dark.opacity },
    uGrid: { value: 2.0 },
    uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
    uActivity: { value: 0 }, uCalm: { value: 1 }, uBreath: { value: 0 },
    uLight: { value: 0 },
    uCam: { value: new THREE.Vector3(0, 0, 6) },
    uMouse: { value: new THREE.Vector3(0, FLOOR_Y, -60) },
    uColor: { value: new THREE.Color(PAL.dark.near) },
    uColor2: { value: new THREE.Color(PAL.dark.far) },
    uHorizon: { value: new THREE.Color(PAL.dark.horizon) }
  };

  const geo = new THREE.PlaneGeometry(140, 180, 1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vWorld;
      uniform float uTime, uOpacity, uGrid, uBass, uMid, uTreble, uActivity, uCalm, uBreath, uLight;
      uniform vec3 uColor, uColor2, uHorizon, uCam, uMouse;

      // Anti-aliased grid line strength for a cell size (derivative based).
      float gridLine(vec2 p, float cell) {
        vec2 c = p / cell;
        vec2 d = fwidth(c);
        vec2 g = abs(fract(c - 0.5) - 0.5) / max(d, vec2(1e-5));
        return 1.0 - min(min(g.x, g.y), 1.0);
      }

      void main() {
        vec2 P = vWorld.xz;
        float minor = gridLine(P, uGrid);
        float major = gridLine(P, uGrid * 8.0);

        float dist = length(P - uCam.xz);
        float nearFade = smoothstep(1.5, 13.0, dist);          // don't blare underfoot
        float farFade  = 1.0 - smoothstep(72.0, 116.0, dist);  // dissolve into the void
        float depthFade = nearFade * farFade;

        // Audio energy, dimmed when the room is calm/silent.
        float energy = 0.5 + uTreble * 0.85 + uBass * 0.55 + uActivity * 0.7;
        energy *= (0.6 + 0.4 * (1.0 - uCalm)) + 0.14 * uBreath;

        float gridI = minor * 0.5 + major * 1.0;

        // Light pulses sweeping toward the viewer: a bright head with a soft trail.
        float wave = fract(vWorld.z * 0.022 + uTime * 0.25);
        float head = smoothstep(0.86, 1.0, wave);
        float trail = smoothstep(0.0, 0.86, wave) * 0.22;
        float pulse = (head * 1.6 + trail) * gridI * (0.7 + uBass * 1.7 + uActivity * 1.1);

        // Soft glow pooling under the cursor.
        float md = length(P - uMouse.xz);
        float mouseGlow = exp(-(md * md) / (uGrid * uGrid * 16.0));

        // Emissive aurora band where the grid converges (the horizon), with a
        // gentle shimmer so it feels alive.
        float shimmer = 0.85 + 0.15 * sin(P.x * 0.05 + uTime * 0.6);
        float horizon = smoothstep(56.0, 96.0, dist) * (1.0 - smoothstep(96.0, 118.0, dist)) * shimmer;

        // Colour: cyan near → mint far (zone-tinted), with the aurora horizon on top.
        float farT = smoothstep(8.0, 92.0, dist);
        vec3 lineCol = mix(uColor, uColor2, farT);

        float bright = gridI * depthFade * (0.55 + energy);
        bright += pulse * depthFade;
        bright += mouseGlow * (0.8 + energy) * depthFade;

        vec3 col = lineCol * bright;
        col += uHorizon * horizon * (0.55 + uTreble * 0.5 + uBass * 0.3);
        col += uColor * mouseGlow * 0.18 * depthFade;
        // Pulse heads bloom toward white for a hot leading edge.
        col += vec3(1.0) * head * gridI * depthFade * (0.25 + uBass * 0.5);

        float alpha = clamp(bright + horizon * 0.7, 0.0, 1.5) * uOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;          // lay it flat (XZ plane)
  mesh.position.set(0, FLOOR_Y, -55);       // below the scene, receding into -z
  mesh.renderOrder = -1;                     // draw beneath the lit instrument
  scene.add(mesh);

  // Cursor → floor point, for the proximity glow. Self-contained; skipped on touch.
  const ndc = new THREE.Vector2(0, -2);
  let hasPointer = false;
  function onMove(ev) {
    ndc.x = (ev.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -((ev.clientY / window.innerHeight) * 2 - 1);
    hasPointer = true;
  }
  if (!mobile) window.addEventListener("pointermove", onMove, { passive: true });

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
  const hit = new THREE.Vector3();
  const _tint = new THREE.Color();
  const _mint = new THREE.Color();
  const _white = new THREE.Color();
  const _near = new THREE.Color();
  let lightState = -1;

  function applyPalette(light) {
    const p = light ? PAL.light : PAL.dark;
    _near.setHex(p.near);
    uniforms.uColor.value.setHex(p.near);
    uniforms.uColor2.value.setHex(p.far);
    uniforms.uHorizon.value.setHex(p.horizon);
    uniforms.uOpacity.value = p.opacity;
    _mint.setHex(p.mint);
    _white.setHex(p.white);
    // Additive glows beautifully on black; on white it washes out, so use normal
    // blending in light mode (mirrors field.js).
    mat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    mat.needsUpdate = true;
  }
  applyPalette(false);

  function update(dt, e, camera, blend) {
    uniforms.uTime.value = e.t;
    uniforms.uBass.value = e.bass;
    uniforms.uMid.value = e.mid;
    uniforms.uTreble.value = e.treble;
    uniforms.uActivity.value = e.activity;
    uniforms.uCalm.value = e.calm;
    uniforms.uBreath.value = e.breath;

    const light = e.light ? 1 : 0;
    if (light !== lightState) { lightState = light; uniforms.uLight.value = light; applyPalette(!!light); }

    if (camera) uniforms.uCam.value.copy(camera.position);

    // Far colour drifts toward the active zone (mint in Practice, cool-white in
    // Coach); brass stays off the floor.
    _tint.copy(_near);
    if (blend && blend.weights) {
      _tint.lerp(_mint, Math.min(1, blend.weights.practice || 0));
      _tint.lerp(_white, Math.min(1, (blend.weights.coach || 0) * 0.8));
    }
    uniforms.uColor2.value.lerp(_tint, 0.04);

    // Project the cursor onto the floor for the proximity glow.
    if (hasPointer && camera) {
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.lerp(hit, 0.18);
    }
  }

  function dispose() {
    window.removeEventListener("pointermove", onMove);
    scene.remove(mesh);
    geo.dispose();
    mat.dispose();
  }

  return { mesh, update, dispose };
}
