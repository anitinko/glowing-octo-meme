import { C, W, H } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, metrics, layout, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, TAU } from '../lib/math.js';
import { bg, line, circle } from '../lib/draw.js';
import { rgba } from '../lib/color.js';
import { emblem, emblemArt } from '../lib/emblem.js';
import { BODY, CREST, tracePath } from '../lib/helmet.js';

// 09 / The mark — golden-ratio construction, the helmet traced inside the shield,
// fills land on the beat, then the emblem slides into a horizontal lockup.

const START = 44.0;
const END = 48.0;
const PHI = 1.618;
const C0 = [W / 2, H / 2];
const R0 = 300;
export const LOCK = { cx: 500, cy: 520, R: 210, wx: 790, base: 575 };
const WORD_FAM = F.U(900);
const WORD_FS = 148;

export function lockupState(lt) {
  const p = E.snap(prog(lt, 2.25, 2.8));
  return { cx: lerp(C0[0], LOCK.cx, p), cy: lerp(C0[1], LOCK.cy, p), R: lerp(R0, LOCK.R, p), p };
}

export function drawWordmark(ctx, lt, color, tagColor, startAt = 2.45) {
  const tp = E.outExpo(prog(lt, startAt, startAt + 0.7));
  if (tp <= 0) return;
  const tr = lerp(0.5, 0.04, tp) * WORD_FS;
  const m = metrics(ctx, WORD_FAM, WORD_FS);
  chars(ctx, 'HOPLITE', LOCK.wx, LOCK.base, {
    fam: WORD_FAM,
    size: WORD_FS,
    color,
    tracking: tr,
    each: (i) => {
      const p = E.outExpo(clamp((lt - startAt - i * 0.04) / 0.45));
      return { alpha: p, dy: (1 - p) * 40 };
    },
  });
  revealWords(ctx, 'дизайн · код · моушен', LOCK.wx + 6, LOCK.base + 74, { fam: F.M(500), size: 30, color: tagColor, tracking: 3 }, lt, startAt + 0.45, {
    stagger: 0.07,
    dur: 0.45,
    ease: E.outExpo,
  });
  return m;
}

function construction(ctx, lt, a) {
  if (a <= 0) return;
  const [cx, cy] = C0;
  ctx.save();
  ctx.globalAlpha = a;
  const lp = E.outExpo(prog(lt, 0.0, 0.5));
  const blue = rgba(C.blue, 0.85);
  line(ctx, cx - (W / 2) * lp, cy, cx + (W / 2) * lp, cy, blue, 1.5);
  line(ctx, cx, cy - (H / 2) * lp, cx, cy + (H / 2) * lp, blue, 1.5);
  const d = 700 * lp;
  line(ctx, cx - d, cy - d, cx + d, cy + d, rgba(C.blue, 0.4), 1);
  line(ctx, cx - d, cy + d, cx + d, cy - d, rgba(C.blue, 0.4), 1);
  // main circle drawn clockwise
  const cp = E.inOutCubic(prog(lt, 0.1, 0.7));
  if (cp > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R0, -Math.PI / 2, -Math.PI / 2 + TAU * cp);
    ctx.strokeStyle = blue;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // golden circles
  const r1 = R0 / PHI;
  const r2 = r1 / PHI;
  const g1 = E.outExpo(prog(lt, 0.35, 0.8));
  const g2 = E.outExpo(prog(lt, 0.5, 0.95));
  ctx.setLineDash([8, 8]);
  circle(ctx, cx + (R0 - r1), cy, r1 * g1, null, rgba(C.bronze, 0.9), 1.5);
  circle(ctx, cx, cy - (R0 - r2), r2 * g2, null, rgba(C.bronze, 0.9), 1.5);
  circle(ctx, cx - (R0 - r2), cy + r2 * 0.4, r2 * g2, null, rgba(C.bronze, 0.6), 1.5);
  ctx.setLineDash([]);
  const la = E.outExpo(prog(lt, 0.6, 0.9));
  txt(ctx, `R ${R0}`, cx + R0 + 18, cy - 14, { fam: F.M(700), size: 16, color: C.blue, alpha: la });
  txt(ctx, `R ${(R0 / PHI).toFixed(1)}`, cx + (R0 - r1) + 12, cy + r1 + 30, { fam: F.M(700), size: 16, color: C.bronze, alpha: la });
  txt(ctx, `φ = ${PHI}`, cx - R0 - 140, cy - R0 + 40, { fam: F.M(700), size: 16, color: C.bronze, alpha: la });
  txt(ctx, 'КОНСТРУКЦИЯ ЗНАКА', 96, 170, { fam: F.M(800), size: 18, color: rgba(C.paper, 0.6), tracking: 4, alpha: la });
  ctx.restore();
}

