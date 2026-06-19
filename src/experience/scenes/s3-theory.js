/**
 * Scene 3 — "The Theory Universe"  ·  THE SIGNATURE SCENE.
 *
 * The Circle of Fifths rendered as a celestial machine: concentric brass rings
 * (major keys outside, relative minors inside) turning at different speeds like
 * an astrolabe, threaded by the {12/5} fifths-star. A real chord progression —
 * computed live by the app's TheoryEngine — plays out as a constellation that
 * walks the wheel and resolves home, blooming on the tonic. Harmony made visible.
 *
 * Authenticity: the chord tones, their positions, and the relative-minor links
 * are REAL music theory from `TheoryEngine` (pure/stateless — imported read-only,
 * the one sanctioned exception to the experience layer's isolation). Nothing in
 * the theory module is modified.
 *
 * Scene contract: { group, waypoint, caption, update(dt, energy, intensity) }.
 * `intensity` is a 0→1 bell as the camera arrives, so the machine powers up to
 * full glory at the closest approach — the emotional peak.
 */
import * as THREE from "three";
import TheoryEngine from "../../theory/theory-engine.js";
import { PALETTE } from "../rig/materials.js";

const theory = new TheoryEngine();
const CIRCLE = theory.getCircle(); // 12 keys in fifths order, C at 0
const R = 4.3; // outer (major) radius
const r = 2.8; // inner (minor) radius

// A real progression that walks the wheel and resolves home (… V → I bloom).
const PROG = [["C", "major"], ["G", "major"], ["A", "minor"], ["F", "major"], ["D", "minor"], ["G", "major"]];
const CHORD_DUR = 1.9;

// Node index (0..11) on the fifths wheel for any note — pure theory.
const nodeOf = (note) => ((theory.fifthsOf(note) % 12) + 12) % 12;
// Angle for wheel index i: C(0) at top (12 o'clock), going clockwise.
const angleOf = (i) => Math.PI / 2 - (i / 12) * Math.PI * 2;
const ringXY = (i, rad) => [Math.cos(angleOf(i)) * rad, Math.sin(angleOf(i)) * rad];

