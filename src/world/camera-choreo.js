/**
 * Per-zone camera choreography for the persistent world.
 *
 * Each workspace gets its own camera character, BLENDED by the same scroll
 * weights that morph the universe — so the move evolves continuously as you
 * travel, never snapping between sections:
 *
 *   Theory   → orbits the celestial machine (wonder)
 *   Practice → pushes forward into the arena (drive)
 *   Coach    → slow exploratory drift, observing the network (intelligence)
 *   Studio   → converges on the reactor core (focus)
 *
 * Targets are eased (position + lookAt lerp) on top of mouse parallax + bass
 * depth, so the camera always feels alive but calm enough to sit behind content.
 */
import * as THREE from "three";

const ZONES = ["theory", "practice", "coach", "studio"];

export function createCameraChoreography() {
  const sp = new THREE.Vector3();
  const sl = new THREE.Vector3();
  const tgtP = new THREE.Vector3(0, 0, 6);
  const tgtL = new THREE.Vector3(0, 0, -9);
  const lookNow = new THREE.Vector3(0, 0, -9);

  // Writes the per-zone position (sp) + lookAt (sl) for time t / energy e.
  function zone(id, t, e) {
    switch (id) {
      case "theory":   // orbit the wheel
        sp.set(Math.sin(t * 0.16) * 3.4, 0.6 + Math.cos(t * 0.12) * 1.0, 6.2 + Math.cos(t * 0.16) * 1.8);
        sl.set(0, 0, -10.5); break;
      case "practice": // push forward into the arena
        sp.set(Math.sin(t * 0.3) * 0.5, 0.25, 3.6 - e.mid * 0.7 + Math.sin(t * 0.5) * 0.25);
        sl.set(0, 0, -11); break;
      case "coach":    // slow drift, observing
        sp.set(Math.sin(t * 0.07) * 2.8, 1.1 + Math.cos(t * 0.05) * 1.4, 6.8 + Math.sin(t * 0.045) * 1.0);
        sl.set(Math.sin(t * 0.06) * 1.3, 0.4, -10); break;
      case "studio":   // converge on the reactor core
        sp.set(Math.sin(t * 0.6) * 0.3 * (0.4 + e.bass), 0, 2.7 - e.bass * 0.9);
        sl.set(0, 0, -11.5); break;
      default:         // calm idle drift (hero / between)
        sp.set(Math.sin(t * 0.05) * 0.9, Math.cos(t * 0.04) * 0.5, 6 + Math.sin(t * 0.03) * 0.6);
        sl.set(0, 0, -9);
    }
  }

  function apply(camera, dt, e, blend, mouse) {
    const t = e.t;
    tgtP.set(0, 0, 0); tgtL.set(0, 0, 0);
    let norm = 0;
    if (blend && blend.weights) {
      for (const id of ZONES) {
        const w = blend.weights[id] || 0;
        if (w <= 0.001) continue;
        zone(id, t, e);
        tgtP.addScaledVector(sp, w);
        tgtL.addScaledVector(sl, w);
        norm += w;
      }
    }
    if (norm < 0.001) { zone("core", t, e); tgtP.copy(sp); tgtL.copy(sl); norm = 1; }
    tgtP.multiplyScalar(1 / norm);
    tgtL.multiplyScalar(1 / norm);

    // Mouse parallax + bass depth layered on the blended target.
    tgtP.x += mouse.x * 1.4;
    tgtP.y += -mouse.y * 1.0;
    tgtP.z += -e.bass * 0.8;

    // Ease toward the target so zone-to-zone is a smooth flight, never a cut.
    camera.position.lerp(tgtP, 0.045);
    lookNow.lerp(tgtL, 0.045);
    camera.lookAt(lookNow);
  }

  return { apply };
}
