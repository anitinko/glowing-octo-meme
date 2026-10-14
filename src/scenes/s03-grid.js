import { C, W, H, MX } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, fitSize, metrics } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp } from '../lib/math.js';
import { bg, line, circle, selection, dimension, arrowCursor } from '../lib/draw.js';
import { rgba } from '../lib/color.js';

// 01 / Grid — the red frame splits into a 12-column layout grid (Figma-style),
// a block is drawn, dragged and snapped to the grid, redlines measure everything.

const START = 8.0;
const END = 12.0;
const GUT = 24;
const COLS = 12;
const CW = (W - 2 * MX - (COLS - 1) * GUT) / COLS; // 122
const colX = (i) => MX + i * (CW + GUT);
const span = (i, j) => colX(j) + CW - colX(i);
const HFAM = F.U(800);

let geo = null;
function geom(ctx) {
  if (geo) return geo;
  const trEm = -0.03;
  const size = Math.floor(fitSize(ctx, HFAM, 'СЕТКОЙ', span(0, 7), trEm));
  const m = metrics(ctx, HFAM, size);
  const b1 = Math.round(300 + m.cap);
  geo = { size, tr: trEm * size, cap: m.cap, b1, b2: b1 + Math.round(size * 1.02) };
  return geo;
}

const IMG = { x: colX(8), y: 144, w: span(8, 11), h: 456 };
const OFF = { x: -190, y: 130 };
const T = { blockIn: 0.86, blockGrow: 1.12, moveA: 1.18, moveB: 1.5, headClick: 2.0 };

function imgRect(lt) {
  const g = E.outCubic(prog(lt, T.blockIn, T.blockGrow));
  const m = E.snap(prog(lt, T.moveA, T.moveB));
  const d = lt - T.moveB;
  const settle = d > 0 ? Math.sin(Math.min(1, d / 0.22) * Math.PI) * Math.exp(-d * 9) * 7 : 0;
  return { x: IMG.x + OFF.x * (1 - m), y: IMG.y + OFF.y * (1 - m) + settle, w: IMG.w * g, h: IMG.h * g, g, m };
}

function cursor(lt, g) {
  const br = (r) => [r.x + r.w, r.y + r.h];
  const headPt = [colX(5) + 40, g.b1 - g.cap * 0.4];
  if (lt < 0.7) return null;
  if (lt < T.blockIn) {
    const p = E.outCubic(prog(lt, 0.7, T.blockIn));
    return [lerp(1560, IMG.x + OFF.x, p), lerp(1150, IMG.y + OFF.y, p)];
  }
  if (lt < T.moveB + 0.12) return br(imgRect(lt));
  if (lt < 1.95) {
    const p = E.inOutCubic(prog(lt, 1.62, 1.95));
    const a = br(IMG);
    return [lerp(a[0], headPt[0], p), lerp(a[1], headPt[1], p)];
  }
  if (lt < 2.7) return headPt;
  const p = E.inOutCubic(prog(lt, 2.7, 3.3));
  return [lerp(headPt[0], 1640, p), lerp(headPt[1], 1000, p)];
}

