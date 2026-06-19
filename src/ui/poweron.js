/**
 * IH-1 power-on sequence.
 *
 * A short "the hardware just got power" boot, fired once when the user first
 * enables audio. Self-test sweep of the dock knobs, a stagger-lit demo panel,
 * and a settling LED — compositor-only props (transform/opacity/filter) so it
 * stays cheap. Under prefers-reduced-motion it no-ops (the UI is already in its
 * resting state). Idempotent: play() runs at most once.
 */
import gsap from "gsap";

export function initPowerOn({ onTick } = {}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let played = false;

  function play() {
    if (played) return;
    played = true;
    if (reduce) return;

    const panel = document.querySelector(".hero-panel");
    const keys = document.querySelectorAll(".mini-keys span");
    const bars = document.querySelectorAll(".mini-wave i");
    const knobInds = document.querySelectorAll("#hwDock .opus-knob-ind");
    const metroLed = document.querySelector("#metroBtn .opus-led");

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // 1) Panel flickers awake.
    if (panel) {
      tl.fromTo(panel,
        { filter: "brightness(0.4)" },
        { filter: "brightness(1.25)", duration: 0.12, repeat: 1, yoyo: true });
      tl.to(panel, { filter: "brightness(1)", duration: 0.2 });
    }

    // 2) Knob self-test: each indicator sweeps its full arc and snaps back.
    if (knobInds.length) {
      tl.fromTo(knobInds,
        { rotate: -135 },
        { rotate: 135, duration: 0.32, stagger: 0.05, ease: "power1.inOut", transformOrigin: "bottom center" }, "<");
      tl.to(knobInds, { rotate: 0, duration: 0.3, stagger: 0.05, clearProps: "transform", onStart: () => onTick?.() });
    }

    // 3) Demo keys and meters stagger to life.
    if (keys.length) tl.fromTo(keys, { opacity: 0.25, y: 4 }, { opacity: 1, y: 0, duration: 0.22, stagger: 0.04 }, "<0.1");
    if (bars.length) tl.fromTo(bars, { scaleY: 0.2 }, { scaleY: 1, duration: 0.3, stagger: 0.03, transformOrigin: "bottom", clearProps: "transform" }, "<");

    // 4) Metro LED blinks twice, then rests off — the panel is "armed".
    if (metroLed) {
      tl.to(metroLed, { opacity: 1, duration: 0.08, repeat: 3, yoyo: true }, "<")
        .set(metroLed, { clearProps: "opacity" });
    }
  }

  return { play };
}
