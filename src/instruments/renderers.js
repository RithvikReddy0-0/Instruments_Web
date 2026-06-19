const WHITE_NOTES = new Set(["C", "D", "E", "F", "G", "A", "B"]);
const DEFAULT_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "z", "x", "c", "v", "b"];

function createNoteButton(note, label, className, audio) {
  const button = document.createElement("button");
  const info = audio.getNoteInfo(note);
  button.type = "button";
  button.className = className;
  button.dataset.note = note;
  button.dataset.frequency = info.frequency.toFixed(2);
  button.dataset.octave = String(info.octave);
  button.setAttribute("aria-label", `${label || note}, ${info.frequency.toFixed(2)} hertz`);
  button.title = `${note} | ${info.frequency.toFixed(2)} Hz | Octave ${info.octave}`;
  button.innerHTML = `<span>${label || note}</span><small>${note}</small>`;

  button.addEventListener("mouseenter", () => {
    button.dispatchEvent(new CustomEvent("notepreview", { bubbles: true, detail: { note, frequency: info.frequency, octave: info.octave } }));
  });
  return button;
}

function buildNotes(audio, root, count, octaveShift = 0) {
  const start = audio.noteToMidi(root) + octaveShift * 12;
  return Array.from({ length: count }, (_, index) => audio.midiToNote(start + index));
}

// Renders the DOM for an instrument and returns its key map. Input handling
// (pointer/keyboard/MIDI) lives entirely in KeyboardManager, so renderers are
// pure view code with no event wiring of their own.
export function renderInstrument(surface, instrument, audio, options = {}) {
  surface.innerHTML = "";
  surface.className = `instrument-surface ${instrument.type}-surface`;

  if (instrument.type === "keyboard") return renderKeyboard(surface, instrument, audio, options);
  if (instrument.type === "strings") return renderStrings(surface, instrument, audio, options);
  if (instrument.type === "drums") return renderDrums(surface, instrument, audio);
  if (instrument.type === "bars") return renderBars(surface, instrument, audio, options);
  return renderWind(surface, instrument, audio, options);
}

function renderKeyboard(surface, instrument, audio, options) {
  const notes = buildNotes(audio, instrument.root, instrument.count, options.octaveShift);
  const keyboard = document.createElement("div");
  keyboard.className = "piano-board";
  const keyMap = {};
  let shortcutIndex = 0;

  notes.forEach((note) => {
    const name = note.replace(/-?\d+$/, "");
    const isWhite = WHITE_NOTES.has(name);
    const key = createNoteButton(note, "", isWhite ? "piano-key white-key" : "piano-key black-key", audio);
    const shortcut = instrument.shortcuts[shortcutIndex] || DEFAULT_KEYS[shortcutIndex];
    if (shortcut) {
      key.dataset.shortcut = shortcut.toLowerCase();
      keyMap[shortcut.toLowerCase()] = { note, element: key };
    }
    shortcutIndex += 1;
    keyboard.appendChild(key);
  });

  surface.appendChild(keyboard);
  return keyMap;
}

function renderStrings(surface, instrument, audio, options) {
  const board = document.createElement("div");
  board.className = `string-board ${instrument.id}-board`;
  const keyMap = {};
  let shortcutIndex = 0;

  instrument.strings.forEach((openNote, stringIndex) => {
    const string = document.createElement("div");
    string.className = "string-row";
    const label = document.createElement("span");
    label.className = "string-name";
    label.textContent = openNote;
    string.appendChild(label);

    for (let fret = 0; fret < instrument.frets; fret += 1) {
      const note = audio.transpose(openNote, fret + options.octaveShift * 12);
      const key = createNoteButton(note, fret === 0 ? "Open" : String(fret), "fret-button", audio);
      key.style.setProperty("--fret", String(fret));
      key.style.setProperty("--string", String(stringIndex));
      const shortcut = instrument.shortcuts[shortcutIndex] || DEFAULT_KEYS[shortcutIndex];
      if (shortcut) {
        key.dataset.shortcut = shortcut.toLowerCase();
        keyMap[shortcut.toLowerCase()] = { note, element: key };
      }
      shortcutIndex += 1;
      string.appendChild(key);
    }
    board.appendChild(string);
  });

  surface.appendChild(board);
  return keyMap;
}

function renderDrums(surface, instrument, audio) {
  const grid = document.createElement("div");
  grid.className = "drum-grid";
  const keyMap = {};

  instrument.pads.forEach(([id, label, note], index) => {
    const pad = createNoteButton(note, label, "drum-pad", audio);
    pad.dataset.pad = id;
    const shortcut = instrument.shortcuts[index] || DEFAULT_KEYS[index];
    if (shortcut) {
      pad.dataset.shortcut = shortcut.toLowerCase();
      keyMap[shortcut.toLowerCase()] = { note, element: pad };
    }
    grid.appendChild(pad);
  });

  surface.appendChild(grid);
  return keyMap;
}

function renderBars(surface, instrument, audio, options) {
  const notes = buildNotes(audio, instrument.root, instrument.count, options.octaveShift);
  const bars = document.createElement("div");
  bars.className = "bar-board";
  const keyMap = {};

  notes.forEach((note, index) => {
    const bar = createNoteButton(note, note, "tone-bar", audio);
    bar.style.setProperty("--bar-width", `${100 - index * 3}%`);
    const shortcut = instrument.shortcuts[index] || DEFAULT_KEYS[index];
    if (shortcut) {
      bar.dataset.shortcut = shortcut.toLowerCase();
      keyMap[shortcut.toLowerCase()] = { note, element: bar };
    }
    bars.appendChild(bar);
  });

  surface.appendChild(bars);
  return keyMap;
}

function renderWind(surface, instrument, audio, options) {
  const notes = buildNotes(audio, instrument.root, instrument.count, options.octaveShift);
  const body = document.createElement("div");
  body.className = `wind-body ${instrument.id}-body`;
  const keyMap = {};

  const mouthpiece = document.createElement("span");
  mouthpiece.className = "mouthpiece";
  body.appendChild(mouthpiece);

  notes.forEach((note, index) => {
    const key = createNoteButton(note, note, "wind-key", audio);
    const shortcut = instrument.shortcuts[index] || DEFAULT_KEYS[index];
    if (shortcut) {
      key.dataset.shortcut = shortcut.toLowerCase();
      keyMap[shortcut.toLowerCase()] = { note, element: key };
    }
    body.appendChild(key);
  });

  const bell = document.createElement("span");
  bell.className = "bell";
  body.appendChild(bell);
  surface.appendChild(body);
  return keyMap;
}

export function animatePlayed(element) {
  if (!element) return;
  element.classList.add("is-playing");
  window.setTimeout(() => element.classList.remove("is-playing"), 220);
}

export function highlightScale(surface, notes) {
  const pitchClasses = new Set(notes.map((note) => note.replace(/-?\d+$/, "")));
  surface.querySelectorAll("[data-note]").forEach((node) => {
    const pitch = node.dataset.note.replace(/-?\d+$/, "");
    node.classList.toggle("is-scale", pitchClasses.has(pitch));
  });
}
