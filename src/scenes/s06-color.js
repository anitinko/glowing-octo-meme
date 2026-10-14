import { C, W, H } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, fitSize, metrics } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, hash1 } from '../lib/math.js';
import { bg, circle, rrect } from '../lib/draw.js';
import { rgba, hex2rgb } from '../lib/color.js';

// 04 / Color — six palette stripes rise, hex codes roll like a slot machine,
// stripes reshuffle on the beat under a headline set in "difference" blend mode.

const START = 19.75;
const END = 24.0;
const L0 = 0.25;
const SWW = W / 6;
const SW = [
  { hex: '#FF3D21', name: 'Сигнальный', fg: C.ink },
  { hex: '#0D0D0F', name: 'Чернила', fg: C.paper },
  { hex: '#C9A063', name: 'Бронза', fg: C.ink },
  { hex: '#2D6BFF', name: 'Ультрамарин', fg: C.paper },
  { hex: '#D4F25A', name: 'Лайм', fg: C.ink },
  { hex: '#F2EEE6', name: 'Бумага', fg: C.ink },
];
const ORDERS = [
  [0, 1, 2, 3, 4, 5],
  [3, 0, 5, 1, 2, 4],
  [5, 2, 1, 4, 0, 3],
  [1, 4, 3, 0, 5, 2],
  [2, 5, 0, 3, 4, 1],
];
const SWAPS = [1.5, 2.0, 2.5, 3.0];
const HFAM = F.U(900);
const HEXCH = '0123456789ABCDEF';

let geo = null;
function geom(ctx) {
  if (geo) return geo;
  const trEm = -0.035;
  const size = Math.floor(fitSize(ctx, HFAM, 'ЧУВСТВУЮ', 1560, trEm));
  const m = metrics(ctx, HFAM, size);
  const b1 = Math.round(H / 2 - 40);
  geo = { size, tr: trEm * size, cap: m.cap, b1, b2: b1 + Math.round(size * 0.98) };
  return geo;
}

function slotOf(si, u) {
  let k = 0;
  while (k < SWAPS.length && u >= SWAPS[k]) k++;
  const cur = ORDERS[k].indexOf(si);
  if (k === 0) return cur;
  const p = E.snap(clamp((u - SWAPS[k - 1]) / 0.32));
  return lerp(ORDERS[k - 1].indexOf(si), cur, p);
}

function rollingHex(hex, u, t0, seed) {
  let out = '#';
  for (let d = 0; d < 6; d++) {
    const settle = t0 + d * 0.045;
    out += u >= settle ? hex[d + 1] : HEXCH[Math.floor(hash1(Math.floor(u * 40) + seed * 13 + d * 7) * 16)];
  }
  return out;
}

function draw(ctx, lt) {
  const u = lt - L0;
  const g = geom(ctx);
  const exiting = u > 3.4;
  if (exiting) bg(ctx, C.ink);

  // stripes
  for (let si = 0; si < SW.length; si++) {
    const sw = SW[si];
    const slot = slotOf(si, u);
    const x = Math.round(slot * SWW);
    const slotIdx = Math.round(slot);
    const rise = E.outExpo(clamp((lt - slotIdx * 0.012) / 0.18));
    const fall = E.inCubic(clamp((u - 3.44 - slotIdx * 0.035) / 0.26));
    const top = H * (1 - rise) + (H + 100) * fall;
    if (top >= H + 80) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, top, Math.ceil(SWW) + 1, H + 160);
    ctx.clip();
    ctx.fillStyle = sw.hex;
    ctx.fillRect(x, -80, Math.ceil(SWW) + 1, H + 160);
    const la = E.outExpo(prog(u, 0.1 + si * 0.05, 0.5 + si * 0.05));
    const [r, gg, b] = hex2rgb(sw.hex);
    txt(ctx, String(si + 1).padStart(2, '0'), x + 28, 168, { fam: F.M(800), size: 18, color: sw.fg, alpha: la, tracking: 2 });
    txt(ctx, sw.name, x + 28, 850, { fam: F.S(700), size: 30, color: sw.fg, alpha: la });
    txt(ctx, rollingHex(sw.hex, u, 0.25 + si * 0.06, si), x + 28, 890, { fam: F.M(500), size: 22, color: sw.fg, alpha: la, tracking: 1 });
    txt(ctx, `RGB ${r} ${gg} ${b}`, x + 28, 922, { fam: F.M(400), size: 16, color: sw.fg, alpha: la * 0.7, tracking: 1 });
    ctx.restore();
  }

  // headline in difference mode
  const head = (str, baseline, d0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, baseline - g.cap - 40, W, g.cap + 40 + g.size * 0.12);
    ctx.clip();
    ctx.globalCompositeOperation = 'difference';
    chars(ctx, str, W / 2, baseline, {
      fam: HFAM,
      size: g.size,
      color: '#FFFFFF',
      tracking: g.tr,
      align: 'center',
      each: (i, n) => {
        const pin = E.outExpo(clamp((u - d0 - i * 0.03) / 0.6));
        const pout = E.inExpo(clamp((u - 3.38 - (n - i) * 0.015) / 0.3));
        return { dy: (1 - pin) * g.size * 1.3 + pout * g.size * 1.3 };
      },
    });
    ctx.restore();
  };
  head('ЧУВСТВУЮ', g.b1, 0.05);
  head('ЦВЕТ', g.b2, 0.15);

  // colour picker loupe sweeping across the palette
  const la = Math.min(prog(u, 0.55, 0.7), 1 - prog(u, 1.3, 1.45));
  if (la > 0) {
    const p = E.inOutCubic(prog(u, 0.6, 1.4));
    const x = lerp(150, W - 150, p);
    const y = 690;
    const sw = SW[ORDERS[0][clamp(Math.floor(x / SWW), 0, 5)]];
    ctx.save();
    ctx.globalAlpha = la;
    circle(ctx, x, y, 52, sw.hex, '#FFFFFF', 6);
    circle(ctx, x, y, 56, null, rgba(C.ink, 0.5), 1.5);
    ctx.font = `16px "${F.M(700)}"`;
    const tw = ctx.measureText(sw.hex).width;
    rrect(ctx, x - tw / 2 - 10, y + 70, tw + 20, 28, 6);
    ctx.fillStyle = C.ink;
    ctx.fill();
    txt(ctx, sw.hex, x - tw / 2, y + 90, { fam: F.M(700), size: 16, color: '#FFFFFF' });
    ctx.restore();
  }
}

const cues = [
  { t: START, type: 'whoosh', dur: 0.3 },
  ...SW.map((_, si) => ({ t: START + L0 + 0.25 + si * 0.06 + 5 * 0.045, type: 'tick', f: 2000 + si * 180, v: 0.6 })),
  { t: START + L0 + 0.6, type: 'swish' },
  ...SWAPS.map((s) => ({ t: START + L0 + s, type: 'swish' })),
  { t: START + L0 + 3.4, type: 'whoosh', dur: 0.35 },
];

export default {
  id: 'color',
  start: START,
  end: END,
  theme: (lt) => (lt - L0 > 3.55 ? 'dark' : 'light'),
  draw,
  blur: (lt) => {
    const u = lt - L0;
    if (lt < 0.3) return 5;
    if (u > 3.36) return 8;
    for (const s of SWAPS) if (u > s && u < s + 0.34) return 4;
    return 1;
  },
  cues,
};
