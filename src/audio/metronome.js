const CLICK_TIMBRE = {
  wave: "square",
  filter: 2400,
  attack: 0.001,
  decay: 0.04,
  sustain: 0.01,
  release: 0.03
};

/**
 * Web Audio lookahead scheduler.
 *
 * A `setInterval` callback fires every `tickMs` and schedules every beat that
 * falls inside the next `lookahead` seconds directly on the audio clock. The
 * JS timer is therefore allowed to jitter freely — beats still land
 * sample-accurately because their start times come from `AudioContext`, not
 * from when the timer happened to fire. This is the standard pattern from
 * Chris Wilson's "A Tale of Two Clocks".
 */
export class Metronome {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.bpm = 120;
    this.running = false;
    this.beat = 0;
    this.nextBeatTime = 0;
    this.lookahead = 0.12;   // seconds of audio scheduled ahead of time
    this.tickMs = 25;        // how often the scheduler wakes up
    this.timer = null;
  }

  setTempo(value) {
    // No restart needed: the scheduler reads `this.bpm` live on every tick,
    // so tempo changes take effect on the next beat.
    this.bpm = Math.max(40, Math.min(220, Number(value) || 120));
  }

  start() {
    if (this.running || !this.audio.context) return;
    this.running = true;
    this.beat = 0;
    this.nextBeatTime = this.audio.context.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), this.tickMs);
  }

  schedule() {
    const ctx = this.audio.context;
    if (!ctx) return;
    while (this.nextBeatTime < ctx.currentTime + this.lookahead) {
      this.beat += 1;
      const note = this.beat % 4 === 1 ? "C6" : "G5";
      this.audio.playNote(note, CLICK_TIMBRE, {
        duration: 0.04,
        velocity: this.beat % 4 === 1 ? 0.42 : 0.3,
        when: this.nextBeatTime
      });
      this.nextBeatTime += 60 / this.bpm;
    }
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.beat = 0;
  }

  toggle() {
    if (this.running) {
      this.stop();
      return false;
    }
    this.start();
    return this.running;
  }
}
