/**
 * IH-1 power-on sequence.
 *
 * A short "the hardware just got power" boot, fired once when the user first
 * enables audio: a self-test sweep of the dock knobs and a settling LED —
 * compositor-only props (transform/opacity) so it stays cheap. Under
 * prefers-reduced-motion it no-ops (the UI is already in its resting state).
 * Idempotent: play() runs at most once.
 */
import gsap from "gsap";

export function initPowerOn({ onTick } = {}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let played = false;

  function play() {
    if (played) return;
    played = true;
    if (reduce) return;

    const knobInds = document.querySelectorAll("#hwDock .opus-knob-ind");
    const metroLed = document.querySelector("#metroBtn .opus-led");

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // 1) Knob self-test: each indicator sweeps its full arc and snaps back.
    if (knobInds.length) {
      tl.fromTo(knobInds,
        { rotate: -135 },
        { rotate: 135, duration: 0.32, stagger: 0.05, ease: "power1.inOut", transformOrigin: "bottom center" });
      tl.to(knobInds, { rotate: 0, duration: 0.3, stagger: 0.05, clearProps: "transform", onStart: () => onTick?.() });
    }

    // 2) Metro LED blinks, then rests off — the dock is "armed".
    if (metroLed) {
      tl.to(metroLed, { opacity: 1, duration: 0.08, repeat: 3, yoyo: true }, "<")
        .set(metroLed, { clearProps: "opacity" });
    }
  }

  return { play };
}