function draw(ctx, lt) {
  bg(ctx, C.ink);
  const st = lockupState(lt);
  const conA = 1 - prog(lt, 1.95, 2.3);
  construction(ctx, lt, conA);

  emblem(ctx, st.cx, st.cy, st.R, {
    shield: C.red,
    body: C.ink,
    crest: C.ink,
    pShield: E.outExpo(prog(lt, 1.5, 1.85)),
    pRim: E.inOutCubic(prog(lt, 1.6, 2.1)),
    pBody: E.outExpo(prog(lt, 1.75, 2.1)),
    pCrest: E.outExpo(prog(lt, 2.0, 2.35)),
    pStripes: prog(lt, 2.05, 2.4),
  });

  // helmet outline, kept above the shield fill until the body lands
  const pb = clamp((lt - 0.55) / 0.5) * BODY.length;
  const pc = clamp((lt - 0.95) / 0.3) * CREST.length;
  const outlineA = 1 - prog(lt, 1.7, 2.0);
  if (pb > 0 && outlineA > 0) {
    ctx.save();
    const s = emblemArt(ctx, st.cx, st.cy, st.R);
    ctx.lineWidth = 2.5 / s;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(C.paper, outlineA);
    tracePath(ctx, BODY, pb);
    ctx.stroke();
    if (pc > 0) {
      tracePath(ctx, CREST, pc);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawWordmark(ctx, lt, C.paper, rgba(C.paper, 0.6));

  // shine sweep across the shield
  const sh = prog(lt, 3.35, 3.85);
  if (sh > 0 && sh < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(st.cx, st.cy, st.R, 0, TAU);
    ctx.clip();
    const x = lerp(st.cx - st.R * 1.6, st.cx + st.R * 1.6, E.inOutCubic(sh));
    const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.translate(st.cx, st.cy);
    ctx.rotate(0.35);
    ctx.translate(-st.cx, -st.cy);
    ctx.fillRect(st.cx - st.R * 2, st.cy - st.R * 2, st.R * 4, st.R * 4);
    ctx.restore();
  }
}

const cues = [
  { t: START + 0.0, type: 'swish' },
  { t: START + 0.1, type: 'tick', f: 1800, v: 0.5 },
  { t: START + 0.35, type: 'tick', f: 2200, v: 0.5 },
  { t: START + 0.5, type: 'tick', f: 2600, v: 0.5 },
  ...BODY.map((_, i) => ({ t: START + 0.55 + (i * 0.5) / BODY.length, type: 'click', v: 0.45 })),
  ...CREST.map((_, i) => ({ t: START + 0.95 + (i * 0.3) / CREST.length, type: 'click', v: 0.35 })),
  { t: START + 1.5, type: 'pop', f: 440 },
  { t: START + 1.75, type: 'pop', f: 554 },
  { t: START + 2.0, type: 'pop', f: 659 },
  { t: START + 2.25, type: 'whoosh', dur: 0.5 },
  { t: START + 3.35, type: 'shine' },
];

export default {
  id: 'mark',
  start: START,
  end: END,
  theme: 'dark',
  draw,
  blur: (lt) => (lt > 2.2 && lt < 2.85 ? 5 : 1),
  cues,
};
