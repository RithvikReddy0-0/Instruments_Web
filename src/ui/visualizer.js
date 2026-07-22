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
