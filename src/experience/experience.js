/**
 * Experience orchestrator.
 *
 * Owns the Three.js Stage, the Lenis smooth-scroll, and the GSAP ScrollTrigger
 * choreography, and wires scroll progress → camera path + per-scene updates +
 * caption reveals. One rAF (gsap.ticker) drives Lenis and the renderer together.
 *
 * Scroll isolation: the experience scrolls inside its OWN fixed wrapper (Lenis
 * `wrapper`/`content`), and `html.exp-active` freezes the document, so the
 * intro's scroll never fights the application's scroll. On enter we reverse all
 * of it.
 *
 * Vertical slice: Scene 1 + CTA wired end-to-end. The scenes[] array, camera
 * waypoints, caption DOM, and scroll-track height are all derived from the list,
 * so scenes 2–6 drop in by appending to `scenes`.
 */
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";

import "./experience.css";
import { createStage } from "./stage.js";
import { createParticles } from "./rig/particles.js";
import { createCameraRig } from "./rig/camera-rig.js";
import { createAudioReact } from "./audio-react.js";
import { createNoteScene } from "./scenes/s1-note.js";
import { createInstrumentScene } from "./scenes/s2-instrument.js";
import { createTheoryScene } from "./scenes/s3-theory.js";
import { createPracticeScene } from "./scenes/s4-practice.js";
import { createCoachScene } from "./scenes/s5-coach.js";
import { createStudioScene } from "./scenes/s6-studio.js";
import { enterApp } from "./enter.js";

gsap.registerPlugin(ScrollTrigger);

