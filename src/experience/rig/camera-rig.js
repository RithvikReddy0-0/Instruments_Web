/**
 * Camera rig — progress-keyframe driven.
 *
 * Each keyframe is { p (0..1 scroll progress), pos, look }. Positions and look
 * targets ride Catmull-Rom curves for C1-smooth arcs, but they're SAMPLED by
 * scroll progress with per-segment smoothstep easing — so the camera settles
 * into each keyframe then accelerates between them, and keyframes can be packed
 * densely (e.g. the signature scene's orbit) to make the camera dwell and curve
 * exactly where we want. Replaces the index-uniform camera path.
 */
import * as THREE from "three";

export function createCameraRig(keyframes) {
  const kf = [...keyframes].sort((a, b) => a.p - b.p);
  const pVals = kf.map((k) => k.p);
  const posCurve = new THREE.CatmullRomCurve3(kf.map((k) => new THREE.Vector3(...k.pos)), false, "catmullrom", 0.5);
  const lookCurve = new THREE.CatmullRomCurve3(kf.map((k) => new THREE.Vector3(...k.look)), false, "catmullrom", 0.5);
  const K = kf.length;
  const _p = new THREE.Vector3();
  const _l = new THREE.Vector3();

  function apply(camera, progress) {
    const p = Math.min(pVals[K - 1], Math.max(pVals[0], progress));
    let i = 0;
    while (i < K - 2 && p > pVals[i + 1]) i += 1;
    const span = pVals[i + 1] - pVals[i] || 1;
    const u = Math.min(1, Math.max(0, (p - pVals[i]) / span));
    const eased = u * u * (3 - 2 * u); // smoothstep
    const t = (i + eased) / (K - 1);
    posCurve.getPoint(t, _p);
    lookCurve.getPoint(t, _l);
    camera.position.copy(_p);
    camera.lookAt(_l);
  }

  return { apply };
}
