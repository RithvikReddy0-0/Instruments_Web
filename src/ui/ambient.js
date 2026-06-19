/**
 * Audio-reactive ambient backdrop.
 *
 * A handful of soft drifting blobs whose glow/scale track the analyser's energy.
 * Performance: one pre-rendered radial sprite reused via drawImage (no per-frame
 * gradients), ≤16 particles, DPR clamped to 1 (it's blurry anyway), paused when
 * the tab is hidden. Disabled entirely under prefers-reduced-motion.
 */

// OPUS Midnight: warm brass field with a single cool spectral accent for depth.
const COLORS = [
  [200, 162, 75],   // brass
  [226, 181, 103],  // warm gold
  [79, 184, 255]    // soft cyan (sparse, for depth)
];

export function initAmbient(audio) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.id = "ambientCanvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
  window.addEventListener("resize", resize);
  resize();

  // Pre-render a soft white radial sprite once; tint via globalCompositeOperation.
  const sprite = document.createElement("canvas");
  const SS = 256;
  sprite.width = sprite.height = SS;
  const sctx = sprite.getContext("2d");
  const grad = sctx.createRadialGradient(SS / 2, SS / 2, 0, SS / 2, SS / 2, SS / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, SS, SS);

  const COUNT = 14;
  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00018,
    vy: (Math.random() - 0.5) * 0.00018,
    r: 120 + Math.random() * 220,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
    phase: Math.random() * Math.PI * 2
  }));

  const data = new Uint8Array(64);
  // Split reactivity into bands so low end drives mass/scale and the high end
  // drives brightness + the cool accent — the field "voices" the music instead
  // of just throbbing as one blob.
  let energy = 0;   // smoothed overall
  let bass = 0;     // smoothed low band
  let treble = 0;   // smoothed high band
  let running = true;
  let frame = 0;

  // Hero IH-1 panel meters react too (decorative, aria-hidden).
  const heroBars = [...document.querySelectorAll(".mini-wave i")];

  function avg(from, to) {
    let sum = 0;
    for (let i = from; i < to; i += 1) sum += data[i];
    return sum / ((to - from) * 255);
  }

  function readBands() {
    if (!audio.analyser) return;
    audio.analyser.getByteFrequencyData(data);
    bass += (Math.min(1, avg(0, 8) * 1.25) - bass) * 0.12;
    treble += (Math.min(1, avg(20, 48) * 1.6) - treble) * 0.16;
    const overall = Math.min(1, avg(0, 40) * 1.2);
    energy += (overall - energy) * 0.08;
  }

  // Drive the panel meters from live spectrum; when silent, hand them back to
  // the idle CSS keyframe animation (matching its 18–72px height range).
  function paintHero() {
    if (!heroBars.length) return;
    const live = energy > 0.02;
    for (let i = 0; i < heroBars.length; i += 1) {
      const bar = heroBars[i];
      if (!live) {
        if (bar.style.height) { bar.style.height = ""; bar.style.animationPlayState = ""; }
        continue;
      }
      bar.style.animationPlayState = "paused";
      const bin = data[2 + i * 4] / 255;
      bar.style.height = `${(18 + bin * 54).toFixed(1)}px`;
    }
  }

  function tick() {
    if (!running) return;
    frame += 1;
    readBands();
    if (frame % 2 === 0) paintHero(); // ~30fps for DOM writes
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -0.2 || p.x > 1.2) p.vx *= -1;
      if (p.y < -0.2 || p.y > 1.2) p.vy *= -1;
      const pulse = 0.5 + 0.5 * Math.sin(frame * 0.01 + p.phase);
      // Cyan accent particles ride the treble; warm brass rides the bass.
      const isAccent = p.c[2] > 200;
      const band = isAccent ? treble : bass;
      const scale = (p.r * (0.85 + pulse * 0.15 + band * 0.7 + energy * 0.2)) / SS;
      const size = SS * scale;
      const alpha = (0.05 + pulse * 0.04 + band * 0.18 + treble * 0.06);
      const [r, g, b] = p.c;
      ctx.globalAlpha = alpha;
      // tint: draw colored rect masked by sprite via per-particle offscreen would
      // be costly; instead approximate tint using shadow-free additive sprite +
      // a color overlay. Simpler: temporarily tint the sprite via filter.
      ctx.drawImage(tinted(sprite, r, g, b), p.x * w - size / 2, p.y * h - size / 2, size, size);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(tick);
  }

  // Cache tinted sprites per color so we don't recolor every frame.
  const tintCache = new Map();
  function tinted(base, r, g, b) {
    const key = `${r},${g},${b}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement("canvas");
    c.width = c.height = SS;
    const cx = c.getContext("2d");
    cx.drawImage(base, 0, 0);
    cx.globalCompositeOperation = "source-in";
    cx.fillStyle = `rgb(${r},${g},${b})`;
    cx.fillRect(0, 0, SS, SS);
    tintCache.set(key, c);
    return c;
  }

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(tick);
  });

  requestAnimationFrame(tick);
}
