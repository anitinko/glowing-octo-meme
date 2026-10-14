import { C, W, H, MX } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, layout, fitSize, metrics, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp } from '../lib/math.js';
import { bg, irisIn } from '../lib/draw.js';
import { rgba } from '../lib/color.js';

// 03 / Type — a giant "Аа" swaps typeface on every beat while its real metrics are measured live.

const START = 15.75;
const END = 20.0;
const L0 = 0.25;
const EYE = [1052 + 612 * 0.8, 112 + 588 * 0.8]; // helmet eye in the previous scene

const FACES = [
  { fam: F.U(900), name: 'UNBOUNDED · BLACK 900' },
  { fam: F.P('900i'), name: 'PLAYFAIR DISPLAY · BLACK ITALIC' },
  { fam: F.M(800), name: 'JETBRAINS MONO · EXTRABOLD' },
  { fam: F.U(200), name: 'UNBOUNDED · EXTRALIGHT 200' },
  { fam: F.P(400), name: 'PLAYFAIR DISPLAY · REGULAR' },
  { fam: F.S(800), name: 'MANROPE · EXTRABOLD' },
  { fam: F.U(500), name: 'UNBOUNDED · MEDIUM 500' },
  { fam: F.P('700i'), name: 'PLAYFAIR DISPLAY · BOLD ITALIC' },
];
const GLYPH = 'Аа';
const GS = 480;
const GX = 506;
const GB = 730;
const RX = 1068; // right column
const HFAM = F.U(800);
const PANG = ['Съешь же ещё этих мягких', 'французских булок, да выпей чаю.'];
const PANG_T0 = 0.85;
const PANG_STEP = 0.022;
const WEIGHTS = [200, 400, 600, 800, 900];

let geo = null;
function geom(ctx) {
  if (geo) return geo;
  const trEm = -0.03;
  const size = Math.floor(fitSize(ctx, HFAM, 'ШРИФТОМ', W - MX - RX, trEm));
  const m = metrics(ctx, HFAM, size);
  geo = { size, tr: trEm * size, cap: m.cap, b1: 258, b2: 258 + Math.round(size * 1.04) };
  return geo;
}

