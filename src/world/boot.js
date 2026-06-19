/**
 * World boot — the only always-loaded world code (tiny). Decides whether to run
 * the live WebGL world or fall back to a static cyan field, then dynamic-imports
 * the heavy bundle so the app's critical path is untouched.
 *
 * The world is independent of the intro: it boots on every app load and renders
 * as the persistent backdrop. While the intro overlay is on top it self-pauses,
 * so when the intro hands off the world is already there — the world continued.
 */
function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

function run() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;

  if (reduce || !webglOK()) {
    document.documentElement.classList.add("ih-world-static");
    window.IHWorld = { setAnalyser() {}, setZone() {}, pulse() {}, stop() {}, resume() {} };
    return;
  }
  import("./world.js")
    .then((m) => m.startWorld({ mobile }))
    .catch((err) => {
      console.warn("[world] failed to start; static fallback", err);
      document.documentElement.classList.add("ih-world-static");
    });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
else run();
