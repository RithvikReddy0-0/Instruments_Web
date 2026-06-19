/**
 * Motion system (GSAP). Three coherent motions only — load intro, scroll reveal,
 * and panel choreography. Compositor-only properties (opacity/transform), each
 * element animated once. Fully disabled under prefers-reduced-motion so content
 * is simply present (progressive enhancement).
 */

import gsap from "gsap";

export function initMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // 1) Load intro — header + hero settle in, then the scroll cue surfaces last.
  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro.from(".site-header", { y: -18, opacity: 0, duration: 0.45 })
    .from(".hero-content > *", { y: 22, opacity: 0, duration: 0.7, stagger: 0.09 }, "-=0.2")
    .from(".hero-scrollcue", { opacity: 0, duration: 0.6 }, "-=0.2");

  // 2) Scroll reveal — each section's blocks rise + stagger once on entry.
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const targets = entry.target.querySelectorAll(":scope > *");
      gsap.from(targets, { y: 22, opacity: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", overwrite: "auto" });
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

  document.querySelectorAll(".section:not(.hero-section), .playground-shell").forEach((el) => revealObserver.observe(el));

  // 3) Panel choreography — Theory & Coach re-renders cross-fade. (Practice is
  //    intentionally excluded: it re-renders every answer and would flicker.)
  ["#twPanel", "#coachWorkspace"].forEach((sel) => {
    const node = document.querySelector(sel);
    if (!node) return;
    const observer = new MutationObserver(() => {
      gsap.fromTo(node.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, stagger: 0.025, ease: "power2.out", overwrite: "auto" });
    });
    observer.observe(node, { childList: true });
  });
}
