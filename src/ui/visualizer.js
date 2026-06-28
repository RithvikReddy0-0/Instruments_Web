export class Visualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.audio = audioEngine;
    this.ctx = canvas.getContext("2d");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.data = new Uint8Array(512);
    this.running = false;
    this.width = 0;
    this.height = 0;
    // Resize only when the element's box actually changes — not on every frame.
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }

  start() {
    if (this.running || this.reducedMotion) return;
    this.running = true;
    this.resize();
    this.draw();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, rect.width * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw() {
    if (!this.running) return;
    const width = this.width;
    const height = this.height;
    this.ctx.clearRect(0, 0, width, height);

    if (this.audio.analyser) {
      this.audio.analyser.getByteFrequencyData(this.data);
    }

    const bars = 48;
    const gap = 3;
    const barWidth = Math.max(3, (width - gap * bars) / bars);
    for (let index = 0; index < bars; index += 1) {
      const value = this.data[index * 3] || 8;
      const barHeight = Math.max(4, (value / 255) * height);
      const x = index * (barWidth + gap);
      const y = height - barHeight;
      // Cyan→violet cosmic spectrum — cool life energy drifting to mystery.
      const hue = 188 + index * 1.4;
      this.ctx.fillStyle = `hsl(${hue} 88% ${48 + value / 9}%)`;
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }

    requestAnimationFrame(() => this.draw());
  }
}

export function initHeroCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;

  function render() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    // OPUS Midnight: warm near-black field with brass resonance dots.
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0d0d11");
    gradient.addColorStop(0.5, "#16130c");
    gradient.addColorStop(1, "#08080a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 40; i += 1) {
      const x = (i / 39) * width;
      const amp = 30 + (i % 5) * 8;
      const y = height * 0.52 + Math.sin(i * 0.7 + frame * 0.025) * amp;
      ctx.fillStyle = `rgba(200, 162, 75, ${0.08 + (i % 6) * 0.02})`;
      ctx.beginPath();
      ctx.arc(x, y, 5 + (i % 4) * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(243,239,230,0.07)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      const y = height * (0.18 + i * 0.08);
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 24) {
        ctx.lineTo(x, y + Math.sin(x * 0.015 + frame * 0.018 + i) * 12);
      }
      ctx.stroke();
    }

    frame += 1;
    if (!reducedMotion) requestAnimationFrame(render);
  }
  render();
}
