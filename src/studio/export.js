/**
 * Export: JSON, MIDI, and WAV — no heavy external libraries.
 *
 *  - JSON : the clip serialized.
 *  - MIDI : a hand-written Standard MIDI File (format 0) with variable-length
 *           delta times, a tempo meta event, and paired note on/off events.
 *  - WAV  : rendered offline through OfflineAudioContext using the SHARED voice
 *           synthesis (identical to live playback), encoded to 16-bit PCM.
 */

import { scheduleVoice } from "../audio/voice.js";
import { clipDuration } from "./clip.js";

const PPQ = 480; // ticks per quarter note

// ---------- JSON ----------
export function clipToJSON(clip) {
  return JSON.stringify({ app: "InstrumentHub Studio", version: 3, clip }, null, 2);
}

// ---------- MIDI ----------
function writeVarLen(value) {
  const bytes = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

const secondsToTicks = (seconds, bpm) => Math.max(0, Math.round(seconds * (bpm / 60) * PPQ));

/** Build a valid SMF (format 0) as a Uint8Array. */
export function clipToMIDI(clip) {
  const bpm = clip.bpm || 120;

  // Collect absolute-tick events; note-offs sort before note-ons at equal tick.
  const events = [];
  (clip.notes || []).forEach((n) => {
    const onTick = secondsToTicks(n.start, bpm);
    const offTick = secondsToTicks(n.start + n.duration, bpm);
    const pitch = Math.max(0, Math.min(127, Math.round(n.midi)));
    const vel = Math.max(1, Math.min(127, Math.round((n.velocity ?? 0.78) * 127)));
    events.push({ tick: onTick, order: 1, data: [0x90, pitch, vel] });
    events.push({ tick: offTick, order: 0, data: [0x80, pitch, 0] });
  });
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track = [];
  // Tempo meta: FF 51 03 tttttt (microseconds per quarter note).
  const mpqn = Math.round(60000000 / bpm);
  track.push(0x00, 0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff);

  let prevTick = 0;
  events.forEach((e) => {
    track.push(...writeVarLen(e.tick - prevTick), ...e.data);
    prevTick = e.tick;
  });
  track.push(0x00, 0xff, 0x2f, 0x00); // end of track

  const u32 = (n) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    ...u32(6),
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    (PPQ >> 8) & 0xff, PPQ & 0xff
  ];
  const trackChunk = [0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track]; // "MTrk"
  return new Uint8Array([...header, ...trackChunk]);
}

// ---------- WAV ----------
export function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = frames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i)); };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numCh; c += 1) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < numCh; c += 1) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(ab);
}

/** Render the clip offline and return WAV bytes. `instruments` maps id → timbre. */
export async function clipToWAV(clip, { instruments, sampleRate = 44100 } = {}) {
  const duration = clipDuration(clip) + 1.0; // tail for release
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OfflineCtx(1, length, sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  (clip.notes || []).forEach((n) => {
    const inst = instruments.find((i) => i.id === (n.instrument || clip.instrument)) || instruments[0];
    const frequency = 440 * Math.pow(2, (n.midi - 69) / 12);
    scheduleVoice(ctx, master, frequency, inst.timbre, n.start, n.duration, n.velocity ?? 0.78);
  });

  const rendered = await ctx.startRendering();
  return audioBufferToWav(rendered);
}

// ---------- download helper ----------
export function download(filename, data, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
