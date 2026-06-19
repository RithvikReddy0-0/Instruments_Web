import { buildVoice, scheduleVoice } from "./voice.js";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.enabled = false;
    this.volume = 0.72;
    this.active = new Map();
  }

  async init() {
    if (this.enabled) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    this.context = new AudioContextClass({ latencyHint: "interactive" });
    this.master = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.gain.value = this.volume;
    this.master.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    await this.context.resume();
    this.enabled = true;
    return true;
  }

  setVolume(value) {
    this.volume = Number(value);
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01);
    }
  }

  noteToMidi(note) {
    const match = /^([A-G]#?)(-?\d+)$/.exec(note);
    if (!match) return 60;
    const [, name, octave] = match;
    return 12 + Number(octave) * 12 + NOTE_NAMES.indexOf(name);
  }

  midiToNote(midi) {
    const name = NOTE_NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
  }

  transpose(note, steps) {
    return this.midiToNote(this.noteToMidi(note) + Number(steps));
  }

  frequency(note) {
    return 440 * Math.pow(2, (this.noteToMidi(note) - 69) / 12);
  }

  getNoteInfo(note) {
    const midi = this.noteToMidi(note);
    return {
      note,
      midi,
      octave: Math.floor(midi / 12) - 1,
      frequency: this.frequency(note)
    };
  }

  playNote(note, timbre, options = {}) {
    if (!this.enabled || !this.context) return null;
    // `when` lets callers (e.g. the metronome's lookahead scheduler) place a
    // note at a precise point on the audio clock instead of "right now".
    const now = options.when ?? this.context.currentTime;
    const velocity = options.velocity ?? 0.82;
    const duration = options.duration ?? 0.75;
    const id = options.id || `${note}-${now}`;
    const frequency = this.frequency(note);

    if (options.sustain) {
      // Held voice: build it and keep it ringing until stopNote() releases it.
      const voice = buildVoice(this.context, this.master, frequency, timbre, now, velocity);
      this.active.set(id, { oscillator: voice.oscillator, support: voice.support, gain: voice.gain, release: voice.env.release, note });
      return { id, stop: () => this.stopNote(id) };
    }

    scheduleVoice(this.context, this.master, frequency, timbre, now, duration, velocity);
    return { id };
  }

  stopNote(id) {
    const voice = this.active.get(id);
    if (!voice || !this.context) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, voice.release);
    voice.oscillator.stop(now + voice.release + 0.08);
    voice.support.stop(now + voice.release + 0.08);
    this.active.delete(id);
  }

  stopAll() {
    [...this.active.keys()].forEach((id) => this.stopNote(id));
  }
}
