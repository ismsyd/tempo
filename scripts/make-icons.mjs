// Generates the extension's PNG icons (rounded beige tile + sage dot) with no image libraries.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size) {
  const bg = [0xf3, 0xf0, 0xea];
  const dot = [0x6f, 0x7f, 0x68];
  const r = size * 0.22; // corner radius
  const dr = size * 0.2; // dot radius
  const c = size / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      // rounded-rect coverage (simple anti-aliasing)
      const dx = Math.max(r - px, px - (size - r), 0);
      const dy = Math.max(r - py, py - (size - r), 0);
      const edge = r - Math.hypot(dx, dy);
      const a = Math.max(0, Math.min(1, edge + 0.5));
      const dd = dr - Math.hypot(px - c, py - c);
      const t = Math.max(0, Math.min(1, dd + 0.5));
      const col = bg.map((v, i) => Math.round(v * (1 - t) + dot[i] * t));
      row.push(...col, Math.round(a * 255));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = new URL("../apps/extension/icons/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(new URL(`${s}.png`, out), png(s));
console.log("icons written");
