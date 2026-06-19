/**
 * Audio reactivity source.
 *
 * Prefers a real AnalyserNode if one is handed in (e.g. the app's AudioEngine
 * once it's live), but never forces an AudioContext — the intro must run before
 * any user gesture. When no live signal exists it falls back to a synthetic,
 * musical energy curve so the particles and lights still "breathe" in time.
 */
export function createAudioReact() {
  let analyser = null;
  let data = null;
  let t = 0;

  function attach(node) {
    if (!node) return;
    analyser = node;
    data = new Uint8Array(node.frequencyBinCount);
  }

  function energy(dt) {
    t += dt;
    if (analyser) {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < 40; i += 1) sum += data[i];
      const live = Math.min(1, sum / (40 * 210));
      if (live > 0.01) return live;
    }
    // Synthetic: two detuned oscillations → a gentle 0..1 pulse around ~0.45.
    const v = 0.6 * Math.sin(t * 1.6) + 0.25 * Math.sin(t * 3.1 + 1.0) + 0.15 * Math.sin(t * 0.7);
    return Math.min(1, Math.max(0, 0.45 + v * 0.32));
  }

  return { attach, energy };
}