function drawImgBlock(ctx, r) {
  if (r.g <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = C.ink;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const ox = r.x;
  const oy = r.y;
  circle(ctx, ox + IMG.w * 0.64, oy + IMG.h * 0.4, 118, C.red);
  ctx.fillStyle = C.ink;
  for (let i = 0; i < 7; i++) {
    const y = oy + IMG.h * 0.58 + i * 22;
    ctx.fillRect(ox, y, IMG.w, 9 + i * 1.2);
  }
  ctx.fillStyle = rgba(C.paper, 0.9);
  for (let i = 0; i < 6; i++) ctx.fillRect(ox, oy + IMG.h * 0.66 + i * 26, IMG.w, 2 + i * 0.6);
  txt(ctx, 'IMG_0001.PNG', ox + 18, oy + 32, { fam: F.M(500), size: 15, color: rgba(C.paper, 0.6), tracking: 1 });
  ctx.restore();
}

function draw(ctx, lt) {
  const g = geom(ctx);
  bg(ctx, C.paper);
  const cam = 1 + 0.018 * E.inOutCubic(clamp(lt / 4));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam, cam);
  ctx.translate(-W / 2, -H / 2);

  // baseline grid
  const bgp = E.outExpo(prog(lt, 0.3, 1.0));
  ctx.fillStyle = rgba(C.ink, 0.06);
  for (let y = 48; y < H; y += 48) ctx.fillRect(0, y, W * bgp, 1);

  // columns: full-bleed red → translucent layout columns
  const flash = lt > T.moveB ? Math.exp(-(lt - T.moveB) * 4.5) : 0;
  for (let i = 0; i < COLS; i++) {
    const d = Math.abs(i - 5.5) * 0.018;
    const p = E.snap(clamp((lt - d) / 0.55));
    const x = lerp((i * W) / COLS, colX(i), p);
    const w = lerp(W / COLS + 1, CW, p);
    let a = lerp(1, 0.12, E.outCubic(clamp((lt - d - 0.12) / 0.45)));
    if (i >= 8) a += 0.22 * flash;
    ctx.fillStyle = rgba(C.red, a);
    ctx.fillRect(x, -80, w, H + 160);
  }
  // column edges
  ctx.fillStyle = rgba(C.red, 0.5);
  for (let i = 0; i < COLS; i++) {
    const p = E.outExpo(clamp((lt - 0.28 - i * 0.022) / 0.5));
    const h = H * p;
    ctx.fillRect(colX(i), 0, 1, h);
    ctx.fillRect(colX(i) + CW - 1, H - h, 1, h);
  }

  // headline
  const row = (str, baseline, d0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, baseline - g.cap - 30, W, g.cap + 30 + g.size * 0.08);
    ctx.clip();
    chars(ctx, str, colX(0) - g.size * 0.03, baseline, {
      fam: HFAM,
      size: g.size,
      color: C.ink,
      tracking: g.tr,
      each: (i) => {
        const p = E.outExpo(clamp((lt - d0 - i * 0.035) / 0.6));
        return { dy: (1 - p) * g.size * 1.3 };
      },
    });
    ctx.restore();
  };
  row('ДУМАЮ', g.b1, 0.42);
  row('СЕТКОЙ', g.b2, 0.52);

  // image block
  const r = imgRect(lt);
  drawImgBlock(ctx, r);
  // text lines under the block
  [IMG.w, IMG.w, IMG.w * 0.6].forEach((w, i) => {
    const p = E.outExpo(clamp((lt - 1.58 - i * 0.07) / 0.45));
    ctx.fillStyle = rgba(C.ink, 0.85);
    ctx.fillRect(IMG.x, IMG.y + IMG.h + 48 + i * 32, w * p, 12);
  });

  // spec caption
  ['сетка — 12 колонок', 'модуль — 8 pt', 'поля 96 · гаттер 24'].forEach((s, i) => {
    const n = Math.floor(clamp((lt - 1.72 - i * 0.12) / 0.22) * s.length);
    if (n) txt(ctx, s.slice(0, n), colX(0), 852 + i * 36, { fam: F.M(500), size: 24, color: C.ink });
  });
  ctx.fillStyle = C.red;
  ctx.fillRect(colX(0), 806, 40 * E.outExpo(prog(lt, 1.66, 2.0)), 6);

  // redlines
  const ra = (k) => E.outCubic(prog(lt, 2.1 + k * 0.1, 2.35 + k * 0.1));
  dimension(ctx, 0, 236, colX(0), 236, '96', { alpha: ra(0) });
  dimension(ctx, colX(7) + CW, 690, colX(8), 690, '24', { alpha: ra(1) });
  dimension(ctx, IMG.x + IMG.w - 60, IMG.y + IMG.h, IMG.x + IMG.w - 60, IMG.y + IMG.h + 48, '48', { alpha: ra(2) });
  dimension(ctx, colX(0) - 40, g.b1 - g.cap, colX(0) - 40, g.b1, String(Math.round(g.cap)), { alpha: ra(3) });

  // selection on the dragged block
  const sa = lt < T.blockIn ? 0 : 1 - prog(lt, 1.75, 1.95);
  if (sa > 0) selection(ctx, r.x, r.y, r.w, r.h, { label: `${Math.round(r.w)} × ${Math.round(r.h)}`, alpha: sa });
  // headline selection
  const ha = lt < T.headClick ? 0 : Math.min(1, (lt - T.headClick) / 0.06) * (1 - prog(lt, 3.3, 3.5));
  if (ha > 0) selection(ctx, colX(0) - 10, g.b1 - g.cap - 14, span(0, 7) + 20, g.b2 - g.b1 + g.cap + 28, { label: `Unbounded ExtraBold · ${g.size}`, alpha: ha });

  const cp = cursor(lt, g);
  if (cp) {
    const press = (lt > T.blockIn && lt < T.moveB) || (lt > T.headClick - 0.04 && lt < T.headClick + 0.08);
    arrowCursor(ctx, cp[0], cp[1], press ? 1.12 : 1.2, '#FFFFFF', C.ink);
  }
  ctx.restore();
}

const cues = [
  ...Array.from({ length: 12 }, (_, i) => ({ t: START + 0.28 + i * 0.022, type: 'tick', f: 2200 + i * 90, v: 0.35 })),
  { t: START + T.blockIn, type: 'click' },
  { t: START + T.moveA, type: 'swish' },
  { t: START + T.moveB, type: 'snap' },
  { t: START + 1.58, type: 'tick', f: 1900 },
  { t: START + T.headClick, type: 'click' },
  ...[0, 1, 2, 3].map((k) => ({ t: START + 2.1 + k * 0.1, type: 'blip', f: 1700 + k * 220, v: 0.5 })),
];

export default {
  id: 'grid',
  start: START,
  end: END,
  theme: (lt) => (lt < 0.3 ? 'red' : 'light'),
  draw,
  blur: (lt) => (lt < 0.6 || (lt > T.moveA && lt < T.moveB + 0.05) ? 5 : 1),
  cues,
};
