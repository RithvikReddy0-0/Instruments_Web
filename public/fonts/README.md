# Display typeface — PP Editorial New

OPUS uses **PP Editorial New** (Pangram Pangram Foundry) for hero and section
headings. It is a **licensed** font, so the files are not committed here.

## Activate (drop-in)

1. Purchase a web license and export `woff2` files from Pangram Pangram.
2. Place them in this folder:
   - `PPEditorialNew-Regular.woff2`
   - `PPEditorialNew-Italic.woff2`
   - `PPEditorialNew-Ultralight.woff2` (optional, for the lightest hero weight)
3. In `style.css`, uncomment the `@font-face` block directly under the `:root`
   token section.

Until then, headings fall back gracefully to a high-contrast serif stack
(`Fraunces` / `Newsreader` if locally installed → Georgia → system serif), so
the layout and hierarchy are already correct — only the exact letterforms swap.

The files are precached by the service worker once present, so the app stays
fully offline.
