import { describe, it, expect } from "vitest";
import {
  parseNote, pitchClass, formatNote, spellNote, accidentalFor
} from "./notes.js";
import { getInterval } from "./intervals.js";
import { getChord, getChordInfo, parseChordSymbol } from "./chords.js";
import { getScale } from "./scales.js";
import { modesOfKey } from "./modes.js";
import {
  getKeySignature, relativeMinor, relativeMajor, neighbors, CIRCLE, fifthsOf
} from "./circle-of-fifths.js";
import { detectChord, detectScale, detectKey } from "./detection.js";
import { analyzeProgression } from "./progressions.js";
import { TheoryEngine } from "./theory-engine.js";

describe("notes", () => {
  it("parses accidentals and octaves", () => {
    expect(parseNote("C")).toEqual({ letter: "C", accidental: 0, octave: null });
    expect(parseNote("F#4")).toEqual({ letter: "F", accidental: 1, octave: 4 });
    expect(parseNote("Bb")).toEqual({ letter: "B", accidental: -1, octave: null });
    expect(parseNote("Cbb")).toEqual({ letter: "C", accidental: -2, octave: null });
  });

  it("computes pitch class with enharmonic awareness", () => {
    expect(pitchClass("C#")).toBe(1);
    expect(pitchClass("Db")).toBe(1);
    expect(pitchClass("B#")).toBe(0);
    expect(pitchClass("Cb")).toBe(11);
  });

  it("spells notes from root + letter step + semitone", () => {
    expect(formatNote(spellNote("C", 2, 4))).toBe("E");     // major 3rd
    expect(formatNote(spellNote("C", 2, 3))).toBe("Eb");    // minor 3rd
    expect(formatNote(spellNote("C", 6, 9))).toBe("Bbb");   // dim 7th
    expect(accidentalFor("G", 8)).toBe(1);                  // G -> G#
  });
});

describe("intervals", () => {
  it("names common intervals (number + quality)", () => {
    expect(getInterval("C", "G")).toMatchObject({ name: "Perfect Fifth", semitones: 7, number: 5 });
    expect(getInterval("C", "E")).toMatchObject({ name: "Major Third", semitones: 4 });
    expect(getInterval("C", "Eb")).toMatchObject({ name: "Minor Third", semitones: 3 });
    expect(getInterval("C", "F")).toMatchObject({ name: "Perfect Fourth", semitones: 5 });
  });

  it("distinguishes augmented 4th from diminished 5th", () => {
    expect(getInterval("C", "F#").name).toBe("Augmented Fourth");
    expect(getInterval("C", "Gb").name).toBe("Diminished Fifth");
  });

  it("uses octaves when present", () => {
    expect(getInterval("C4", "C5")).toMatchObject({ name: "Perfect Octave", semitones: 12 });
  });
});

describe("chord generation (formula-driven)", () => {
  const cases = {
    major: ["C", "E", "G"],
    minor: ["C", "Eb", "G"],
    diminished: ["C", "Eb", "Gb"],
    augmented: ["C", "E", "G#"],
    sus2: ["C", "D", "G"],
    sus4: ["C", "F", "G"],
    dominant7: ["C", "E", "G", "Bb"],
    major7: ["C", "E", "G", "B"],
    minor7: ["C", "Eb", "G", "Bb"],
    halfDiminished7: ["C", "Eb", "Gb", "Bb"],
    diminished7: ["C", "Eb", "Gb", "Bbb"]
  };
  for (const [type, expected] of Object.entries(cases)) {
    it(`C ${type} → ${expected.join(" ")}`, () => {
      expect(getChord("C", type)).toEqual(expected);
    });
  }

  it("spells sharp/flat keys correctly", () => {
    expect(getChord("D", "major")).toEqual(["D", "F#", "A"]);
    expect(getChord("Eb", "major")).toEqual(["Eb", "G", "Bb"]);
    expect(getChord("F#", "minor")).toEqual(["F#", "A", "C#"]);
  });

  it("getChordInfo exposes name/symbol/family", () => {
    expect(getChordInfo("A", "minor")).toMatchObject({ name: "A Minor", symbol: "Am", family: "minor", notes: ["A", "C", "E"] });
  });

  it("parses chord symbols", () => {
    expect(parseChordSymbol("Am")).toEqual({ root: "A", type: "minor" });
    expect(parseChordSymbol("G7")).toEqual({ root: "G", type: "dominant7" });
    expect(parseChordSymbol("F#m7b5")).toEqual({ root: "F#", type: "halfDiminished7" });
  });
});

describe("scale generation (formula-driven)", () => {
  it("major and dorian", () => {
    expect(getScale("C", "major")).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(getScale("D", "dorian")).toEqual(["D", "E", "F", "G", "A", "B", "C"]);
  });

  it("minor variants", () => {
    expect(getScale("A", "naturalMinor")).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(getScale("A", "harmonicMinor")).toEqual(["A", "B", "C", "D", "E", "F", "G#"]);
    expect(getScale("A", "melodicMinor")).toEqual(["A", "B", "C", "D", "E", "F#", "G#"]);
  });

  it("pentatonics and blues", () => {
    expect(getScale("C", "pentatonicMajor")).toEqual(["C", "D", "E", "G", "A"]);
    expect(getScale("A", "pentatonicMinor")).toEqual(["A", "C", "D", "E", "G"]);
    expect(getScale("C", "blues")).toEqual(["C", "Eb", "F", "Gb", "G", "Bb"]);
  });

  it("spells sharp-key scales", () => {
    expect(getScale("E", "major")).toEqual(["E", "F#", "G#", "A", "B", "C#", "D#"]);
    expect(getScale("F#", "lydian")).toEqual(["F#", "G#", "A#", "B#", "C#", "D#", "E#"]);
  });
});

