/**
 * Cinematic handoff — "ENTER INSTRUMENTHUB".
 *
 * A brass whiteout wipes the 3D scene, then we tear everything down (dispose
 * GPU resources, kill ScrollTrigger, destroy Lenis, unlock app scroll) and
 * reveal the existing application at the top. The app was alive underneath the
 * whole time; we just stop covering it.
 */
export function enterApp(root, cleanup) {
  const flash = document.createElement("div");
  flash.className = "exp-flash";
  root.appendChild(flash);

  // Force a frame so the transition animates from 0.
  requestAnimationFrame(() => flash.classList.add("is-on"));

  window.setTimeout(() => {
    try {
      cleanup();
    } finally {
      document.documentElement.classList.remove("exp-active");
      root.remove();
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, 620);
}
