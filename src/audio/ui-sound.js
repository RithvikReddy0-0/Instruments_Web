/**
 * Premium UI interaction sounds.
 *
 * Tiny, tasteful one-shot blips for hardware control feedback — knob detents,
 * toggle flicks, keycap presses. Routed through a dedicated low-gain bus off the
 * AudioEngine's master, so master volume and the analyser apply (the ambient
 * field reacts to them too). No-ops until the audio context is live, so it never
 * forces a context before the user's first gesture. Detents are throttled so a
 * fast knob drag clicks like a real encoder instead of buzzing.
 */
export function createUiSound(audio) {
  let bus = null;
  let lastDetent = 0;

  function dest() {
    if (!audio.enabled || !audio.context || !audio.master) return null;
    if (!bus) {
      bus = audio.context.createGain();
      bus.gain.value = 0.16;
      bus.connect(audio.master);
    }
    return bus;
  }

  function blip({ freq = 440, dur = 0.04, type = "square", gain = 0.8, sweep = 0 }) {
    const out = dest();
    if (!out) return;
    const ctx = audio.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + sweep), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  return {
    /** Encoder click — throttled to ~50ms so drags don't smear into a buzz. */
    detent() {
      const t = performance.now();
      if (t - lastDetent < 50) return;
      lastDetent = t;
      blip({ freq: 2100, dur: 0.016, type: "square", gain: 0.42 });
    },
    toggleOn() { blip({ freq: 480, dur: 0.05, type: "triangle", gain: 0.7, sweep: 260 }); },
    toggleOff() { blip({ freq: 320, dur: 0.05, type: "triangle", gain: 0.6, sweep: -140 }); },
    /** Chunky keycap thunk. */
    press() { blip({ freq: 170, dur: 0.06, type: "sine", gain: 0.85, sweep: -70 }); }
  };
}