describe("modes of a key", () => {
  it("returns 7 modes built on the C major degrees", () => {
    const modes = modesOfKey("C");
    expect(modes).toHaveLength(7);
    expect(modes[0]).toMatchObject({ degree: 1, label: "Ionian", root: "C" });
    expect(modes[1]).toMatchObject({ degree: 2, label: "Dorian", root: "D" });
    expect(modes[6]).toMatchObject({ degree: 7, label: "Locrian", root: "B" });
  });
});

describe("circle of fifths", () => {
  it("relative major/minor", () => {
    expect(relativeMinor("C")).toBe("A");
    expect(relativeMinor("Eb")).toBe("C");
    expect(relativeMajor("A")).toBe("C");
    expect(relativeMajor("C")).toBe("Eb");
  });

  it("key signatures derived from circle position", () => {
    expect(getKeySignature("C", "major")).toMatchObject({ count: 0, type: "none" });
    expect(getKeySignature("G", "major")).toMatchObject({ count: 1, type: "sharp", notes: ["F#"] });
    expect(getKeySignature("D", "major")).toMatchObject({ count: 2, type: "sharp", notes: ["F#", "C#"] });
    expect(getKeySignature("F", "major")).toMatchObject({ count: 1, type: "flat", notes: ["Bb"] });
    expect(getKeySignature("Eb", "major")).toMatchObject({ count: 3, type: "flat", notes: ["Bb", "Eb", "Ab"] });
    expect(getKeySignature("A", "minor")).toMatchObject({ count: 0, type: "none" });
    expect(getKeySignature("E", "minor")).toMatchObject({ count: 1, type: "sharp" });
  });

  it("fifths position and neighbors", () => {
    expect(fifthsOf("C")).toBe(0);
    expect(fifthsOf("G")).toBe(1);
    expect(fifthsOf("F")).toBe(-1);
    expect(fifthsOf("F#")).toBe(6);
    expect(neighbors("C", "major")).toMatchObject({ dominant: "G", subdominant: "F", relative: "Am" });
  });

  it("circle has 12 positions starting at C", () => {
    expect(CIRCLE).toHaveLength(12);
    expect(CIRCLE[0]).toMatchObject({ major: "C", minor: "Am" });
    expect(CIRCLE[1]).toMatchObject({ major: "G", minor: "Em" });
  });
});

describe("detection (algorithmic)", () => {
  it("detects triads with full confidence", () => {
    expect(detectChord(["C", "E", "G"])).toMatchObject({ root: "C", type: "major", confidence: 1 });
    expect(detectChord(["A", "C", "E"])).toMatchObject({ root: "A", type: "minor", confidence: 1 });
    expect(detectChord(["G", "B", "D", "F"])).toMatchObject({ root: "G", type: "dominant7" });
  });

  it("detects scales with confidence and tonic preference", () => {
    expect(detectScale(["C", "D", "E", "F", "G", "A", "B"])).toMatchObject({ root: "C", type: "major", confidence: 1 });
    const minor = detectScale(["A", "B", "C", "D", "E", "F", "G"]);
    expect(minor.root).toBe("A");
    expect(["naturalMinor", "aeolian"]).toContain(minor.type);
  });

  it("infers key from a note pool", () => {
    const key = detectKey(["C", "E", "G", "D", "F", "A", "B", "C"]);
    expect(key).toMatchObject({ root: "C", quality: "major" });
  });
});

describe("progression analysis", () => {
  it("I–V–vi–IV in C and recognizes the Axis progression", () => {
    const result = analyzeProgression(["C", "G", "Am", "F"]);
    expect(result.key).toBe("C Major");
    expect(result.roman).toEqual(["I", "V", "vi", "IV"]);
    expect(result.name).toMatch(/Axis/);
    expect(result.confidence).toBe(1);
  });

  it("ii–V–I with sevenths", () => {
    const result = analyzeProgression(["Dm7", "G7", "Cmaj7"]);
    expect(result.key).toBe("C Major");
    expect(result.roman).toEqual(["ii7", "V7", "Imaj7"]);
    expect(result.name).toMatch(/ii–V–I/);
  });

  it("minor progression", () => {
    const result = analyzeProgression(["Am", "Dm", "Em"]);
    expect(result.quality).toBe("minor");
    expect(result.roman).toEqual(["i", "iv", "v"]);
  });
});

describe("TheoryEngine facade (spec examples)", () => {
  const theory = new TheoryEngine();
  it("matches the documented API", () => {
    expect(theory.getChord("C", "major")).toEqual(["C", "E", "G"]);
    expect(theory.getScale("D", "dorian")).toEqual(["D", "E", "F", "G", "A", "B", "C"]);
    expect(theory.getIntervals("C", "G")).toEqual({ name: "Perfect Fifth", semitones: 7 });
    expect(theory.getRelativeMinor("C")).toBe("A Minor");
    expect(theory.getRelativeMajor("A Minor")).toBe("C Major");
  });
});