function scene(ctx, u) {
  const g = geom(ctx);
  bg(ctx, C.paper);

  // --- specimen ---
  const k = clamp(Math.floor(Math.max(0, u) / 0.5), 0, FACES.length - 1);
  const face = FACES[k];
  const prev = FACES[Math.max(0, k - 1)];
  const sw = u < 0 ? 1 : E.outExpo(clamp((u - k * 0.5) / 0.22));
  const m1 = metrics(ctx, face.fam, GS);
  const m0 = metrics(ctx, prev.fam, GS);
  const cap = lerp(m0.cap, m1.cap, sw);
  const xh = lerp(m0.x, m1.x, sw);
  const desc = lerp(m0.desc, m1.desc, sw);
  const lp = E.outExpo(prog(u, -0.2, 0.45));
  const rows = [
    [GB - cap, 'CAP', cap / GS],
    [GB - xh, 'X-HEIGHT', xh / GS],
    [GB, 'BASELINE', 0],
    [GB + desc, 'DESCENDER', desc / GS],
  ];
  for (const [y, label, v] of rows) {
    ctx.fillStyle = C.red;
    ctx.fillRect(MX, Math.round(y), (930 - MX) * lp, 1.5);
    txt(ctx, `${label} ${v.toFixed(2)}`, 944, y + 5, { fam: F.M(500), size: 14, color: C.red, alpha: lp, tracking: 0.5 });
  }

  const L = layout(ctx, face.fam, GS, GLYPH, 0);
  const gx0 = GX - L.width / 2;
  const enter = u < 0 || k === 0 ? 1 : E.outExpo(clamp((u - k * 0.5) / 0.16));
  // glyph boxes
  ctx.fillStyle = rgba(C.blue, 0.55 * lp);
  for (const x of [gx0, gx0 + L.xs[1], gx0 + L.width]) ctx.fillRect(Math.round(x), GB - cap - 46, 1.5, cap + desc + 70);
  ctx.save();
  ctx.translate(GX, GB + (1 - enter) * 30);
  const s = 1 + (1 - enter) * 0.05;
  ctx.scale(s, s);
  txt(ctx, GLYPH, -L.width / 2, 0, { fam: face.fam, size: GS, color: C.ink });
  ctx.restore();
  txt(ctx, `${String(k + 1).padStart(2, '0')}/08`, MX, GB + 176, { fam: F.M(800), size: 18, color: C.ink, tracking: 2 });
  txt(ctx, face.name, MX + 84, GB + 176, { fam: F.M(500), size: 18, color: C.ink, tracking: 2 });

  // --- right column ---
  const row = (str, baseline, d0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(RX - 20, baseline - g.cap - 30, W, g.cap + 30 + g.size * 0.1);
    ctx.clip();
    chars(ctx, str, RX - g.size * 0.03, baseline, {
      fam: HFAM,
      size: g.size,
      color: C.ink,
      tracking: g.tr,
      each: (i) => {
        const p = E.outExpo(clamp((u - d0 - i * 0.03) / 0.6));
        return { dy: (1 - p) * g.size * 1.3 };
      },
    });
    ctx.restore();
  };
  row('ГОВОРЮ', g.b1, 0.0);
  row('ШРИФТОМ', g.b2, 0.08);

  txt(ctx, 'ПАНГРАММА · 46 PT', RX, 476, { fam: F.M(500), size: 15, color: C.red, tracking: 2, alpha: E.outExpo(prog(u, 0.7, 1.0)) });
  let tt = PANG_T0;
  let caret = null;
  PANG.forEach((ln, li) => {
    const y = 540 + li * 60;
    const n = clamp(Math.floor((u - tt) / PANG_STEP), 0, ln.length);
    if (n > 0) {
      const part = ln.slice(0, n);
      txt(ctx, part, RX, y, { fam: F.P('400i'), size: 46, color: C.ink });
      caret = [RX + layout(ctx, F.P('400i'), 46, part, 0).width + 4, y];
    }
    tt += ln.length * PANG_STEP + 0.06;
  });
  if (caret && (u < tt + 0.1 || Math.floor(u / 0.25) % 2 === 0)) {
    ctx.fillStyle = C.red;
    ctx.fillRect(caret[0], caret[1] - 40, 3, 50);
  }

  txt(ctx, 'НАСЫЩЕННОСТЬ', RX, 706, { fam: F.M(500), size: 15, color: C.red, tracking: 2, alpha: E.outExpo(prog(u, 1.75, 2.05)) });
  WEIGHTS.forEach((w, i) => {
    const p = E.outExpo(clamp((u - 1.9 - i * 0.07) / 0.5));
    if (p <= 0) return;
    const x = RX + i * 150;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 10, 720, 150, 110);
    ctx.clip();
    txt(ctx, 'Аа', x, 812 + (1 - p) * 110, { fam: F.U(w), size: 74, color: C.ink });
    ctx.restore();
    txt(ctx, String(w), x, 852, { fam: F.M(500), size: 15, color: C.gray, alpha: p });
  });
}

function draw(ctx, lt) {
  const u = lt - L0;
  if (lt < L0) irisIn(ctx, EYE[0], EYE[1], E.inOutQuart(clamp(lt / L0)) * 2300, () => scene(ctx, u));
  else scene(ctx, u);
}

const pangCues = [];
{
  let tt = PANG_T0;
  PANG.forEach((ln) => {
    for (let i = 0; i < ln.length; i += 2) pangCues.push({ t: START + L0 + tt + i * PANG_STEP, type: 'key', v: 0.5 });
    tt += ln.length * PANG_STEP + 0.06;
  });
}

const cues = [
  { t: START, type: 'whoosh', dur: L0 + 0.05 },
  ...FACES.slice(1).map((_, i) => ({ t: START + L0 + (i + 1) * 0.5, type: 'blip', f: 900 + i * 110, v: 0.55 })),
  ...pangCues,
  ...WEIGHTS.map((_, i) => ({ t: START + L0 + 1.9 + i * 0.07, type: 'pop', f: 500 + i * 120 })),
];

export default {
  id: 'type',
  start: START,
  end: END,
  theme: 'light',
  draw,
  blur: (lt) => (lt < L0 + 0.04 ? 5 : 1),
  cues,
};
