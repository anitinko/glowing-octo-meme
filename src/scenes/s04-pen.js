import { C, W, H, MX } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, fitSize, metrics, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp } from '../lib/math.js';
import { bg, dotGrid, anchor, handle, penCursor, rrect, wipeIn } from '../lib/draw.js';
import { rgba } from '../lib/color.js';
import { BODY, CREST, STRIPES, segPart, helmetPaths } from '../lib/helmet.js';

// 02 / Vector — the pen tool draws the Corinthian helmet anchor by anchor, on a 16th-note grid.

const START = 11.75;
const END = 16.0;
const L0 = 0.25; // wipe-in lead
const AX = 1052;
const AY = 112;
const AS = 0.8;
const S = (x, y) => [AX + x * AS, AY + y * AS];

const SEG_B = 0.125; // a 16th at 120 BPM
const SEG_C = 0.0625;
const B0 = 0.25;
const B1 = B0 + BODY.length * SEG_B; // body closes
const C0 = B1 + 0.125;
const C1 = C0 + CREST.length * SEG_C;
const HFAM = F.U(800);

let geo = null;
function geom(ctx) {
  if (geo) return geo;
  const trEm = -0.03;
  const size = Math.floor(fitSize(ctx, HFAM, 'ВЕКТОРОМ', 820, trEm));
  const m = metrics(ctx, HFAM, size);
  const b1 = 470;
  geo = { size, tr: trEm * size, cap: m.cap, b1, b2: b1 + Math.round(size * 1.04) };
  return geo;
}

/** progress in segments for a pen path */
function penProgress(u, t0, step, n) {
  if (u < t0) return -1;
  const raw = (u - t0) / step;
  if (raw >= n) return n;
  const k = Math.floor(raw);
  return k + E.inOutQuad(raw - k);
}

function tracePath(ctx, A, P) {
  const n = A.length;
  const full = Math.floor(P);
  const frac = P - full;
  ctx.beginPath();
  ctx.moveTo(A[0][0], A[0][1]);
  for (let k = 0; k < Math.min(full, n); k++) {
    const a = A[k];
    const b = A[(k + 1) % n];
    ctx.bezierCurveTo(a[4], a[5], b[2], b[3], b[0], b[1]);
  }
  let tip = [A[full % n][0], A[full % n][1]];
  if (full < n && frac > 0) {
    const [, q0, r0, s] = segPart(A, full, frac);
    ctx.bezierCurveTo(q0[0], q0[1], r0[0], r0[1], s[0], s[1]);
    tip = s;
  }
  return tip;
}

function drawAnchors(ctx, A, P, u, t0, step, fade) {
  if (P < 0 || fade <= 0) return;
  const n = A.length;
  const placed = Math.min(n, Math.floor(P) + 1);
  ctx.save();
  ctx.globalAlpha *= fade;
  const last = Math.min(n - 1, Math.floor(P));
  for (let i = 0; i < placed; i++) {
    const a = A[i];
    const tPlaced = t0 + i * step;
    const age = u - tPlaced;
    const isLast = i === last && P < n;
    // handles of the newest anchor
    if (isLast || (age < 0.25 && P < n)) {
      const hp = E.outCubic(clamp(age / 0.09));
      const ha = isLast ? 1 : 1 - clamp((age - 0.12) / 0.12);
      const [ax, ay] = S(a[0], a[1]);
      ctx.save();
      ctx.globalAlpha *= ha;
      for (const [hx, hy] of [
        [a[2], a[3]],
        [a[4], a[5]],
      ]) {
        if (Math.hypot(hx - a[0], hy - a[1]) < 1) continue;
        const [sx, sy] = S(lerp(a[0], hx, hp), lerp(a[1], hy, hp));
        handle(ctx, ax, ay, sx, sy, { r: 5.5 });
      }
      ctx.restore();
    }
    const [x, y] = S(a[0], a[1]);
    const pop = E.outBack(clamp(age / 0.12), 3);
    anchor(ctx, x, y, 11 * (0.5 + 0.5 * pop), { selected: isLast });
  }
  ctx.restore();
}

function draw(ctx, lt) {
  wipeIn(ctx, E.inOutQuart(clamp(lt / L0)), () => scene(ctx, lt - L0));
}

