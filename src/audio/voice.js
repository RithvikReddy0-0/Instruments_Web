/**
 * Shared synthesis voice.
 *
 * One implementation of the InstrumentHub voice (dual oscillator → lowpass →
 * ADSR gain) used by BOTH the live AudioEngine and the offline WAV renderer,
 * so an exported file sounds identical to what you hear. Pure: it takes any
 * AudioContext (real or OfflineAudioContext) and a destination node.
 */

export function buildVoice(context, destination, frequency, timbre, when, velocity) {
  const env = {
    attack: timbre.attack ?? 0.01,
    decay: timbre.decay ?? 0.18,
    sustain: timbre.sustain ?? 0.3,
    release: timbre.release ?? 0.25
  };

  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const oscillator = context.createOscillator();
  const support = context.createOscillator();

  oscillator.type = timbre.wave || "triangle";
  support.type = timbre.wave === "sine" ? "triangle" : "sine";
  oscillator.frequency.value = frequency;
  support.frequency.value = frequency;
  support.detune.value = timbre.detune || 0;
  filter.type = "lowpass";
  filter.frequency.value = timbre.filter || 2600;
  filter.Q.value = 0.8;

  oscillator.connect(filter);
  support.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  const peak = Math.min(0.95, velocity);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + env.attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * env.sustain), when + env.attack + env.decay);

  oscillator.start(when);
  support.start(when);

  return { oscillator, support, gain, env };
}

/** Build a self-terminating one-shot voice (attack→decay→release at `when`+duration). */
export function scheduleVoice(context, destination, frequency, timbre, when, duration, velocity) {
  const voice = buildVoice(context, destination, frequency, timbre, when, velocity);
  const stopAt = when + duration;
  voice.gain.gain.setTargetAtTime(0.0001, stopAt, voice.env.release);
  voice.oscillator.stop(stopAt + voice.env.release + 0.06);
  voice.support.stop(stopAt + voice.env.release + 0.06);
  return voice;
}