export function startExperience(root, { mobile }) {
  document.documentElement.classList.add("exp-active");
  root.hidden = false;
  root.innerHTML = `
    <div class="exp-wrapper" id="expWrapper"><div class="exp-track" id="expTrack"></div></div>
    <canvas class="exp-canvas" id="expCanvas"></canvas>
    <div class="exp-ui">
      <div class="exp-captions" id="expCaptions"></div>
      <div class="exp-scrollhint" id="expHint" aria-hidden="true"><span>Scroll</span></div>
      <div class="exp-cta" id="expCta"><button class="exp-enter" id="expEnter" type="button">Enter InstrumentHub</button></div>
      <button class="exp-skip" id="expSkip" type="button">Skip intro →</button>
    </div>`;

  const wrapper = root.querySelector("#expWrapper");
  const track = root.querySelector("#expTrack");
  const captionsEl = root.querySelector("#expCaptions");
  const ctaEl = root.querySelector("#expCta");

  // --- 3D set + reusable rigs ---
  const stage = createStage(root.querySelector("#expCanvas"), { mobile });
  const particles = createParticles(stage.scene, { count: mobile ? 2500 : 11000 });
  const audio = createAudioReact();

  // --- Scenes 1–6 (full journey) ---
  const scenes = [
    createNoteScene(), createInstrumentScene(), createTheoryScene(),
    createPracticeScene(), createCoachScene(), createStudioScene()
  ];
  scenes.forEach((s) => stage.scene.add(s.group));

  // Caption DOM, one per scene.
  scenes.forEach((s) => {
    const c = document.createElement("div");
    c.className = "exp-caption";
    c.innerHTML = `<h2>${s.caption.title}</h2><p>${s.caption.sub}</p>`;
    captionsEl.appendChild(c);
  });

  // --- Scene weights: the signature scene (Theory) gets extra dwell so it reads
  //     as the emotional peak. Windows + track length + camera all derive here. ---
  const SIGNATURE = 2;
  const weights = scenes.map((_, i) => (i === SIGNATURE ? 2.4 : 1));
  const ctaWeight = 1;
  const totalW = weights.reduce((a, b) => a + b, 0) + ctaWeight;

  // Progress windows [a,b] per scene (weighted) + the CTA window.
  const windows = [];
  let acc = 0;
  weights.forEach((w) => { windows.push([acc / totalW, (acc + w) / totalW]); acc += w; });
  const ctaWindow = [acc / totalW, 1];
  const center = (i) => (windows[i][0] + windows[i][1]) / 2;

  // Bell envelope (0 at window edges → 1 at centre), used to swell each scene as
  // the camera arrives — the signature scene blooms on this.
  function intensityAt(p, i) {
    const [a, b] = windows[i];
    if (p < a || p > b) return 0;
    return Math.sin(Math.PI * ((p - a) / (b - a || 1)));
  }

  // Scroll length scales with total weight (dwell = real scroll distance).
  track.style.height = `${totalW * 100}vh`;

  // --- Camera keyframes (progress-driven). The signature scene gets a 3-point
  //     orbit that arcs across the front of the machine and pushes in. ---
  const lastWp = scenes[scenes.length - 1].waypoint;
  const dive = { pos: lastWp.pos.map((v, i) => v + (lastWp.look[i] - v) * 0.9), look: lastWp.look };
  const keyframes = [{ p: 0, pos: scenes[0].waypoint.pos, look: scenes[0].waypoint.look }];
  scenes.forEach((s, i) => {
    if (i === SIGNATURE) {
      const C = s.waypoint.look; // machine centre
      const [a, b] = windows[i];
      const at = (f) => a + (b - a) * f;
      keyframes.push({ p: at(0.18), pos: [C[0] - 4.6, C[1] + 2.6, C[2] + 9.2], look: C });
      keyframes.push({ p: at(0.5), pos: [C[0] + 0.2, C[1] + 0.3, C[2] + 5.4], look: C });
      keyframes.push({ p: at(0.82), pos: [C[0] + 4.0, C[1] + 1.7, C[2] + 7.8], look: C });
    } else {
      keyframes.push({ p: center(i), pos: s.waypoint.pos, look: s.waypoint.look });
    }
  });
  keyframes.push({ p: 1, pos: dive.pos, look: dive.look });
  const rig = createCameraRig(keyframes);

  // --- Lenis smooth scroll on our own wrapper (not the document) ---
  const lenis = new Lenis({ wrapper, content: track, lerp: 0.09, smoothWheel: true });

  ScrollTrigger.scrollerProxy(wrapper, {
    scrollTop(value) {
      if (arguments.length) lenis.scrollTo(value, { immediate: true });
      return lenis.scroll;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    }
  });
  lenis.on("scroll", ScrollTrigger.update);

  // Master progress driver (real ScrollTrigger, scrubbed).
  const state = { progress: 0 };
  const master = ScrollTrigger.create({
    trigger: track,
    scroller: wrapper,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => { state.progress = self.progress; }
  });

  // Choreography is driven from the master's normalized progress (0→1 over the
  // REACHABLE scroll range) in the frame loop — see updateChoreography(). This
  // avoids "% top" sub-triggers, whose windows map onto the tall track and push
  // the final (CTA) segment past the reachable maximum.
  const hintEl = root.querySelector("#expHint");
  const captionEls = [...captionsEl.children];
  captionEls.forEach((el, i) => { el.style.opacity = i === 0 ? "1" : "0"; });

  // Caption opacity envelope within a scene's [a,b] progress window: the opening
  // caption is visible from the very top; later ones fade in, hold, fade out.
  function captionOpacity(p, a, b, first) {
    if (p < a || p > b) return 0;
    const u = (p - a) / (b - a || 1);
    if (first) return u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.3);
    if (u < 0.28) return u / 0.28;
    if (u > 0.72) return Math.max(0, 1 - (u - 0.72) / 0.28);
    return 1;
  }

  const ctaStart = ctaWindow[0]; // CTA owns the final (weighted) segment
  function updateChoreography(p) {
    captionEls.forEach((el, i) => {
      const o = captionOpacity(p, windows[i][0], windows[i][1], i === 0);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`;
    });
    ctaEl.classList.toggle("is-on", p >= ctaStart);
    hintEl.classList.toggle("is-hidden", p > 0.02);
  }

  // --- Single rAF: Lenis + renderer together (no duplicate loops) ---
  function frame(time, deltaMS) {
    lenis.raf(time * 1000);
    const dt = Math.min(0.05, deltaMS / 1000);
    const e = audio.energy(dt);
    rig.apply(stage.camera, state.progress);
    updateChoreography(state.progress);
    particles.update(dt, e);
    // Only render + animate scenes near the current progress (the last scene
    // stays live through the CTA dive). Far scenes are spatially separated, so
    // culling them keeps the heaviest moments — like the signature scene — at
    // full frame rate instead of paying for the whole journey every frame.
    const p = state.progress;
    scenes.forEach((s, i) => {
      const [a, b] = windows[i];
      const vis = (p >= a - 0.12 && p <= b + 0.12) || (i === scenes.length - 1 && p >= a);
      s.group.visible = vis;
      if (vis) s.update(dt, e, intensityAt(p, i));
    });
    stage.key.intensity = 40 + e * 60; // dynamic lighting reacts to energy
    stage.render(dt);
  }
  gsap.ticker.add(frame);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.refresh();

  // Pause rendering when the tab is hidden.
  function onVisibility() {
    if (document.hidden) gsap.ticker.remove(frame);
    else gsap.ticker.add(frame);
  }
  document.addEventListener("visibilitychange", onVisibility);

  // --- Teardown + handoff ---
  function cleanup() {
    gsap.ticker.remove(frame);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("keydown", onKey);
    master.kill();
    ScrollTrigger.getAll().forEach((t) => { if (t.scroller === wrapper) t.kill(); });
    lenis.destroy();
    scenes.forEach((s) => s.dispose());
    particles.dispose();
    stage.dispose();
  }
  const enter = () => enterApp(root, cleanup);

  function onKey(e) { if (e.key === "Escape") enter(); }
  document.addEventListener("keydown", onKey);
  root.querySelector("#expEnter").addEventListener("click", enter);
  root.querySelector("#expSkip").addEventListener("click", enter);
}
