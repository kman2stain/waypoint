// Generates the app icons into public/icons with no dependencies.
// A white map pin on a muted blue square, anti-aliased by 4x4 supersampling.
// Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [43, 76, 126]; // #2b4c7e
const FG = [255, 255, 255];
const OUT = new URL('../public/icons/', import.meta.url);

// ---- PNG encoding ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB, no alpha (iOS shows transparency as black)
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Shape: map pin in unit space, scaled about the centre ----
function makePin(scale) {
  const cx = 0.5;
  const cy = 0.5 - 0.09 * scale;
  const r = 0.2 * scale;
  const hole = 0.08 * scale;
  const tipY = cy + 0.36 * scale;
  const d = tipY - cy;
  const tanA = r / Math.sqrt(d * d - r * r);
  const coneTop = cy + (r * r) / d; // where the cone meets the circle tangentially
  return (x, y) => {
    const dx = x - cx;
    const dist = Math.hypot(dx, y - cy);
    if (dist <= hole) return false;
    if (dist <= r) return true;
    return y >= coneTop && y <= tipY && Math.abs(dx) <= (tipY - y) * tanA;
  };
}

function render(size, scale) {
  const inside = makePin(scale);
  const SS = 4;
  const rgb = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          if (inside((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)) hits++;
      const t = hits / (SS * SS);
      const i = (py * size + px) * 3;
      for (let c = 0; c < 3; c++) rgb[i + c] = Math.round(BG[c] + (FG[c] - BG[c]) * t);
    }
  }
  return encodePng(size, rgb);
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['apple-touch-icon-180.png', 180, 1],
  ['favicon-32.png', 32, 1.15],
  // Maskable: keep the glyph inside the central 80% safe zone.
  ['icon-maskable-512.png', 512, 0.78],
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, OUT), render(size, scale));
  console.log('wrote', name);
}
