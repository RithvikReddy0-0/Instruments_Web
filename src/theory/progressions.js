/**
 * Progression analysis.
 *
 * Given chord symbols, infer the most likely key, render Roman numerals, and
 * recognize common progressions by name. Key inference scores every major/minor
 * key by how many input chords are diatonic to it; numerals are then derived
 * from the chosen key's scale degrees (algorithmic, not table-matched).
 */

import { pitchClass, parseNote, formatNote } from "./notes.js";
import { parseChordSymbol, CHORD_FAMILY } from "./chords.js";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_OFFSETS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_FAMILIES = ["major", "minor", "minor", "major", "major", "minor", "diminished"];
const MINOR_FAMILIES = ["minor", "diminished", "major", "minor", "minor", "major", "major"];

const SUFFIX = {
  major: "", minor: "", dominant7: "7", major7: "maj7", minor7: "7",
  diminished: "°", diminished7: "°7", halfDiminished7: "ø7",
  augmented: "+", sus2: "sus2", sus4: "sus4"
};

const NAMED = {
  "I-IV-V": "I–IV–V",
  "I-IV-V-I": "I–IV–V–I",
  "I-V-vi-IV": "Axis (I–V–vi–IV)",
  "vi-IV-I-V": "Axis (vi–IV–I–V)",
  "I-vi-IV-V": "50s doo-wop (I–vi–IV–V)",
  "ii-V-I": "ii–V–I (jazz cadence)",
  "ii-V-I-IV": "ii–V–I turnaround",
  "I-V-vi-iii-IV-I-IV-V": "Pachelbel's Canon",
  "i-VI-III-VII": "Minor pop (i–VI–III–VII)",
  "i-iv-v": "Minor (i–iv–v)",
  "i-iv-V": "Minor cadence (i–iv–V)",
  "I-IV-I-V": "Blues turnaround (I–IV–I–V)"
};

function offsetsFor(quality) {
  return quality === "minor" ? MINOR_OFFSETS : MAJOR_OFFSETS;
}

function keyDegrees(tonicPc, quality) {
  const offsets = offsetsFor(quality);
  const families = quality === "minor" ? MINOR_FAMILIES : MAJOR_FAMILIES;
  return offsets.map((off, i) => ({ pc: (tonicPc + off) % 12, family: families[i] }));
}

/** Roman numeral for one chord within a key (with accidental prefix if needed). */
function romanFor(chord, tonicPc, quality) {
  const offsets = offsetsFor(quality);
  const family = CHORD_FAMILY[chord.type];
  const offset = (pitchClass(chord.root) - tonicPc + 12) % 12;

  let prefix = "";
  let idx = offsets.indexOf(offset);
  if (idx < 0) {
    if (offsets.includes((offset - 1 + 12) % 12)) { prefix = "#"; idx = offsets.indexOf((offset - 1 + 12) % 12); }
    else if (offsets.includes((offset + 1) % 12)) { prefix = "b"; idx = offsets.indexOf((offset + 1) % 12); }
    else { idx = 0; prefix = "?"; }
  }

  let core = ROMAN[idx];
  if (family === "minor" || family === "diminished") core = core.toLowerCase();
  const triad = `${prefix}${core}${family === "diminished" ? "°" : family === "augmented" ? "+" : ""}`;
  const full = `${prefix}${core}${SUFFIX[chord.type] ?? ""}`;
  return { triad, full };
}

/**
 * analyzeProgression(["C","G","Am","F"]) →
 *   { key:"C Major", quality:"major", roman:["I","V","vi","IV"], name:"Axis…", confidence:1 }
 */
export function analyzeProgression(symbols) {
  if (!symbols || symbols.length === 0) return null;
  const chords = symbols.map((s) => {
    const { root, type } = parseChordSymbol(s);
    return { root, type, pc: pitchClass(root), family: CHORD_FAMILY[type] };
  });

  // Score every candidate key by diatonic membership of the input chords.
  let best = null;
  for (let tonic = 0; tonic < 12; tonic += 1) {
    for (const quality of ["major", "minor"]) {
      const degrees = keyDegrees(tonic, quality);
      let matches = 0;
      chords.forEach((chord) => {
        const degree = degrees.find((d) => d.pc === chord.pc);
        if (!degree) return;
        if (degree.family === chord.family || chord.type === "sus2" || chord.type === "sus4") matches += 1;
      });
      let score = matches;
      if (chords[0].pc === tonic) score += 0.5;                       // first chord = tonic
      if (chords[chords.length - 1].pc === tonic) score += 0.5;       // last chord = tonic
      if (quality === "major") score += 0.01;                         // tie-break toward major
      if (!best || score > best.score) best = { tonic, quality, matches, score };
    }
  }

  const numerals = chords.map((c) => romanFor(c, best.tonic, best.quality));
  const triadKey = numerals.map((n) => n.triad).join("-");
  const tonicName = formatNote({ ...parseNote(chords.find((c) => c.pc === best.tonic)?.root || symbols[0]), octave: null });

  return {
    key: `${tonicName} ${best.quality === "major" ? "Major" : "Minor"}`,
    tonic: tonicName,
    quality: best.quality,
    roman: numerals.map((n) => n.full),
    romanTriads: numerals.map((n) => n.triad),
    romanString: numerals.map((n) => n.full).join(" – "),
    name: NAMED[triadKey] || null,
    confidence: Number((best.matches / chords.length).toFixed(3))
  };
}
