/**
 * PWA runtime: service-worker registration, update flow, install CTA, and an
 * offline indicator. All UI is created on demand and announced via aria-live.
 */

export function initPWA({ bus, installButton }) {
  setupOffline(bus);
  setupInstall(installButton, bus);
  if ("serviceWorker" in navigator && import.meta.env.PROD) setupServiceWorker(bus);
}

function banner(id, html) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "app-banner";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.hidden = false;
  return el;
}

function setupServiceWorker(bus) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        // A new worker is installed while an old one controls the page → update ready.
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          const el = banner("updateBanner",
            `<span>A new version is available.</span><button class="app-banner-btn" id="updateReload" type="button">Reload</button>`);
          el.querySelector("#updateReload").addEventListener("click", () => {
            reg.waiting?.postMessage("SKIP_WAITING");
            sw.postMessage("SKIP_WAITING");
          });
          bus?.emit("toast", { message: "New version available", kind: "info" });
        }
      });
    });
  }).catch(() => {});

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function setupInstall(installButton, bus) {
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    installButton.hidden = true;
    if (outcome === "accepted") bus?.emit("toast", { message: "Installing InstrumentHub…", kind: "success" });
  });
  window.addEventListener("appinstalled", () => {
    if (installButton) installButton.hidden = true;
    bus?.emit("toast", { message: "InstrumentHub installed", kind: "success" });
  });
}

function setupOffline(bus) {
  const sync = () => {
    const el = banner("offlineBanner", `<span>● You're offline — InstrumentHub still works.</span>`);
    if (navigator.onLine) { el.hidden = true; } else { el.hidden = false; }
  };
  window.addEventListener("online", () => { sync(); bus?.emit("toast", { message: "Back online", kind: "success" }); });
  window.addEventListener("offline", () => { sync(); bus?.emit("toast", { message: "You're offline", kind: "info" }); });
  sync();
}
