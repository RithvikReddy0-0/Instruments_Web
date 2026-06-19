/**
 * OPUS — Hardware Component Kit (POCKET).
 *
 * Framework-free factories that build tactile, accessible controls (knob, fader,
 * keycap, toggle, LCD, LED, transport) styled by the `.opus-*` rules in
 * style.css. Each returns { el, ... } so workspaces (stage 3) can mount and wire
 * them. Interactive controls carry full slider/switch ARIA + keyboard support.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

/** Rotary knob. Drag vertically, scroll, or arrow-key to change. */
export function createKnob({ min = 0, max = 100, value = 50, step = 1, label = "", unit = "", size = 64, format, onChange } = {}) {
  const wrap = el("div", "opus-control opus-knob-wrap");
  const knob = el("button", "opus-knob");
  knob.type = "button";
  knob.style.setProperty("--knob-size", `${size}px`);
  knob.setAttribute("role", "slider");
  knob.append(el("span", "opus-knob-face"), el("span", "opus-knob-ind"));
  const ind = knob.querySelector(".opus-knob-ind");
  const readout = el("span", "opus-readout opus-knob-val");
  const lab = el("span", "opus-label");
  lab.textContent = label;
  wrap.append(knob, readout, lab);

  let val = clamp(value, min, max);
  const fmt = (v) => `${format ? format(v) : Math.round(v)}${unit ? ` ${unit}` : ""}`;
  function render() {
    const pct = (val - min) / (max - min || 1);
    ind.style.transform = `translateX(-50%) rotate(${(-135 + pct * 270).toFixed(1)}deg)`;
    readout.textContent = fmt(val);
    knob.setAttribute("aria-valuenow", String(val));
    knob.setAttribute("aria-valuemin", String(min));
    knob.setAttribute("aria-valuemax", String(max));
    knob.setAttribute("aria-label", `${label}: ${fmt(val)}`);
  }
  // Snap to the step grid so a drag yields clean values (integers when step=1),
  // not fractions — a fractional octave/tempo would otherwise corrupt downstream
  // math. Rounded to the step's precision to avoid float noise (e.g. 0.30000004).
  const decimals = (String(step).split(".")[1] || "").length;
  function quantize(v) {
    if (!(step > 0)) return v;
    return Number((min + Math.round((v - min) / step) * step).toFixed(decimals));
  }
  function set(v, fire = true) { val = quantize(clamp(v, min, max)); render(); if (fire) onChange?.(val); }

  let dragging = false; let startY = 0; let startVal = 0;
  knob.addEventListener("pointerdown", (e) => {
    dragging = true; startY = e.clientY; startVal = val;
    try { knob.setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    e.preventDefault();
  });
  knob.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    set(startVal + ((startY - e.clientY) / 180) * (max - min));
  });
  const end = () => { dragging = false; };
  knob.addEventListener("pointerup", end);
  knob.addEventListener("pointercancel", end);
  knob.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(val + step); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(val - step); }
  });
  knob.addEventListener("wheel", (e) => { e.preventDefault(); set(val + (e.deltaY < 0 ? step : -step)); }, { passive: false });

  render();
  return { el: wrap, get: () => val, set: (v) => set(v, false) };
}

