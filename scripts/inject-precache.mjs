/**
 * Post-build step: inject the hashed JS/CSS filenames into dist/sw.js so the
 * service worker precaches the whole app for offline use. Replaces the
 * /*__PRECACHE__*​/ placeholder in the built service worker.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const assetsDir = "dist/assets";
if (!existsSync(assetsDir)) {
  console.warn("[inject-precache] dist/assets not found — skipping");
  process.exit(0);
}

const assets = readdirSync(assetsDir)
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => `./assets/${f}`);

const swPath = "dist/sw.js";
const sw = readFileSync(swPath, "utf8");
const list = assets.map((a) => JSON.stringify(a)).join(", ");
const out = sw.replace("/*__PRECACHE__*/", list);
writeFileSync(swPath, out);
console.log(`[inject-precache] precaching ${assets.length} assets into sw.js`);
