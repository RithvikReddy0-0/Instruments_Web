# Contributing

Thanks for improving InstrumentHub.

## Local Development

Run a static server from the project root:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`.

## Guidelines

- Keep the app static and dependency-free unless a feature clearly requires otherwise.
- Prefer small ES modules over adding logic to `src/main.js`.
- Every playable note should expose note name, frequency, octave, and an accessible label.
- Preserve keyboard, mouse, and touch support.
- Test desktop and mobile widths before submitting changes.

## Pull Request Checklist

- No console errors
- No horizontal overflow
- Focus states are visible
- Reduced motion still works
- README and changelog are updated when features change
