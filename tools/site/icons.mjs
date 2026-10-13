// 生成 PWA 图标（PNG）。零依赖：PNG 用 Node 自带的 zlib 手写，形状用简单的距离场画，
// 免得为了几张图标去引 sharp / canvas 这类需要联网安装的东西。
// 由 tools/site/build.mjs 调用，产物在 site/icons/。
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = ~0; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (~c) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 位深、RGBA
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSeg(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const hh = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * hh, pay - bay * hh);
}
// 品牌色竖向渐变 + 白色对勾；maskable 版铺满整块，图案缩小，交给系统去裁
function makeIcon(size, maskable) {
  const S = 3, n = S * S;
  const cx = size / 2, cy = size / 2;
  const pad = maskable ? size * 0.07 : 0;
  const hw = size / 2 - pad, hh = size / 2 - pad;
  const rad = maskable ? size * 0.5 : size * 0.225;
  const b1 = [0x34, 0x51, 0xb2], b2 = [0x56, 0x72, 0xcd];
  const sc = maskable ? 0.62 : 0.8;
  const P = (nx, ny) => [cx + (nx - 0.5) * size * sc, cy + (ny - 0.5) * size * sc];
  const A = P(0.22, 0.52), B = P(0.42, 0.72), C = P(0.80, 0.28);
  const th = size * (maskable ? 0.072 : 0.084);
  return (x, y) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const px = x + (sx + 0.5) / S, py = y + (sy + 0.5) / S;
      const cov = clamp(0.5 - sdRoundRect(px, py, cx, cy, hw, hh, rad), 0, 1);
      if (cov <= 0) continue;
      const t = py / size;
      let cr = b1[0] + (b2[0] - b1[0]) * t, cg = b1[1] + (b2[1] - b1[1]) * t, cb = b1[2] + (b2[2] - b1[2]) * t;
      const dc = Math.min(sdSeg(px, py, A[0], A[1], B[0], B[1]), sdSeg(px, py, B[0], B[1], C[0], C[1]));
      if (th / 2 + 0.5 - dc > 0) { cr = 255; cg = 255; cb = 255; }
      r += cr * cov; g += cg * cov; b += cb * cov; a += cov;
    }
    if (a <= 0) return [0, 0, 0, 0];
    return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(255 * Math.min(1, a / n))];
  };
}

export function writeIcons(dir) {
  mkdirSync(dir, { recursive: true });
  const defs = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, true],
  ];
  for (const [name, size, maskable] of defs) writeFileSync(join(dir, name), png(size, makeIcon(size, maskable)));
  return defs.length;
}
