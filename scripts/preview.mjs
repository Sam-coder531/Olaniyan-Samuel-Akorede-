/**
 * Renders the machine composition to a PNG so the artwork can be judged before
 * it is ever painted in a browser. Same geometry, same glow pass as lib/engine.ts.
 *
 *   node scripts/preview.mjs [out.png] [w] [h]
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { generateMachineStrokes } from "./composition.mjs";

const OUT = process.argv[2] || "preview.png";
const W = Number(process.argv[3] || 1000);
const H = Number(process.argv[4] || 700);
const SCALE = Math.min(W, H) / 1000;

const buf = new Float32Array(W * H * 3);
// background #08080a with a very slight warm lift in the middle
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot((x / W - 0.5) * 1.15, (y / H - 0.5) * 1.25);
    const glow = Math.max(0, 0.055 - d * 0.09);
    const i = (y * W + x) * 3;
    buf[i] = 0.031 + glow * 0.9;
    buf[i + 1] = 0.031 + glow * 0.72;
    buf[i + 2] = 0.039 + glow * 0.8;
  }
}

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

function blend(x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  const ia = 1 - a;
  buf[i] = buf[i] * ia + c[0] * a;
  buf[i + 1] = buf[i + 1] * ia + c[1] * a;
  buf[i + 2] = buf[i + 2] * ia + c[2] * a;
}

function seg(x0, y0, x1, y1, radius, c, alpha) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radius - 2));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + radius + 2));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radius - 2));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + radius + 2));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1e-6;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let t = ((px - x0) * dx + (py - y0) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
      const cover = Math.max(0, Math.min(1, radius + 0.5 - d));
      if (cover > 0) blend(x, y, c, alpha * cover);
    }
  }
}

function drawStroke(s) {
  const base = (s.width / 1000) * Math.min(W, H);
  const c = hex(s.color);
  const pts = s.points.map(([x, y, w]) => [x * W, y * H, w]);

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const wpx = base * ((a[2] + b[2]) / 2);
    if (s.width >= 3) seg(a[0], a[1], b[0], b[1], Math.max(wpx * 1.35, 0.6), c, s.alpha * 0.1);
    seg(a[0], a[1], b[0], b[1], Math.max(wpx * 0.5, 0.32), c, s.alpha);
  }
}

const t0 = Date.now();
const strokes = generateMachineStrokes();
for (const s of strokes) drawStroke(s);
console.log(`painted ${strokes.length} strokes in ${Date.now() - t0}ms`);

/* --- minimal PNG encoder -------------------------------------------------- */
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const o = y * (W * 3 + 1) + 1 + x * 3;
    for (let k = 0; k < 3; k++) {
      const v = buf[i + k];
      // filmic-ish curve + gentle vignette
      const vign = 1 - 0.5 * Math.pow(Math.hypot((x / W - 0.5) * 1.1, (y / H - 0.5) * 1.1) * 1.35, 2.2);
      const enc = Math.pow(Math.max(0, v * Math.max(0.35, vign)), 0.82);
      raw[o + k] = Math.max(0, Math.min(255, Math.round(enc * 255)));
    }
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${(png.length / 1024).toFixed(0)}kB)`);
