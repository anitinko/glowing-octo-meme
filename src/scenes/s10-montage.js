import { C, W, H, MX } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, fitSize, metrics, layout } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, hash1, TAU } from '../lib/math.js';
import { bg, rrect, circle, line } from '../lib/draw.js';
import { rgba } from '../lib/color.js';
import { emblem } from '../lib/emblem.js';

// 08 / Everything at once — sixteen one-beat cards, one discipline each.

const START = 36.0;
const END = 44.0;
const CARD = 0.5;
const U9 = F.U(900);

function bigWord(ctx, str, cy, l, o = {}) {
  const { fam = U9, color = C.ink, maxW = W - 2 * MX, maxSize = 400, tr = -0.035, x = W / 2, align = 'center', stroke } = o;
  const size = Math.floor(Math.min(maxSize, fitSize(ctx, fam, str, maxW, tr)));
  const m = metrics(ctx, fam, size);
  const base = cy + m.cap / 2;
  if (stroke) {
    ctx.save();
    ctx.font = `${size}px "${fam}"`;
    ctx.letterSpacing = `${tr * size}px`;
    ctx.lineWidth = stroke[1];
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke[0];
    const w = layout(ctx, fam, size, str, tr * size).width;
    const ox = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.strokeText(str, ox, base);
    ctx.restore();
  }
  chars(ctx, str, x, base, {
    fam,
    size,
    color,
    tracking: tr * size,
    align,
    each: (i) => {
      const p = E.outExpo(clamp((l - i * 0.016) / 0.2));
      return { dy: (1 - p) * size * 0.45, alpha: clamp(p * 3) };
    },
  });
  return { size, cap: m.cap, base };
}

function starPath(ctx, x, y, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

const ICONS = [
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-40, -2);
    ctx.lineTo(0, -38);
    ctx.lineTo(40, -2);
    ctx.moveTo(-28, -12);
    ctx.lineTo(-28, 36);
    ctx.lineTo(28, 36);
    ctx.lineTo(28, -12);
    ctx.moveTo(-8, 36);
    ctx.lineTo(-8, 12);
    ctx.lineTo(8, 12);
    ctx.lineTo(8, 36);
  },
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.bezierCurveTo(-56, 0, -44, -44, 0, -18);
    ctx.bezierCurveTo(44, -44, 56, 0, 0, 34);
  },
  (ctx) => starPath(ctx, 0, 2, 40, 17),
  (ctx) => {
    ctx.beginPath();
    ctx.arc(-6, -6, 26, 0, TAU);
    ctx.moveTo(13, 13);
    ctx.lineTo(36, 36);
  },
  (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
      ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38);
    }
    ctx.moveTo(26, 0);
    ctx.arc(0, 0, 26, 0, TAU);
  },
  (ctx) => {
    ctx.beginPath();
    ctx.roundRect(-40, -32, 80, 56, 16);
    ctx.moveTo(-18, 24);
    ctx.lineTo(-24, 40);
    ctx.lineTo(0, 24);
  },
];

function meander(ctx, x0, y0, u, n) {
  // classic Greek key unit on a 6×6 lattice
  const pts = [
    [0, 6],
    [0, 0],
    [5, 0],
    [5, 4],
    [2, 4],
    [2, 2],
    [3, 2],
  ];
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const ox = x0 + k * 6 * u;
    pts.forEach(([px, py], j) => (j ? ctx.lineTo(ox + px * u, y0 + py * u) : ctx.moveTo(ox + px * u, y0 + py * u)));
    ctx.moveTo(ox, y0 + 6 * u);
    ctx.lineTo(ox + 6 * u, y0 + 6 * u);
  }
}

