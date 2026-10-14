import { C, W, H, MX } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, layout, fitSize, metrics, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, TAU } from '../lib/math.js';
import { bg, circle, line } from '../lib/draw.js';
import { rgba } from '../lib/color.js';
import { BODY, CREST, STRIPES, pathFrom, pathLength } from '../lib/helmet.js';

// Drop #1: the dot bursts into "HOP/LITE", then a dictionary entry whose third meaning is "Дизайнер."

const START = 4.0;
const END = 8.0;
const DISPLAY = F.U(900);

let G = null;
function geom(ctx) {
  if (G) return G;
  const trEm = -0.04;
  const size = Math.floor(fitSize(ctx, DISPLAY, 'LITE', W - 2 * MX, trEm));
  const m = metrics(ctx, DISPLAY, size);
  const gap = Math.round(size * 0.84);
  const b1 = Math.round(H / 2 - (gap - m.cap) / 2);
  const tr = trEm * size;
  G = { size, tr, cap: m.cap, b1, b2: b1 + gap, hopW: layout(ctx, DISPLAY, size, 'HOP', tr).width };
  return G;
}

function phaseA(ctx, lt) {
  const g = geom(ctx);
  bg(ctx, C.red);
  const z = 1 + 0.035 * E.outCubic(clamp(lt / 1.0));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  const x0 = MX - g.size * 0.02;
  const row = (str, baseline, d0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-80, baseline - g.cap - 50, W + 160, g.cap + 50 + g.size * 0.06);
    ctx.clip();
    const L = chars(ctx, str, x0, baseline, {
      fam: DISPLAY,
      size: g.size,
      color: C.ink,
      tracking: g.tr,
      each: (i) => {
        const p = E.outExpo(clamp((lt - d0 - i * 0.05) / 0.62));
        return { dy: (1 - p) * (g.cap + 80), rot: (1 - p) * 0.1 };
      },
    });
    ctx.restore();
    return L;
  };
  const L1 = row('HOP', g.b1, 0.03);
  const L2 = row('LITE', g.b2, 0.13);
  // shield boss in the O counter, on the off-beat
  const bp = E.outBack(prog(lt, 0.5, 0.62), 2.5);
  if (bp > 0) circle(ctx, L1.ox + L1.xs[1] + L1.ws[1] / 2, g.b1 - g.cap / 2, g.cap * 0.12 * bp, C.paper);
  // registered mark
  const rp = E.outExpo(prog(lt, 0.62, 0.9));
  if (rp > 0) {
    const ex = L2.ox + L2.width + 14;
    txt(ctx, '®', ex, g.b2 - g.cap + 52 - (1 - rp) * 30, { fam: F.U(500), size: 64, color: C.ink, alpha: rp });
  }
  ctx.restore();
}

// --- dictionary entry ---
const HW = 'гоплит';
const HW_FAM = F.P(900);
const HW_FS = 230;
const YH = 380;
const DEF_FAM = F.S(500);
const DEF_FS = 50;
const DEFS = [
  { n: '1', s: 'Тяжеловооружённый пехотинец Древней Греции.', t: 1.5 },
  { n: '2', s: 'ИИ-агент, который пишет код.', t: 2.0, note: '← обычно' },
];
const D3 = 'Дизайнер.';
const D3_FAM = F.P(900 + 'i');
const D3_FS = 156;
const Y3 = 826;
const D3X = MX + 74;

function markerRect(ctx) {
  const w = layout(ctx, D3_FAM, D3_FS, D3, 0).width;
  return { x: D3X - 34, y: Y3 - 128, w: w + 72, h: 168 };
}

function strokeLen(ctx, path, len, p, color, lw) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (p < 1) ctx.setLineDash([len * p, len * 2]);
  ctx.stroke(path);
  ctx.restore();
}

