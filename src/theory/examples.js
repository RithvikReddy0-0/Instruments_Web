/**
 * Live demonstration of the Theory Engine public API.
 * Run with:  node src/theory/examples.js
 *
 * This is documentation-by-example; the authoritative checks live in
 * theory.test.js. No UI — the engine is proven through its API.
 */

import { TheoryEngine } from "./theory-engine.js";

const theory = new TheoryEngine();
const line = (label, value) => console.log(`${label.padEnd(34)} ${JSON.stringify(value)}`);

console.log("\n=== CHORDS (generated from interval formulas) ===");
line('getChord("C", "major")', theory.getChord("C", "major"));
line('getChord("C", "diminished7")', theory.getChord("C", "diminished7"));
line('getChord("F#", "minor7")', theory.getChord("F#", "minor7"));
line('getChord("Eb", "halfDiminished7")', theory.getChord("Eb", "halfDiminished7"));

console.log("\n=== SCALES & MODES ===");
line('getScale("D", "dorian")', theory.getScale("D", "dorian"));
line('getScale("A", "harmonicMinor")', theory.getScale("A", "harmonicMinor"));
line('getScale("C", "blues")', theory.getScale("C", "blues"));
line('getModesOfKey("C")[1].name', theory.getModesOfKey("C")[1].name);

console.log("\n=== INTERVALS ===");
line('getIntervals("C", "G")', theory.getIntervals("C", "G"));
line('getInterval("C", "F#").name', theory.getInterval("C", "F#").name);
line('getInterval("C", "Gb").name', theory.getInterval("C", "Gb").name);

console.log("\n=== CIRCLE OF FIFTHS / KEYS ===");
line('getRelativeMinor("C")', theory.getRelativeMinor("C"));
line('getRelativeMajor("A Minor")', theory.getRelativeMajor("A Minor"));
line('getKeySignature("E", "major")', theory.getKeySignature("E", "major"));
line('getNeighbors("C", "major")', theory.getNeighbors("C", "major"));

console.log("\n=== DETECTION (algorithmic, with confidence) ===");
line('detectChord(["C","E","G"])', pick(theory.detectChord(["C", "E", "G"])));
line('detectChord(["A","C","E"])', pick(theory.detectChord(["A", "C", "E"])));
line('detectChord(["G","B","D","F"])', pick(theory.detectChord(["G", "B", "D", "F"])));
line('detectScale(["C","D","E","F","G","A","B"])', pick(theory.detectScale(["C", "D", "E", "F", "G", "A", "B"])));
line('detectKey(C-weighted melody)', (() => { const k = theory.detectKey(["C", "E", "G", "C", "G", "E", "D", "C", "F", "C"]); return { name: k.name, confidence: k.confidence }; })());

console.log("\n=== PROGRESSIONS (Roman numerals + naming) ===");
demo(["C", "G", "Am", "F"]);
demo(["Dm7", "G7", "Cmaj7"]);
demo(["Am", "F", "C", "G"]);
console.log("");

function pick(r) { return { name: r.name, type: r.type, confidence: r.confidence }; }
function demo(symbols) {
  const r = theory.analyzeProgression(symbols);
  console.log(`${JSON.stringify(symbols).padEnd(28)} → ${r.key.padEnd(10)} ${r.romanString}${r.name ? `  [${r.name}]` : ""}`);
}
