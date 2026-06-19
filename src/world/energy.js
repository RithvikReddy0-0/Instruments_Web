/**
 * Ambient Energy System — the app-wide field that makes the world feel alive.
 *
 * Reads the application's real AnalyserNode (handed over via a global the app
 * sets on audio:ready) and resolves it into normalized, smoothed signals every
 * frame. Never forces an AudioContext: with no live audio it breathes on a calm
 * synthetic LFO. Interaction activity (note plays, clicks) bumps the field too.
 *
 *   bass    → background movement / depth
 *   mid     → particle activity
 *   treble  → glow intensity
 *   calm    → rises in silence → slow breathing motion
 *   activity→ decays after interaction
 */
export function createEnergy() {
  let analyser = null;
  let data = null;
  let bass = 0;
  let mid = 0;
  let treble = 0;
  let activity = 0;
  let calm = 1;
  let t = 0;

  function adopt(node) {
    if (!node || node === analyser) return;
    analyser = node;
    data = new Uint8Array(node.frequencyBinCount);
  }
  function avg(from, to) {
    let s = 0;
    for (let i = from; i < to; i += 1) s += data[i];
    return s / ((to - from) * 255);
  }

  return {
    setAnalyser: adopt,
    bump(amount = 1) { activity = Math.min(1.6, activity + amount); },

    update(dt) {
      t += dt;
      // Late-bind the analyser the app stashes once audio is live.
      if (!analyser && window.__ihAudioAnalyser) adopt(window.__ihAudioAnalyser);

      let b; let m; let tr; let level;
      if (analyser) {
        analyser.getByteFrequencyData(data);
        b = Math.min(1, avg(0, 8) * 1.3);
        m = Math.min(1, avg(8, 40) * 1.5);
        tr = Math.min(1, avg(40, 96) * 1.7);
        level = avg(0, 96);
      } else {
        // Synthetic calm: a barely-there swell so the world still breathes.
        b = 0.1 + 0.06 * Math.sin(t * 0.6);
        m = 0.05;
        tr = 0.04;
        level = 0.04;
      }
      bass += (b - bass) * 0.1;
      mid += (m - mid) * 0.14;
      treble += (tr - treble) * 0.18;
      activity = Math.max(0, activity - dt * 0.55);

      const loud = Math.max(level, activity * 0.4);
      calm += ((loud < 0.05 ? 1 : 0) - calm) * 0.04;

      return { bass, mid, treble, activity, calm, breath: 0.5 + 0.5 * Math.sin(t * 0.5), t };
    }
  };
}
