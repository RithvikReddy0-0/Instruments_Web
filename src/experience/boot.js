/**
 * Experience layer — boot gate (the ONLY always-loaded experience code).
 *
 * Decides whether to run the immersive intro, then dynamic-imports the heavy
 * Three.js bundle so the application's critical path is never touched. Fully
 * progressive enhancement: if anything here bails, the user simply gets the app.
 *
 * Isolation contract: this layer imports nothing from Studio/Theory/Practice/
 * Coach/MIDI/PWA/StateManager/EventBus. Its only DOM touchpoints are the
 * #experience overlay root and (on enter) a scroll to the app.
 */
const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

async function run() {
  const root = document.getElementById("experience");
  if (!root) return;

  // The intro plays on EVERY load. (?nointro skips it; reduced-motion / no-WebGL
  // skip gracefully straight to the app.)
  const skip = new URL(window.location.href).searchParams.has("nointro");
  if (skip || !webglOK() || prefersReduced()) return;

  try {
    const mod = await import("./experience.js");
    mod.startExperience(root, { mobile: isMobile() });
  } catch (err) {
    console.warn("[experience] failed to start; continuing to app", err);
    root.remove();
    document.documentElement.classList.remove("exp-active");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run, { once: true });
} else {
  run();
}
