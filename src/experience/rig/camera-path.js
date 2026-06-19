/**
 * Camera path — a single Catmull-Rom spline through every scene's waypoint plus
 * the final CTA dive. Scroll progress (0→1) samples position and a parallel
 * look-at curve, so the camera settles into each scene then accelerates between
 * them (the per-segment easing is applied upstream by the eased scroll).
 */
import * as THREE from "three";

export function createCameraPath(waypoints) {
  const pts = waypoints.map((w) => new THREE.Vector3(...w.pos));
  const looks = waypoints.map((w) => new THREE.Vector3(...w.look));
  // CatmullRom needs ≥2 points; callers guarantee that.
  const posCurve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const lookCurve = new THREE.CatmullRomCurve3(looks, false, "catmullrom", 0.5);

  const _p = new THREE.Vector3();
  const _l = new THREE.Vector3();

  function apply(camera, t) {
    const tt = Math.min(1, Math.max(0, t));
    posCurve.getPoint(tt, _p);
    lookCurve.getPoint(tt, _l);
    camera.position.copy(_p);
    camera.lookAt(_l);
  }

  return { apply };
}
