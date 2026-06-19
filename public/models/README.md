# Real 3D instrument models (drop-in)

The world shows a stylized **procedural placeholder** for each instrument and
automatically swaps in a real model the moment a matching file exists here — no
code change needed (same pattern as `public/fonts/`).

## How to add real models

Drop glTF binary files named exactly:

```
public/models/piano.glb
public/models/synth.glb
public/models/guitar.glb
public/models/violin.glb
```

On load, `src/world/instruments.js` calls `GLTFLoader.load('/models/<id>.glb')`.
If the file is present it replaces the placeholder (auto-centered + scaled to
~4 units). If it's absent the request 404s, is caught silently, and the
procedural placeholder stays — so the app is never broken and stays offline-safe.

## Requirements / tips

- **Format:** `.glb` (binary glTF) preferred. `.gltf` + external buffers also work
  if all referenced files are in this folder.
- **Draco compression:** if your models are Draco-compressed, a `DRACOLoader`
  must be registered — currently not wired (uncompressed/embedded glTF works out
  of the box). Ask and it's a 3-line addition.
- **Budget (mobile-friendly):** aim ≤ ~150k triangles and ≤ ~2 MB per model;
  bake materials to a single texture set where possible.
- **Orientation:** models are auto-centered and scaled, but +Y should be up and
  the "face" (keys/front) toward +Z for the showcase rotation to read well.
- **Licensing:** use assets you have the right to ship (CC0 / purchased / your
  own). Placeholders ship by default precisely so no third-party assets are
  bundled without your decision.

## Changing placement / which instrument shows

- Position/scale of the floating object: `group` transform in
  `src/world/instruments.js` (`createInstruments`).
- The world instrument follows the playground selection via
  `window.IHWorld.setInstrument(id)` (mapped in `src/main.js` → `WORLD_INSTRUMENT`).