/** Vertical fader. Drag the thumb or arrow-key. */
export function createFader({ min = 0, max = 100, value = 50, step = 1, label = "", height = 132, onChange } = {}) {
  const wrap = el("div", "opus-control");
  const fader = el("div", "opus-fader");
  fader.style.setProperty("--fader-h", `${height}px`);
  fader.tabIndex = 0;
  fader.setAttribute("role", "slider");
  fader.append(el("span", "opus-fader-track"), el("span", "opus-fader-fill"), el("span", "opus-fader-thumb"));
  const fill = fader.querySelector(".opus-fader-fill");
  const thumb = fader.querySelector(".opus-fader-thumb");
  const lab = el("span", "opus-label");
  lab.textContent = label;
  wrap.append(fader, lab);

  let val = clamp(value, min, max);
  const travel = height - 8;
  function render() {
    const pct = (val - min) / (max - min || 1);
    fill.style.height = `${pct * travel}px`;
    thumb.style.bottom = `${4 + pct * travel}px`;
    fader.setAttribute("aria-valuenow", String(val));
    fader.setAttribute("aria-valuemin", String(min));
    fader.setAttribute("aria-valuemax", String(max));
    fader.setAttribute("aria-label", `${label}: ${Math.round(val)}`);
  }
  function set(v, fire = true) { val = clamp(v, min, max); render(); if (fire) onChange?.(val); }

  let dragging = false;
  const fromEvent = (e) => {
    const rect = fader.getBoundingClientRect();
    const pct = clamp(1 - (e.clientY - rect.top - 4) / travel, 0, 1);
    set(min + pct * (max - min));
  };
  fader.addEventListener("pointerdown", (e) => { dragging = true; try { fader.setPointerCapture(e.pointerId); } catch { /* */ } fromEvent(e); e.preventDefault(); });
  fader.addEventListener("pointermove", (e) => { if (dragging) fromEvent(e); });
  fader.addEventListener("pointerup", () => { dragging = false; });
  fader.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(val + step); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(val - step); }
  });

  render();
  return { el: wrap, get: () => val, set: (v) => set(v, false) };
}

/** Chunky keycap button. variant: "primary" | "rec" | undefined. */
export function createKeycap({ label = "", sub = "", variant = "", led = false, onClick } = {}) {
  const btn = el("button", `opus-key${variant ? ` is-${variant}` : ""}`);
  btn.type = "button";
  btn.innerHTML = `${led ? `<span class="opus-led${variant === "rec" ? "" : " is-off"}"${variant === "rec" ? ' style="--led:var(--rec)"' : ""}></span>` : ""}<span class="opus-key-label">${esc(label)}</span>${sub ? `<span class="opus-key-sub">${esc(sub)}</span>` : ""}`;
  if (onClick) btn.addEventListener("click", onClick);
  const ledEl = btn.querySelector(".opus-led");
  return {
    el: btn,
    setActive: (on) => btn.classList.toggle("is-active", on),
    setLed: (on) => ledEl?.classList.toggle("is-off", !on)
  };
}

/** Flick toggle (switch semantics). */
export function createToggle({ on = false, label = "", onChange } = {}) {
  const wrap = el("div", "opus-control");
  const sw = el("button", "opus-toggle", '<span class="opus-toggle-knob"></span>');
  sw.type = "button";
  sw.setAttribute("role", "switch");
  let state = !!on;
  const sync = () => { sw.classList.toggle("is-on", state); sw.setAttribute("aria-checked", String(state)); sw.setAttribute("aria-label", label); };
  sw.addEventListener("click", () => { state = !state; sync(); onChange?.(state); });
  const lab = el("span", "opus-label");
  lab.textContent = label;
  wrap.append(sw, lab);
  sync();
  return { el: wrap, get: () => state, set: (v) => { state = !!v; sync(); } };
}

/** Recessed segmented display. */
export function createLCD({ value = "", label = "", tone = "brass" } = {}) {
  const wrap = el("div", "opus-control");
  const lcd = el("div", `opus-lcd${tone === "cyan" ? " is-cyan" : ""}`, '<span class="opus-lcd-text"></span>');
  const text = lcd.querySelector(".opus-lcd-text");
  text.textContent = value;
  wrap.append(lcd);
  if (label) { const lab = el("span", "opus-label"); lab.textContent = label; wrap.append(lab); }
  return { el: wrap, set: (v) => { text.textContent = v; } };
}

/** LED indicator. color: "mint" | "rec" | "cyan" | "signal". */
export function createLED({ color = "mint", on = true } = {}) {
  const led = el("span", `opus-led${on ? "" : " is-off"}`);
  led.style.setProperty("--led", `var(--${color})`);
  return { el: led, set: (v) => led.classList.toggle("is-off", !v) };
}

/** Transport strip composed from keycaps. */
export function createTransport(buttons = []) {
  const strip = el("div", "opus-transport");
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", "Transport");
  const controls = {};
  buttons.forEach((b) => {
    const key = createKeycap(b);
    if (b.id) controls[b.id] = key;
    strip.append(key.el);
  });
  return { el: strip, controls };
}
