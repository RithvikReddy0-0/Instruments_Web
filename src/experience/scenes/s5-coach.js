/**
 * Scene 5 — "The Coach Intelligence Layer".
 *
 * A layered neural lattice (a skill-graph): nodes in columns, fully wired to the
 * next column. A signal "front" sweeps left→right, lighting nodes and edges in
 * sequence like forward propagation — intelligence you can watch think. Edge
 * colors are written per-frame via vertex colors (one draw call for all wires).
 * Scene contract: { group, waypoint, caption, update, dispose }.
 */
import * as THREE from "three";
import { PALETTE } from "../rig/materials.js";

const LAYERS = [4, 6, 6, 3];
const COL_X = [-3, -1, 1, 3];

export function createCoachScene() {
  const group = new THREE.Group();
  group.position.set(6, 4, -38);
  group.rotation.set(-0.1, 0.4, 0); // 3/4 view shows the lattice depth

  // Build nodes column by column.
  const nodeGeo = new THREE.IcosahedronGeometry(0.15, 2);
  const layers = LAYERS.map((count, li) => {
    const arr = [];
    for (let i = 0; i < count; i += 1) {
      const y = count === 1 ? 0 : (i / (count - 1) - 0.5) * 4.2;
      const z = (Math.random() - 0.5) * 0.8;
      const mesh = new THREE.Mesh(
        nodeGeo,
        new THREE.MeshStandardMaterial({ color: PALETTE.brass, emissive: PALETTE.brass2, emissiveIntensity: 0.25, metalness: 0.8, roughness: 0.3 })
      );
      mesh.position.set(COL_X[li], y, z);
      group.add(mesh);
      arr.push(mesh);
    }
    return arr;
  });
  const allNodes = layers.flat();

  // Fully-connected edges between consecutive columns → one LineSegments.
  const edges = [];
  for (let li = 0; li < layers.length - 1; li += 1) {
    layers[li].forEach((a) => layers[li + 1].forEach((b) => edges.push({ a, b, midX: (a.position.x + b.position.x) / 2 })));
  }
  const edgeGeo = new THREE.BufferGeometry();
  const epos = new Float32Array(edges.length * 6);
  const ecol = new Float32Array(edges.length * 6);
  edges.forEach((e, k) => {
    epos.set([e.a.position.x, e.a.position.y, e.a.position.z, e.b.position.x, e.b.position.y, e.b.position.z], k * 6);
  });
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(epos, 3));
  edgeGeo.setAttribute("color", new THREE.BufferAttribute(ecol, 3));
  const edgeLines = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(edgeLines);

  const dim = new THREE.Color(PALETTE.brass).multiplyScalar(0.22);
  const hot = new THREE.Color(PALETTE.cyan);
  const _c = new THREE.Color();

  let t = 0;
  function update(dt, energy) {
    t += dt;
    // Propagation front sweeps the x-range and loops.
    const cycle = (t * (0.45 + energy * 0.5)) % 1;
    const frontX = -3.8 + cycle * 7.6;

    const colAttr = edgeGeo.attributes.color.array;
    edges.forEach((e, k) => {
      const d = (e.midX - frontX) / 0.7;
      const b = Math.exp(-d * d) * (0.8 + energy * 0.6);
      _c.copy(dim).lerp(hot, Math.min(1, b));
      colAttr.set([_c.r, _c.g, _c.b, _c.r, _c.g, _c.b], k * 6);
    });
    edgeGeo.attributes.color.needsUpdate = true;

    allNodes.forEach((m) => {
      const d = (m.position.x - frontX) / 0.7;
      const b = Math.exp(-d * d);
      m.material.emissiveIntensity = 0.22 + b * (1.6 + energy * 1.8);
      m.material.emissive.copy(_c.copy(dim).lerp(hot, b)).addScalar(0.1);
      m.scale.setScalar(1 + b * 0.5);
    });
    group.rotation.y = 0.4 + Math.sin(t * 0.25) * 0.07;
  }

  function dispose() {
    nodeGeo.dispose();
    edgeGeo.dispose();
    edgeLines.material.dispose();
    allNodes.forEach((m) => m.material.dispose());
  }

  return {
    group,
    waypoint: { pos: [6, 4, -31], look: [6, 4, -38] },
    caption: { title: "The Coach Intelligence Layer", sub: "Where signals become insight." },
    update,
    dispose
  };
}
