/**
 * Command palette (Ctrl/⌘+K) — keyboard-first launcher.
 *
 * Commands are injected by the app: { id, title, hint, section, keywords, run }.
 * Fuzzy-ish substring match over title + keywords; full keyboard navigation;
 * focus is restored to the previously-focused element on close.
 */

export function initCommandPalette({ commands }) {
  const overlay = document.createElement("div");
  overlay.className = "cmdk";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="cmdk-backdrop" data-close></div>
    <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <input class="cmdk-input" type="text" placeholder="Type a command…" aria-label="Search commands" autocomplete="off" spellcheck="false">
      <ul class="cmdk-list" role="listbox" aria-label="Commands"></ul>
      <div class="cmdk-foot"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> run · <kbd>esc</kbd> close</div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector(".cmdk-input");
  const list = overlay.querySelector(".cmdk-list");
  let filtered = [];
  let active = 0;
  let lastFocus = null;

  const score = (cmd, q) => {
    const hay = `${cmd.title} ${cmd.section || ""} ${(cmd.keywords || []).join(" ")}`.toLowerCase();
    return hay.includes(q);
  };

  function renderList() {
    list.innerHTML = filtered.map((c, i) => `
      <li class="cmdk-item ${i === active ? "active" : ""}" role="option" aria-selected="${i === active}" data-i="${i}">
        <span class="cmdk-title">${escapeHtml(c.title)}</span>
        ${c.section ? `<span class="cmdk-section">${escapeHtml(c.section)}</span>` : ""}
        ${c.hint ? `<kbd class="cmdk-hint">${escapeHtml(c.hint)}</kbd>` : ""}
      </li>`).join("") || `<li class="cmdk-empty">No matching commands</li>`;
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    filtered = q ? commands.filter((c) => score(c, q)) : commands.slice();
    active = 0;
    renderList();
  }

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    input.value = "";
    filter();
    requestAnimationFrame(() => input.focus());
  }
  function close() {
    overlay.hidden = true;
    lastFocus?.focus?.();
  }
  function run(i) {
    const cmd = filtered[i];
    if (!cmd) return;
    close();
    setTimeout(() => cmd.run(), 0);
  }

  input.addEventListener("input", filter);
  overlay.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
    const item = e.target.closest(".cmdk-item");
    if (item) run(Number(item.dataset.i));
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); renderList(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); renderList(); }
    else if (e.key === "Enter") { e.preventDefault(); run(active); }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      overlay.hidden ? open() : close();
    }
  });

  return { open, close };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