function radialSprite(hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const cx = c.getContext("2d");
  const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = new THREE.Color(hex);
  g.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},1)`);
  g.addColorStop(1, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},0)`);
  cx.fillStyle = g;
  cx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTheoryScene() {
  const group = new THREE.Group();
  group.position.set(9, 3, -22);
  group.rotation.set(-0.22, 0, 0);

  // Counter-rotating rings make the "machine".
  const outer = new THREE.Group(); // major nodes, star, constellation — turn CW
  const inner = new THREE.Group(); // relative minors — turn CCW
  group.add(outer, inner);

  const majorPos = CIRCLE.map((_, i) => ringXY(i, R));
  const minorPos = CIRCLE.map((_, i) => ringXY(i, r));

  // Outer 12-gon outline + inner ring.
  const ringLine = (pts2, op) => new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([...pts2, pts2[0]].map(([x, y]) => new THREE.Vector3(x, y, 0))),
    new THREE.LineBasicMaterial({ color: PALETTE.brass, transparent: true, opacity: op })
  );
  const outerRing = ringLine(majorPos, 0.3);
  const innerRing = ringLine(minorPos, 0.18);
  outer.add(outerRing);
  inner.add(innerRing);

  // {12/5} fifths-star: connect every node to the one 5 steps away → one
  // continuous 12-point star. The geometric soul of the circle of fifths.
  const starPts = [];
  for (let i = 0; i < 12; i += 1) {
    const a = majorPos[i];
    const b = majorPos[(i + 5) % 12];
    starPts.push(new THREE.Vector3(a[0], a[1], 0), new THREE.Vector3(b[0], b[1], 0));
  }
  const star = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(starPts),
    new THREE.LineBasicMaterial({ color: PALETTE.brass2, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  outer.add(star);

  // Radial tick marks (astrolabe gauge).
  const tickPts = [];
  majorPos.forEach(([x, y]) => { tickPts.push(new THREE.Vector3(x * 1.04, y * 1.04, 0), new THREE.Vector3(x * 1.12, y * 1.12, 0)); });
  const ticks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tickPts),
    new THREE.LineBasicMaterial({ color: PALETTE.brass, transparent: true, opacity: 0.4 })
  );
  outer.add(ticks);

  // Major nodes (own materials so chord tones can flare individually).
  const nodeGeo = new THREE.IcosahedronGeometry(0.17, 2);
  const majorNodes = majorPos.map(([x, y]) => {
    const m = new THREE.Mesh(nodeGeo, new THREE.MeshStandardMaterial({
      color: PALETTE.brass, emissive: PALETTE.brass2, emissiveIntensity: 0.25, metalness: 0.85, roughness: 0.3
    }));
    m.position.set(x, y, 0);
    outer.add(m);
    return m;
  });

  // Relative-minor nodes as one Points cloud (one draw call) with per-point color.
  const minorGeo = new THREE.BufferGeometry();
  minorGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(minorPos.flatMap(([x, y]) => [x, y, 0])), 3));
  const minorCol = new Float32Array(12 * 3);
  minorGeo.setAttribute("color", new THREE.BufferAttribute(minorCol, 3));
  const minorPoints = new THREE.Points(minorGeo, new THREE.PointsMaterial({
    size: 0.16, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  inner.add(minorPoints);

  // Chord constellation (3 edges) + a nebula glow at its centroid.
  const conGeo = new THREE.BufferGeometry();
  conGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18), 3));
  const constellation = new THREE.LineSegments(conGeo, new THREE.LineBasicMaterial({
    color: PALETTE.cyan, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  outer.add(constellation);

  const nebulaTex = radialSprite(PALETTE.cyan);
  const nebula = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTex, color: PALETTE.cyan, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  nebula.scale.setScalar(2.2);
  outer.add(nebula);

  // Tonic "sun" at the centre + a bloom ring for the resolution.
  const sun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 4),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass2, emissive: PALETTE.brass2, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.25 })
  );
  group.add(sun);
  const sunGlowTex = radialSprite(PALETTE.brass2);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunGlowTex, color: PALETTE.brass2, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunGlow.scale.setScalar(2.4);
  group.add(sunGlow);

  const bloom = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.03, 8, 128),
    new THREE.MeshBasicMaterial({ color: PALETTE.mint, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(bloom);

  // Local starfield for depth.
  const STARS = 520;
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i += 1) {
    const rad = 5 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    sp[i * 3] = rad * Math.sin(ph) * Math.cos(th);
    sp[i * 3 + 1] = rad * Math.sin(ph) * Math.sin(th);
    sp[i * 3 + 2] = rad * Math.cos(ph) - 2;
  }
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const starfield = new THREE.Points(sg, new THREE.PointsMaterial({ color: PALETTE.brass, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(starfield);

  // Fixed astrolabe pointer at 12 o'clock (does not rotate with the wheel).
  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 4),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass, emissive: PALETTE.brass2, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.3 })
  );
  pointer.position.set(0, R + 0.5, 0);
  pointer.rotation.z = Math.PI;
  group.add(pointer);

  // --- Chord state ---
  const dimMinor = new THREE.Color(PALETTE.brass).multiplyScalar(0.25);
  const hotMinor = new THREE.Color(PALETTE.mint);
  let activeNodes = [];
  let relMinorIdx = -1;
  let lastIdx = -1;
  let bloomLife = 0;
  const _v = new THREE.Vector3();

  function setChord(idx) {
    const [rootName, type] = PROG[idx];
    const tones = theory.getChord(rootName, type); // REAL chord tones
    activeNodes = [...new Set(tones.map(nodeOf))];
    relMinorIdx = nodeOf(rootName); // relative minor shares the wheel index

    // Write the constellation edges (root→3rd→5th→root).
    const arr = conGeo.attributes.position.array;
    const pts = activeNodes.map((n) => majorPos[n]);
    const edges = [];
    for (let k = 0; k < pts.length; k += 1) { edges.push(pts[k], pts[(k + 1) % pts.length]); }
    for (let k = 0; k < 6; k += 1) { const p = edges[k] || pts[0]; arr[k * 3] = p[0]; arr[k * 3 + 1] = p[1]; arr[k * 3 + 2] = 0; }
    conGeo.attributes.position.needsUpdate = true;

    // Nebula at the chord centroid.
    let cx = 0; let cy = 0;
    pts.forEach(([x, y]) => { cx += x; cy += y; });
    nebula.position.set(cx / pts.length, cy / pts.length, 0.05);
  }

  let t = 0;
  function update(dt, energy, intensity = 0) {
    t += dt;
    const power = 0.3 + intensity * 0.7; // machine powers up as camera arrives
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);

    // Advance the progression; bloom when it resolves home (index 0).
    const idx = Math.floor(t / CHORD_DUR) % PROG.length;
    if (idx !== lastIdx) {
      lastIdx = idx;
      setChord(idx);
      if (idx === 0) bloomLife = 1;
    }

    // Differential rotation = the celestial machine.
    outer.rotation.z = -t * 0.06;
    inner.rotation.z = t * 0.045;

    const activeSet = new Set(activeNodes);
    majorNodes.forEach((m, i) => {
      const on = activeSet.has(i);
      m.material.emissiveIntensity = (on ? 1.0 + pulse * 0.5 + energy * 1.6 : 0.22 + energy * 0.18) * power;
      m.scale.setScalar(on ? 1.45 + energy * 0.4 : 1);
    });

    // Minor points: relative minor of current chord glows mint.
    const mc = minorGeo.attributes.color.array;
    for (let i = 0; i < 12; i += 1) {
      const on = i === relMinorIdx;
      const c = on ? hotMinor : dimMinor;
      const k = (on ? 1 : 0.5) * power;
      mc[i * 3] = c.r * k; mc[i * 3 + 1] = c.g * k; mc[i * 3 + 2] = c.b * k;
    }
    minorGeo.attributes.color.needsUpdate = true;

    constellation.material.opacity = (0.45 + energy * 0.4 + pulse * 0.15) * power;
    nebula.material.opacity = (0.25 + energy * 0.4) * power;
    nebula.scale.setScalar(1.8 + energy * 1.2 + bloomLife * 1.5);
    star.material.opacity = (0.1 + energy * 0.18 + pulse * 0.05) * power;
    outerRing.material.opacity = (0.22 + energy * 0.2) * power;

    // Tonic sun + glow.
    sun.material.emissiveIntensity = (0.7 + pulse * 0.3 + energy * 1.0 + bloomLife * 2.5) * (0.6 + power);
    sun.scale.setScalar(1 + pulse * 0.06 + energy * 0.15 + bloomLife * 0.6);
    sunGlow.material.opacity = (0.35 + energy * 0.3 + bloomLife * 0.5) * power;
    sunGlow.scale.setScalar(2.2 + bloomLife * 2.5 + energy);

    // Resolution bloom ring.
    bloomLife = Math.max(0, bloomLife - dt * 0.9);
    if (bloomLife > 0) {
      const k = 1 - bloomLife;
      bloom.visible = true;
      bloom.scale.setScalar(0.3 + k * 5.5);
      bloom.material.opacity = bloomLife * 0.8 * power;
    } else {
      bloom.visible = false;
    }

    starfield.rotation.y += dt * 0.01;
    starfield.material.opacity = (0.3 + energy * 0.3) * power;
    pointer.material.emissiveIntensity = 0.4 + pulse * 0.3 * power;
  }

  function dispose() {
    nodeGeo.dispose();
    [outerRing, innerRing, star, ticks, constellation, minorPoints, starfield, bloom, sun].forEach((o) => {
      o.geometry?.dispose?.(); o.material?.dispose?.();
    });
    majorNodes.forEach((m) => m.material.dispose());
    [nebulaTex, sunGlowTex].forEach((tx) => tx.dispose());
    nebula.material.dispose();
    sunGlow.material.dispose();
    pointer.geometry.dispose();
    pointer.material.dispose();
  }

  return {
    group,
    waypoint: { pos: [9, 3.2, -15.6], look: [9, 3, -22] },
    caption: { title: "The Theory Universe", sub: "Harmony, made visible." },
    update,
    dispose
  };
}
