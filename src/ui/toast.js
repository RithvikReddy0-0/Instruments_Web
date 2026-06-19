/**
 * Toast notifications — a reusable, accessible layer driven by the EventBus.
 * Anywhere in the app: bus.emit("toast", { message, kind, duration }).
 * kind: "info" | "success" | "warn". Region is aria-live polite.
 */

export function initToasts({ bus, mount }) {
  const region = document.createElement("div");
  region.className = "toast-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "false");
  (mount || document.body).appendChild(region);

  const ICONS = { success: "✓", info: "•", warn: "!" };

  function show({ message, kind = "info", duration = 3200 }) {
    if (!message) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${ICONS[kind] || "•"}</span><span class="toast-msg"></span><button class="toast-close" type="button" aria-label="Dismiss">×</button>`;
    toast.querySelector(".toast-msg").textContent = message;
    region.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    const dismiss = () => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector(".toast-close").addEventListener("click", dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
  }

  bus.on("toast", show);
  return { show };
}
