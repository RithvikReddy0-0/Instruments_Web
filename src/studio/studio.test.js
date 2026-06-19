import { describe, it, expect } from "vitest";
import {
  createClip, addNote, moveNote, resizeNote, deleteNotes, clipDuration, pitchRange, MIN_DURATION
} from "./clip.js";
import { clipToJSON, clipToMIDI, audioBufferToWav } from "./export.js";

describe("clip edit operations (pure)", () => {
  it("creates a clip with sane defaults", () => {
    const c = createClip();
    expect(c).toMatchObject({ name: "Untitled session", bpm: 120, instrument: "piano", notes: [] });
    expect(c.id).toMatch(/^clip/);
  });

  it("adds notes with id + enforced minimum duration", () => {
    let notes = [];
    notes = addNote(notes, { midi: 60, start: 0, duration: 0.5 });
    notes = addNote(notes, { midi: 64, start: 1, duration: 0 }); // clamped
    expect(notes).toHaveLength(2);
    expect(notes[0].id).toBeTruthy();
    expect(notes[1].duration).toBe(MIN_DURATION);
  });

  it("moves notes and clamps start>=0 and midi 0..127", () => {
    const notes = addNote([], { midi: 60, start: 1, duration: 1 });
    const id = notes[0].id;
    expect(moveNote(notes, id, 0.5, 2)[0]).toMatchObject({ start: 1.5, midi: 62 });
    expect(moveNote(notes, id, -5, 0)[0].start).toBe(0);       // clamped
    expect(moveNote(notes, id, 0, 200)[0].midi).toBe(127);     // clamped
  });

  it("resizes with a floor and deletes by id", () => {
    const notes = addNote([], { midi: 60, start: 0, duration: 1 });
    const id = notes[0].id;
    expect(resizeNote(notes, id, 0.01)[0].duration).toBe(MIN_DURATION);
    expect(deleteNotes(notes, [id])).toHaveLength(0);
  });

  it("computes duration and pitch range", () => {
    let notes = addNote([], { midi: 60, start: 0, duration: 1 });
    notes = addNote(notes, { midi: 72, start: 2, duration: 1.5 });
    const clip = createClip({ notes });
    expect(clipDuration(clip)).toBe(3.5);
    expect(pitchRange(clip)).toEqual({ min: 60, max: 72 });
  });
});

describe("export · JSON", () => {
  it("serializes the clip", () => {
    const clip = createClip({ notes: addNote([], { midi: 60, start: 0, duration: 1 }) });
    const parsed = JSON.parse(clipToJSON(clip));
    expect(parsed.app).toBe("InstrumentHub Studio");
    expect(parsed.clip.notes).toHaveLength(1);
  });
});

// Minimal SMF parser to prove the bytes are a valid format-0 file.
function parseMidi(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (o, l) => String.fromCharCode(...bytes.slice(o, o + l));
  const header = str(0, 4);
  const format = dv.getUint16(8);
  const ntrks = dv.getUint16(10);
  const division = dv.getUint16(12);
  expect(str(14, 4)).toBe("MTrk");
  const trackLen = dv.getUint32(18);

  let p = 22;
  const end = 22 + trackLen;
  let status = 0;
  let noteOns = 0;
  let tempoMicros = null;
  const readVLQ = () => { let v = 0, b; do { b = bytes[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  while (p < end) {
    readVLQ(); // delta
    const b = bytes[p];
    if (b === 0xff) {
      p++; const type = bytes[p++]; const len = readVLQ();
      if (type === 0x51) tempoMicros = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2];
      p += len;
      if (type === 0x2f) break;
      continue;
    }
    if (b & 0x80) { status = b; p++; }
    const d1 = bytes[p++]; const d2 = bytes[p++];
    if ((status & 0xf0) === 0x90 && d2 > 0) noteOns += 1;
    void d1;
  }
  return { header, format, ntrks, division, noteOns, tempoMicros };
}

describe("export · MIDI (valid SMF format 0)", () => {
  it("writes a parseable file with correct header, tempo, and note count", () => {
    let notes = addNote([], { midi: 60, start: 0, duration: 0.5 });
    notes = addNote(notes, { midi: 64, start: 0.5, duration: 0.5 });
    notes = addNote(notes, { midi: 67, start: 1.0, duration: 1.0 });
    const clip = createClip({ bpm: 120, notes });
    const midi = clipToMIDI(clip);
    const parsed = parseMidi(midi);
    expect(parsed.header).toBe("MThd");
    expect(parsed.format).toBe(0);
    expect(parsed.ntrks).toBe(1);
    expect(parsed.division).toBe(480);
    expect(parsed.noteOns).toBe(3);
    expect(parsed.tempoMicros).toBe(500000); // 120 bpm = 500000 µs/quarter
  });
});

describe("export · WAV (16-bit PCM header)", () => {
  it("encodes an AudioBuffer-like object to a valid RIFF/WAVE blob", () => {
    const fakeBuffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 4,
      getChannelData: () => Float32Array.from([0, 0.5, -0.5, 1])
    };
    const wav = audioBufferToWav(fakeBuffer);
    const str = (o, l) => String.fromCharCode(...wav.slice(o, o + l));
    const dv = new DataView(wav.buffer);
    expect(str(0, 4)).toBe("RIFF");
    expect(str(8, 4)).toBe("WAVE");
    expect(str(36, 4)).toBe("data");
    expect(dv.getUint16(22, true)).toBe(1);          // channels
    expect(dv.getUint32(24, true)).toBe(44100);      // sample rate
    expect(dv.getUint16(34, true)).toBe(16);         // bits per sample
    expect(dv.getUint32(40, true)).toBe(4 * 2);      // dataSize = frames * blockAlign
    expect(wav.length).toBe(44 + 8);
  });
});