const CARDS = [
  // 1 brands
  (ctx, l) => {
    bg(ctx, C.red);
    ctx.save();
    ctx.translate(1590, 270);
    ctx.rotate(l * 2.4);
    txt(ctx, '®', -110, 95, { fam: F.U(400), size: 300, color: C.paper });
    ctx.restore();
    bigWord(ctx, 'БРЕНДЫ', H / 2 + 60, l, { color: C.ink });
  },
  // 2 interfaces
  (ctx, l) => {
    bg(ctx, C.paper);
    const p = E.outExpo(clamp(l / 0.25));
    const ww = 1420 * (0.9 + 0.1 * p);
    const wh = 760 * (0.9 + 0.1 * p);
    const x = W / 2 - ww / 2;
    const y = H / 2 - wh / 2;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    rrect(ctx, x, y, ww, wh, 26);
    ctx.stroke();
    line(ctx, x, y + 64, x + ww, y + 64, C.ink, 3);
    for (let i = 0; i < 3; i++) circle(ctx, x + 40 + i * 30, y + 32, 9, i ? null : C.red, C.ink, 3);
    ctx.strokeRect(x + 30, y + 94, 260, wh - 124);
    for (let i = 0; i < 3; i++) ctx.strokeRect(x + 330 + i * ((ww - 360) / 3), y + wh - 260, (ww - 360) / 3 - 30, 230);
    ctx.restore();
    bigWord(ctx, 'ИНТЕРФЕЙСЫ', H / 2 - 40, l, { color: C.red, maxW: 1500 });
  },
  // 3 icons
  (ctx, l) => {
    bg(ctx, C.ink);
    ICONS.forEach((ic, i) => {
      const p = E.outBack(clamp((l - i * 0.035) / 0.22), 2.2);
      if (p <= 0) return;
      ctx.save();
      ctx.translate(W / 2 + (i - 2.5) * 250, 360);
      ctx.scale(1.5 * p, 1.5 * p);
      ctx.strokeStyle = i === 1 ? C.red : C.paper;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ic(ctx);
      ctx.stroke();
      ctx.restore();
    });
    bigWord(ctx, 'ИКОНКИ', 760, l, { color: C.paper, maxW: 1400 });
  },
  // 4 posters
  (ctx, l) => {
    bg(ctx, C.bronze);
    const p = E.outExpo(clamp(l / 0.3));
    circle(ctx, 1360, 400, 330 * p, C.ink);
    circle(ctx, 1080, 230, 80 * E.outBack(clamp((l - 0.05) / 0.25), 2), C.red);
    ctx.fillStyle = C.ink;
    for (const x of [MX, W - MX]) ctx.fillRect(x, 0, 2, H * p);
    txt(ctx, '№ 04 — 2026', MX + 24, 170, { fam: F.M(700), size: 22, color: C.ink, tracking: 3, alpha: p });
    bigWord(ctx, 'ПОСТЕРЫ', 800, l, { color: C.ink, align: 'left', x: MX + 20, maxW: 1250 });
  },
  // 5 motion
  (ctx, l) => {
    bg(ctx, C.blue);
    const fam = U9;
    const size = Math.floor(fitSize(ctx, fam, 'МОУШЕН', 1500, -0.03));
    const m = metrics(ctx, fam, size);
    const x = W / 2 - 160 + 220 * E.outExpo(clamp(l / 0.35));
    for (let j = 7; j >= 1; j--) txt(ctx, 'МОУШЕН', x - j * 46, H / 2 + m.cap / 2, { fam, size, color: C.paper, align: 'center', tracking: -0.03 * size, alpha: 0.1 * (1 - j / 8) });
    txt(ctx, 'МОУШЕН', x, H / 2 + m.cap / 2, { fam, size, color: C.paper, align: 'center', tracking: -0.03 * size });
  },
  // 6 typography
  (ctx, l) => {
    bg(ctx, C.paper);
    const fams = [U9, F.P('900i'), F.M(800), F.S(800), F.U(200), F.P(400)];
    const word = Array.from('ТИПОГРАФИКА');
    const step = Math.floor(l / 0.125);
    const base = 100;
    const ws = word.map((ch, i) => layout(ctx, fams[(i + step) % fams.length], base, ch, 0).width);
    const total = ws.reduce((a, b) => a + b, 0);
    const size = Math.min(300, (1700 / total) * base);
    let x = W / 2 - (total * size) / base / 2;
    word.forEach((ch, i) => {
      const fam = fams[(i + step) % fams.length];
      txt(ctx, ch, x, H / 2 + size * 0.36, { fam, size, color: i % 4 === 1 ? C.red : C.ink });
      x += (ws[i] * size) / base;
    });
  },
  // 7 logos
  (ctx, l) => {
    bg(ctx, C.ink);
    const p = E.outBack(clamp(l / 0.25), 1.8);
    emblem(ctx, W / 2, 400, 230 * p, { shield: C.red, body: C.ink, crest: C.ink });
    bigWord(ctx, 'ЛОГОТИПЫ', 840, l, { color: C.paper, maxW: 1300 });
  },
  // 8 systems
  (ctx, l, gt) => {
    bg(ctx, C.lime);
    const step = Math.floor(gt / 0.0625);
    const cols = 26;
    const rows = 11;
    const s = 36;
    const gap = 30;
    const x0 = W / 2 - (cols * (s + gap) - gap) / 2;
    const y0 = H / 2 - (rows * (s + gap) - gap) / 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const h = hash1(r * 97 + c * 13 + step * 7.13);
        ctx.fillStyle = h > 0.86 ? C.red : rgba(C.ink, 0.85);
        const z = h > 0.86 ? 1 : 0.55;
        ctx.fillRect(x0 + c * (s + gap) + (s * (1 - z)) / 2, y0 + r * (s + gap) + (s * (1 - z)) / 2, s * z, s * z);
      }
    bigWord(ctx, 'СИСТЕМЫ', H / 2, l, { color: C.ink, maxW: 1400, stroke: [C.lime, 44] });
  },
  // 9 illustrations
  (ctx, l, gt) => {
    bg(ctx, C.red);
    circle(ctx, 430, 330 + Math.sin(gt * 12) * 18, 190 * E.outBack(clamp(l / 0.25)), C.paper);
    ctx.save();
    ctx.translate(1500, 330);
    ctx.rotate(gt * 2);
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(130, 75);
    ctx.lineTo(-130, 75);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 900 + Math.sin(x / 70 + gt * 14) * 36);
    ctx.strokeStyle = C.bronze;
    ctx.lineWidth = 16;
    ctx.stroke();
    bigWord(ctx, 'Иллюстрации', H / 2 + 20, l, { fam: F.P('900i'), color: C.paper, maxW: 1500, tr: -0.01 });
  },
  // 10 prototypes
  (ctx, l) => {
    bg(ctx, C.paper);
    const labels = ['вход', 'экран', 'успех'];
    labels.forEach((lb, i) => {
      const p = E.outExpo(clamp((l - i * 0.08) / 0.2));
      const x = 290 + i * 520;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      rrect(ctx, x, 230, 300, 190, 20);
      if (i === 2) {
        ctx.fillStyle = C.red;
        ctx.fill();
      }
      ctx.stroke();
      txt(ctx, lb, x + 150, 338, { fam: F.M(700), size: 30, color: i === 2 ? C.paper : C.ink, align: 'center' });
      ctx.restore();
      if (i < 2) {
        const a = E.outExpo(clamp((l - 0.08 - i * 0.08) / 0.18));
        const x1 = x + 310;
        const x2 = x1 + 200 * a;
        line(ctx, x1, 325, x2, 325, C.ink, 4);
        if (a > 0.9) {
          ctx.beginPath();
          ctx.moveTo(x2, 325);
          ctx.lineTo(x2 - 18, 312);
          ctx.lineTo(x2 - 18, 338);
          ctx.closePath();
          ctx.fillStyle = C.ink;
          ctx.fill();
        }
      }
    });
    bigWord(ctx, 'ПРОТОТИПЫ', 770, l, { color: C.ink, maxW: 1500 });
  },
  // 11 3D
  (ctx, l, gt) => {
    bg(ctx, C.ink);
    const fam = U9;
    const m = metrics(ctx, fam, 640);
    txt(ctx, '3D', W / 2, H / 2 + m.cap / 2, { fam, size: 640, color: C.red, align: 'center', tracking: -20, alpha: E.outExpo(clamp(l / 0.2)) });
    const V = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
    const ay = gt * 2.6;
    const ax = 0.6 + gt * 1.1;
    const P = V.map(([x, y, z]) => {
      let X = x * Math.cos(ay) + z * Math.sin(ay);
      let Z = -x * Math.sin(ay) + z * Math.cos(ay);
      const Y = y * Math.cos(ax) - Z * Math.sin(ax);
      Z = y * Math.sin(ax) + Z * Math.cos(ax);
      const k = 900 / (Z + 4.2);
      return [W / 2 + X * k * 0.95, H / 2 + Y * k * 0.95];
    });
    ctx.strokeStyle = C.paper;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let a = 0; a < 8; a++)
      for (let b = a + 1; b < 8; b++) {
        const d = V[a].reduce((s, v, j) => s + (v !== V[b][j] ? 1 : 0), 0);
        if (d === 1) {
          ctx.moveTo(P[a][0], P[a][1]);
          ctx.lineTo(P[b][0], P[b][1]);
        }
      }
    ctx.stroke();
    for (const [x, y] of P) circle(ctx, x, y, 9, C.paper);
  },
  // 12 identity
  (ctx, l) => {
    bg(ctx, C.bronze);
    for (let j = 0; j < 9; j++) {
      const r = ((l * 900 + j * 110) % 990) + 10;
      circle(ctx, W / 2, H / 2, r, null, rgba(C.ink, Math.max(0, 1 - r / 990)), 5);
    }
    bigWord(ctx, 'АЙДЕНТИКА', H / 2, l, { color: C.ink, maxW: 1500, stroke: [C.bronze, 40] });
  },
  // 13 patterns
  (ctx, l, gt) => {
    bg(ctx, C.ink);
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 9;
    ctx.lineCap = 'square';
    const u = 16;
    for (let r = 0; r < 6; r++) {
      const dir = r % 2 ? -1 : 1;
      const off = ((gt * 380 * dir) % (6 * u)) - 6 * u * 2;
      meander(ctx, off, 60 + r * 170, u, 26);
      ctx.stroke();
    }
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, H / 2 - 150, W, 300);
    bigWord(ctx, 'ПАТТЕРНЫ', H / 2, l, { color: C.paper, maxW: 1400, maxSize: 230 });
  },
  // 14 layout
  (ctx, l) => {
    bg(ctx, C.paper);
    ctx.fillStyle = C.red;
    ctx.fillRect(MX, 470, (W - 2 * MX) * E.outExpo(clamp(l / 0.25)), 8);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 9; r++) {
        const p = E.outExpo(clamp((l - (c * 9 + r) * 0.006) / 0.2));
        const w = (r === 8 ? 0.55 : 1) * 380;
        ctx.fillStyle = rgba(C.ink, 0.8);
        ctx.fillRect(MX + c * 444, 540 + r * 44, w * p, 14);
      }
    bigWord(ctx, 'ВЁРСТКА', 290, l, { color: C.ink, maxW: 1300, align: 'left', x: MX - 8 });
  },
  // 15 color
  (ctx, l, gt) => {
    const pal = [C.red, C.blue, C.lime, C.bronze];
    bg(ctx, pal[Math.floor(gt / 0.125) % pal.length]);
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    bigWord(ctx, 'ЦВЕТ', H / 2, l, { color: '#FFFFFF', maxSize: 460 });
    ctx.restore();
  },
  // 16 and code
  (ctx, l) => {
    bg(ctx, C.ink);
    const word = 'и код.';
    const n = clamp(Math.floor(l / 0.045) + 1, 0, word.length);
    const fam = F.M(800);
    const size = 300;
    const m = metrics(ctx, fam, size);
    const w = layout(ctx, fam, size, word, 0).width;
    const x0 = W / 2 - w / 2 - 60;
    txt(ctx, word.slice(0, n), x0, H / 2 + m.cap / 2, { fam, size, color: C.paper });
    const cw = layout(ctx, fam, size, word.slice(0, n), 0).width;
    if (n < word.length || Math.floor(l / 0.125) % 2 === 0) {
      ctx.fillStyle = C.red;
      ctx.fillRect(x0 + cw + 18, H / 2 - m.cap / 2 - 10, 110, m.cap + 20);
    }
    txt(ctx, '</>', MX, 170, { fam: F.M(800), size: 40, color: C.red });
  },
];

