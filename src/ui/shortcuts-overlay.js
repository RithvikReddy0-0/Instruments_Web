/**
 * Keyboard shortcut reference — press "?" to open. Grouped, accessible, esc to
 * close, focus restored on close.
 */

const GROUPS = [
  { title: "Global", items: [
    ["Ctrl / ⌘ + K", "Command palette"],
    ["?", "This shortcut guide"],
    ["Space", "Toggle metronome"]
  ] },
  { title: "Playing", items: [
    ["A S D F …", "Play mapped notes"],
    ["Octave / Volume", "Bottom dock controls"]
  ] },
  { title: "Recording", items: [
    ["Ctrl + R", "Start recording"],
    ["Ctrl + S", "Stop recording"],
    ["Ctrl + P", "Replay take"]
  ] },
  { title: "Studio piano roll", items: [
    ["Draw tool + click", "Add note"],
    ["Arrow keys", "Nudge selected note"],
    ["Delete", "Remove selected note"],
    ["Ctrl + scroll", "Zoom"]
  ] },
  { title: "Practice", items: [
    ["1–4", "Choose multiple-choice answer"]
  ] }
];

export function initShortcutsOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "sk-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="sk-backdrop" data-close></div>
    <div class="sk-panel" role="dialog" aria-modal="true" aria-labelledby="skTitle">
      <div class="sk-head"><h2 id="skTitle">Keyboard shortcuts</h2><button class="sk-close" data-close type="button" aria-label="Close">×</button></div>
      <div class="sk-groups">${GROUPS.map((g) => `
        <div class="sk-group"><h3>${g.title}</h3>${g.items.map(([k, d]) => `
          <div class="sk-row"><span>${d}</span><kbd>${k}</kbd></div>`).join("")}</div>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let lastFocus = null;

  const open = () => { lastFocus = document.activeElement; overlay.hidden = false; overlay.querySelector(".sk-close").focus(); };
  const close = () => { overlay.hidden = true; lastFocus?.focus?.(); };

  overlay.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "?" && !e.target.matches?.("input, select, textarea")) { e.preventDefault(); overlay.hidden ? open() : close(); }
  });
  return { open, close };
}