function phaseB(ctx, lt) {
  bg(ctx, C.paper);
  const mr = markerRect(ctx);
  const camP = E.inOutCubic(prog(lt, 3.0, 4.0));
  const s = 1 + 0.07 * camP;
  const cx = mr.x + mr.w / 2;
  const cy = mr.y + mr.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);

  // headword
  ctx.save();
  ctx.beginPath();
  ctx.rect(MX - 40, YH - 250, 1100, 330);
  ctx.clip();
  chars(ctx, HW, MX - 8, YH, {
    fam: HW_FAM,
    size: HW_FS,
    color: C.ink,
    each: (i) => {
      const p = E.outExpo(clamp((lt - 1.0 - i * 0.035) / 0.6));
      return { dy: (1 - p) * 300 };
    },
  });
  ctx.restore();
  const hwW = layout(ctx, HW_FAM, HW_FS, HW, 0).width;
  const mx = MX + hwW + 50;
  revealWords(ctx, 'сущ., м. р.', mx, YH - 72, { fam: F.P('400i'), size: 46, color: C.ink }, lt, 1.18, { stagger: 0.05, dur: 0.5, ease: E.outExpo });
  revealWords(ctx, 'от греч. hóplon — щит', mx, YH - 6, { fam: F.M(500), size: 24, color: C.gray }, lt, 1.28, { stagger: 0.04, dur: 0.5, ease: E.outExpo });

  // rule
  ctx.fillStyle = C.ink;
  ctx.fillRect(MX, YH + 58, (W - 2 * MX) * E.outExpo(prog(lt, 1.12, 1.7)), 3);

  // engraving-style figure, "рис. 1"
  if (lt > 1.5) {
    const FX = 1436;
    const FY = 446;
    const FS = 0.4;
    ctx.save();
    ctx.translate(FX, FY);
    ctx.scale(FS, FS);
    const lw = 2.6 / FS;
    const pb = E.inOutCubic(prog(lt, 1.55, 2.5));
    const pc = E.inOutCubic(prog(lt, 1.75, 2.65));
    strokeLen(ctx, pathFrom(BODY), pathLength(BODY), pb, C.ink, lw);
    strokeLen(ctx, pathFrom(CREST), pathLength(CREST), pc, C.ink, lw);
    const ps = prog(lt, 2.4, 2.9);
    if (ps > 0) {
      ctx.save();
      ctx.clip(pathFrom(CREST));
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.6 / FS;
      for (const [x1, y1, x2, y2, k] of STRIPES) {
        if (k > ps) break;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    revealWords(ctx, 'рис. 1 — шлем гоплита, ок. V в. до н. э.', FX + 30, FY + 416, { fam: F.P('400i'), size: 24, color: C.gray }, lt, 2.3, { stagger: 0.02, dur: 0.45, ease: E.outExpo });
  }

  // definitions 1-2
  DEFS.forEach((d, i) => {
    const y = YH + 168 + i * 82;
    if (lt < d.t) return;
    const p = E.outExpo(clamp((lt - d.t) / 0.5));
    txt(ctx, d.n, MX, y, { fam: F.M(700), size: 26, color: C.red, alpha: p });
    revealWords(ctx, d.s, MX + 74, y, { fam: DEF_FAM, size: DEF_FS, color: C.ink }, lt, d.t, { stagger: 0.03, dur: 0.5, ease: E.outExpo });
    if (d.note) {
      const nw = layout(ctx, DEF_FAM, DEF_FS, d.s, 0).width;
      const np = clamp((lt - d.t - 0.3) / 0.25);
      const n = Math.floor(np * d.note.length);
      if (n) txt(ctx, d.note.slice(0, n), MX + 74 + nw + 30, y, { fam: F.M(500), size: 24, color: C.red });
    }
  });

  // definition 3
  if (lt >= 2.5) {
    txt(ctx, '3', MX, Y3 - 40, { fam: F.M(700), size: 26, color: C.red, alpha: E.outExpo(clamp((lt - 2.5) / 0.4)) });
    const drawWord = (color) =>
      chars(ctx, D3, D3X, Y3, {
        fam: D3_FAM,
        size: D3_FS,
        color,
        each: (i) => {
          const p = E.outExpo(clamp((lt - 2.5 - i * 0.025) / 0.55));
          return { dy: (1 - p) * 200, alpha: clamp(p * 3) };
        },
      });
    ctx.save();
    ctx.beginPath();
    ctx.rect(MX, Y3 - 200, W, 260);
    ctx.clip();
    drawWord(C.ink);
    ctx.restore();
    const mp = E.snap(prog(lt, 2.62, 2.92));
    if (mp > 0) {
      ctx.fillStyle = C.red;
      ctx.fillRect(mr.x, mr.y, mr.w * mp, mr.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(mr.x, mr.y, mr.w * mp, mr.h);
      ctx.clip();
      drawWord(C.paper);
      ctx.restore();
    }
    const n = Math.floor(clamp((lt - 2.95) / 0.25) * 10);
    if (n) txt(ctx, '← сегодня'.slice(0, n), mr.x + mr.w + 34, Y3 - 40, { fam: F.M(500), size: 24, color: C.red });
  }
  ctx.restore();

  // marker swallows the frame
  const ep = E.inOutQuart(prog(lt, 3.46, 3.98));
  if (ep > 0) {
    const sx = cx + (mr.x - cx) * s;
    const sy = cy + (mr.y - cy) * s;
    const sw = mr.w * s;
    const sh = mr.h * s;
    const x = lerp(sx, -80, ep);
    const y = lerp(sy, -80, ep);
    const w = lerp(sw, W + 160, ep);
    const h = lerp(sh, H + 160, ep);
    ctx.fillStyle = C.red;
    ctx.fillRect(x, y, w, h);
    const fa = 1 - prog(lt, 3.7, 3.95);
    if (fa > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalAlpha = fa;
      const zs = s * (1 + ep * 0.6);
      ctx.translate(cx, cy);
      ctx.scale(zs, zs);
      ctx.translate(-cx, -cy);
      txt(ctx, D3, D3X, Y3, { fam: D3_FAM, size: D3_FS, color: C.paper });
      ctx.restore();
    }
  }
}

function draw(ctx, lt) {
  if (lt < 1.0) {
    const burst = lt < 0.5;
    if (burst) {
      const R = 20 + E.outExpo(clamp(lt / 0.42)) * 1180;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, R, 0, TAU);
      ctx.clip();
      phaseA(ctx, lt);
      ctx.restore();
      const rp = clamp(lt / 0.5);
      circle(ctx, W / 2, H / 2, R + 20 + rp * 120, null, rgba(C.paper, 0.9 * (1 - rp)), 10 * (1 - rp) + 1);
    } else phaseA(ctx, lt);
  } else phaseB(ctx, lt);
}

const cues = [
  { t: START + 0.45, type: 'tick', f: 2400 },
  { t: START + 0.59, type: 'tick', f: 2600 },
  { t: START + 0.73, type: 'tick', f: 2800 },
  { t: START + 1.0, type: 'swish' },
  { t: START + 1.5, type: 'tick', f: 1800 },
  { t: START + 2.0, type: 'tick', f: 2000 },
  { t: START + 2.3, type: 'blip', f: 1500 },
  { t: START + 2.5, type: 'swish' },
  { t: START + 2.62, type: 'marker', dur: 0.3 },
  { t: START + 3.48, type: 'whoosh', dur: 0.5 },
];

export default {
  id: 'title',
  start: START,
  end: END,
  theme: (lt) => (lt < 1 ? 'red' : lt > 3.75 ? 'red' : 'light'),
  draw,
  blur: (lt) => (lt < 0.5 ? 5 : lt > 3.45 ? 6 : 1),
  cues,
};