function draw(ctx, lt, gt) {
  const k = Math.min(CARDS.length - 1, Math.floor(lt / CARD));
  const l = lt - k * CARD;
  const z = 1.06 - 0.06 * E.outCubic(clamp(l / CARD));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  CARDS[k](ctx, l, gt);
  ctx.restore();
}

const THEMES = ['red', 'light', 'dark', 'light', 'dark', 'light', 'dark', 'light', 'red', 'light', 'dark', 'light', 'dark', 'light', 'red', 'dark'];

const cues = [
  { t: START + 1.0, type: 'blip', f: 1760, v: 0.6 },
  { t: START + 2.0, type: 'whoosh', dur: 0.35 },
  { t: START + 3.0, type: 'pop', f: 600 },
  ...Array.from({ length: 8 }, (_, i) => ({ t: START + 3.5 + i * 0.0625, type: 'tick', f: 2400 + (i % 4) * 200, v: 0.35 })),
  { t: START + 5.0, type: 'whoosh', dur: 0.3 },
  { t: START + 6.0, type: 'swish' },
  ...Array.from({ length: 6 }, (_, i) => ({ t: START + 7.5 + i * 0.045, type: 'key', v: 0.9 })),
];

export default {
  id: 'montage',
  start: START,
  end: END,
  theme: (lt) => THEMES[Math.min(15, Math.floor(lt / CARD))],
  draw,
  blur: (lt) => {
    const k = Math.floor(lt / CARD);
    const l = lt - k * CARD;
    if (l < 0.12) return 4;
    return k === 4 || k === 10 ? 3 : 1;
  },
  cues,
};
