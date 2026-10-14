import { C, W, H } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, metrics, revealWords, layout } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, beatPulse } from '../lib/math.js';
import { bg, rrect, circle } from '../lib/draw.js';
import { TILE_CENTERS } from './s08-system.js';

// 07 / Breath — the collapsed components line up as pixels, close ranks as shields,
// then a 4-3-2-1 countdown on 8th notes into the second drop.

const START = 32.0;
const END = 36.0;
const N = TILE_CENTERS.length;
// left-to-right order: by column, then row
const SLOT = TILE_CENTERS.map((p, i) => ({ i, c: i % 5, r: Math.floor(i / 5) }))
  .sort((a, b) => a.c - b.c || a.r - b.r)
  .reduce((acc, d, k) => ((acc[d.i] = k), acc), []);
const ROW_Y = 790;
const COUNT = [
  ['4', C.red, C.ink],
  ['3', C.ink, C.red],
  ['2', C.paper, C.ink],
  ['1', C.red, C.paper],
];

function shield(ctx, x, y, r) {
  circle(ctx, x, y, r, C.red, C.ink, 4);
  circle(ctx, x, y, r * 0.78, null, C.paper, Math.max(1.5, r * 0.07));
  circle(ctx, x, y, r * 0.2, C.paper);
}

function countdown(ctx, lt) {
  const u = lt - 3.0;
  if (u >= 0.875) return bg(ctx, '#000000');
  const k = Math.min(3, Math.floor(u / 0.25));
  const l = u - k * 0.25;
  const [num, back, fore] = COUNT[k];
  bg(ctx, back);
  const fam = F.U(900);
  const size = 760;
  const m = metrics(ctx, fam, size);
  const s = 1 + 0.2 * (1 - E.outExpo(clamp(l / 0.14)));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  ctx.rotate((k % 2 ? 1 : -1) * 0.04 * (1 - E.outExpo(clamp(l / 0.14))));
  const w = layout(ctx, fam, size, num, 0).width;
  txt(ctx, num, -w / 2, m.cap / 2, { fam, size, color: fore });
  ctx.restore();
  txt(ctx, `0${4 - k}`, W / 2, H - 150, { fam: F.M(800), size: 20, color: fore, align: 'center', tracking: 4 });
}

function draw(ctx, lt) {
  if (lt >= 3.0) return countdown(ctx, lt);
  bg(ctx, C.ink);
  const pulse = 1 + 0.22 * beatPulse(lt, 0.5, 9);
  const order = [...Array(N).keys()].sort((a, b) => SLOT[a] - SLOT[b]);
  for (const i of order) {
    const k = SLOT[i];
    const [sx, sy] = TILE_CENTERS[i];
    const p1 = E.snap(clamp((lt - 0.04 - k * 0.018) / 0.5));
    const p2 = E.snap(clamp((lt - 1.95 - Math.abs(k - 7) * 0.025) / 0.45));
    const x1 = 960 + (k - 7) * 64;
    const x = p2 > 0 ? lerp(x1, 960 + (k - 7) * 84, p2) : lerp(sx, x1, p1);
    const y = lerp(sy, ROW_Y, p1);
    // pull toward the centre right before the countdown
    const pull = E.inExpo(prog(lt, 2.55, 3.0));
    const px = lerp(x, W / 2, pull);
    const py = lerp(y, H / 2, pull);
    if (p2 > 0) {
      shield(ctx, px, py, lerp(14, 50, p2) * (1 - 0.7 * pull) * (p2 < 1 ? 1 : pulse * 0.25 + 0.75));
    } else {
      const sz = lerp(18, 30, p1) * (p1 >= 1 ? pulse : 1);
      rrect(ctx, px - sz / 2, py - sz / 2, sz, sz, lerp(9, 2, p1));
      ctx.fillStyle = C.red;
      ctx.fill();
    }
  }
  const opt = { fam: F.P('400i'), size: 132, color: C.paper, align: 'center' };
  revealWords(ctx, 'пиксель к пикселю.', W / 2, 560, opt, lt, 0.2, { stagger: 0.12, dur: 0.6, ease: E.outExpo, exitAt: 1.5, exitDur: 0.3, exitEase: E.inExpo });
  revealWords(ctx, 'щит к щиту.', W / 2, 560, opt, lt, 2.0, { stagger: 0.12, dur: 0.55, ease: E.outExpo, exitAt: 2.6, exitDur: 0.3, exitEase: E.inExpo });
  txt(ctx, 'ВДОХ', W / 2, 250, { fam: F.M(800), size: 18, color: C.gray, align: 'center', tracking: 8, alpha: Math.min(prog(lt, 0.2, 0.6), 1 - prog(lt, 2.5, 2.8)) });
}

const cues = [
  ...[...Array(N).keys()].map((k) => ({ t: START + 0.04 + k * 0.018 + 0.5, type: 'tick', f: 2600 - k * 40, v: 0.35 })),
  { t: START + 0.2, type: 'swish' },
  { t: START + 1.95, type: 'snap' },
  { t: START + 2.0, type: 'swish' },
  { t: START + 2.55, type: 'suck', dur: 0.45 },
  { t: 35.0, type: 'count', f: 196 },
  { t: 35.25, type: 'count', f: 220 },
  { t: 35.5, type: 'count', f: 262 },
  { t: 35.75, type: 'count', f: 294 },
];

export default {
  id: 'breath',
  start: START,
  end: END,
  theme: (lt) => {
    if (lt < 3.0) return 'dark';
    const k = Math.min(3, Math.floor((lt - 3.0) / 0.25));
    return lt >= 3.875 ? 'dark' : COUNT[k][1] === C.ink ? 'dark' : 'light';
  },
  draw,
  blur: (lt) => (lt < 0.6 || (lt > 1.9 && lt < 2.5) || lt > 2.5 ? 4 : 1),
  cues,
};
