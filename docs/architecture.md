# Architecture

InstrumentHub V2 is intentionally deployable as plain static files.

## Modules

- `src/main.js`: app state, event orchestration, modes, recording controls, keyboard input
- `src/audio/engine.js`: Web Audio context, polyphonic voices, envelopes, note math
- `src/audio/metronome.js`: tempo-controlled click scheduling
- `src/audio/recorder.js`: note timing capture, replay, local save, JSON export
- `src/data/instruments.js`: product metadata, timbres, layouts, shortcuts
- `src/instruments/renderers.js`: DOM renderers for keyboard, strings, drums, bars, and wind instruments
- `src/ui/theme.js`: persisted theme toggle
- `src/ui/visualizer.js`: hero canvas and analyser-driven frequency bars

## Data Flow

1. User selects an instrument card.
2. `main.js` loads metadata from `instruments.js`.
3. `renderers.js` creates accessible note controls and keyboard mappings.
4. User interaction calls the audio engine.
5. The recorder stores timing events when active.
6. The visualizer reads analyser data from the audio engine.

## Extension Points

- Add an instrument by adding metadata to `instruments.js`.
- Add a renderer branch if the instrument needs a new physical layout.
- Add a timbre object to customize oscillator, filter, and ADSR behavior.
