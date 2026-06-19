/**
 * Generate brand PWA icons as real PNGs — no image library.
 * A minimal RGBA → PNG encoder (zlib + CRC32) draws the InstrumentHub
 * "equalizer" mark (dark panel + accent→mint bars). Run: npm run icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; };
const chunk = (type, data) => {
  const t = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
};
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8, 6, 0, 0, 0])]);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function makeIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b) => { const i = (y * size + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; };
  // dark panel background with a soft diagonal lift
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (2 * size);
      set(x, y, Math.round(12 + t * 10), Math.round(18 + t * 14), Math.round(28 + t * 18));
    }
  }
  const pad = size * (maskable ? 0.26 : 0.18);
  const area = size - pad * 2;
  const bars = 5;
  const gap = area * 0.06;
  const bw = (area - gap * (bars - 1)) / bars;
  const heights = [0.45, 0.72, 1.0, 0.58, 0.84];
  for (let bi = 0; bi < bars; bi += 1) {
    const bx = pad + bi * (bw + gap);
    const bh = area * heights[bi];
    const by = pad + (area - bh);
    for (let x = Math.floor(bx); x < bx + bw; x += 1) {
      for (let y = Math.floor(by); y < pad + area; y += 1) {
        const fx = (x - pad) / area;
        set(x, y, Math.round(69 + fx * 29), Math.round(185 + fx * 45), Math.round(255 - fx * 74));
      }
    }
  }
  return encodePNG(size, buf);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", makeIcon(192, false));
writeFileSync("public/icons/icon-512.png", makeIcon(512, false));
writeFileSync("public/icons/icon-maskable-512.png", makeIcon(512, true));
writeFileSync("public/icons/icon-180.png", makeIcon(180, false));
console.log("Generated PWA icons in public/icons/");