function scene(ctx, u) {
  const g = geom(ctx);
  bg(ctx, C.ink);
  dotGrid(ctx, 32, 1.2, rgba(C.paper, 0.06));

  // artboard
  const abA = E.outExpo(prog(u, 0, 0.5));
  ctx.fillStyle = rgba('#141419', abA);
  ctx.fillRect(AX, AY, 1000 * AS, 1000 * AS);
  ctx.strokeStyle = rgba(C.paper, 0.14 * abA);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(AX, AY, 1000 * AS, 1000 * AS);
  txt(ctx, 'шлем.svg — 1000 × 1000', AX, AY - 16, { fam: F.M(500), size: 16, color: rgba(C.paper, 0.45 * abA), tracking: 1 });

  const P = helmetPaths();
  const pb = penProgress(u, B0, SEG_B, BODY.length);
  const pc = penProgress(u, C0, SEG_C, CREST.length);
  const fb = E.outExpo(prog(u, B1, B1 + 0.4));
  const fc = E.outExpo(prog(u, C1, C1 + 0.4));
  const st = prog(u, C1 + 0.05, C1 + 0.5);
  const ui = 1 - prog(u, 3.0, 3.35); // pen UI fades out

  ctx.save();
  ctx.translate(AX, AY);
  ctx.scale(AS, AS);
  // crest fill + stripes
  if (fc > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(652, 312, 900 * fc, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = C.paper;
    ctx.fill(P.crest);
    ctx.restore();
  }
  if (st > 0) {
    ctx.save();
    ctx.clip(P.crest);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2, k] of STRIPES) {
      const p = clamp((st - k * 0.7) / 0.3);
      if (p <= 0) break;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(lerp(x1, x2, E.outCubic(p)), lerp(y1, y2, E.outCubic(p)));
      ctx.stroke();
    }
    ctx.restore();
  }
  // body fill
  if (fb > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(612, 588, 900 * fb, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = C.red;
    ctx.fill(P.body);
    ctx.restore();
  }
  // live strokes
  ctx.lineWidth = 2.2 / AS;
  ctx.lineJoin = 'round';
  let tip = null;
  if (pb >= 0) {
    const t = tracePath(ctx, BODY, pb);
    ctx.strokeStyle = rgba(fb > 0 ? C.blue : C.paper, 1 - 0.6 * fb * (1 - ui));
    ctx.stroke();
    if (pb < BODY.length) tip = t;
  }
  if (pc >= 0) {
    const t = tracePath(ctx, CREST, pc);
    ctx.strokeStyle = rgba(fc > 0 ? C.blue : C.paper, ui);
    ctx.stroke();
    if (pc < CREST.length) tip = t;
  }
  ctx.restore();

  drawAnchors(ctx, BODY, pb, u, B0, SEG_B, ui * (1 - 0.65 * prog(u, C0, C0 + 0.2)));
  drawAnchors(ctx, CREST, pc, u, C0, SEG_C, ui);

  // pen cursor
  let cur = null;
  if (u > 0 && u < B0) {
    const p = E.outCubic(prog(u, 0, B0));
    const [x, y] = S(BODY[0][0], BODY[0][1]);
    cur = [lerp(1500, x, p), lerp(1080, y, p)];
  } else if (tip) cur = S(tip[0], tip[1]);
  else if (u >= B1 && u < C0) {
    const p = E.inOutCubic(prog(u, B1, C0));
    const a = S(BODY[0][0], BODY[0][1]);
    const b = S(CREST[0][0], CREST[0][1]);
    cur = [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
  } else if (u >= C1) {
    const p = E.inOutCubic(prog(u, C1 + 0.2, C1 + 0.8));
    const a = S(CREST[0][0], CREST[0][1]);
    cur = [lerp(a[0], 1700, p), lerp(a[1], 1000, p)];
  }
  if (cur && ui > 0) {
    ctx.save();
    ctx.globalAlpha = ui;
    penCursor(ctx, cur[0], cur[1], 1.25, '#FFFFFF', C.ink);
    const lx = Math.round((cur[0] - AX) / AS);
    const ly = Math.round((cur[1] - AY) / AS);
    const label = `${lx}, ${ly}`;
    ctx.font = `15px "${F.M(500)}"`;
    const tw = ctx.measureText(label).width;
    rrect(ctx, cur[0] + 26, cur[1] + 22, tw + 16, 26, 5);
    ctx.fillStyle = C.blue;
    ctx.fill();
    txt(ctx, label, cur[0] + 34, cur[1] + 40, { fam: F.M(500), size: 15, color: '#FFFFFF' });
    ctx.restore();
  }

  // headline
  const row = (str, baseline, d0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, baseline - g.cap - 30, 1000, g.cap + 30 + g.size * 0.1);
    ctx.clip();
    chars(ctx, str, MX - g.size * 0.03, baseline, {
      fam: HFAM,
      size: g.size,
      color: C.paper,
      tracking: g.tr,
      each: (i) => {
        const p = E.outExpo(clamp((u - d0 - i * 0.03) / 0.6));
        return { dy: (1 - p) * g.size * 1.3 };
      },
    });
    ctx.restore();
  };
  row('РИСУЮ', g.b1, 0.0);
  row('ВЕКТОРОМ', g.b2, 0.08);
  revealWords(ctx, 'кривые Безье. ни одного лишнего узла.', MX, g.b2 + 84, { fam: F.M(500), size: 24, color: rgba(C.paper, 0.6) }, u, 0.45, { stagger: 0.04, dur: 0.5, ease: E.outExpo });

  // swatches after fill
  [
    [C.red, '#FF3D21', B1 + 0.1],
    [C.paper, '#F2EEE6', C1 + 0.1],
    [C.ink, '#0D0D0F', C1 + 0.3],
  ].forEach(([col, hex, t0], i) => {
    const p = E.outBack(prog(u, t0, t0 + 0.3), 2);
    if (p <= 0) return;
    const x = MX + i * 190;
    const y = g.b2 + 150;
    rrect(ctx, x, y, 36 * p, 36 * p, 8);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = rgba(C.paper, 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    txt(ctx, hex, x + 50, y + 25, { fam: F.M(500), size: 18, color: rgba(C.paper, 0.75 * clamp(p)) });
  });

  const nodes = BODY.length + CREST.length;
  revealWords(ctx, `${nodes} узлов · 0 лишних`, AX, AY + 1000 * AS + 46, { fam: F.M(500), size: 18, color: rgba(C.paper, 0.55) }, u, 3.0, { stagger: 0.05, dur: 0.4, ease: E.outExpo });
}

const cues = [
  { t: START, type: 'whoosh', dur: L0 + 0.1 },
  ...BODY.map((_, i) => ({ t: START + L0 + B0 + i * SEG_B, type: 'click', v: 0.8 })),
  { t: START + L0 + B1, type: 'pop', f: 520 },
  ...CREST.map((_, i) => ({ t: START + L0 + C0 + i * SEG_C, type: 'click', v: 0.6 })),
  { t: START + L0 + C1, type: 'pop', f: 660 },
];

export default {
  id: 'pen',
  start: START,
  end: END,
  theme: 'dark',
  draw,
  blur: (lt) => (lt < L0 + 0.05 ? 5 : 1),
  cues,
};
