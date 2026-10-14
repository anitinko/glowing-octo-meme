import { C, W, H, MX } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, fitSize, metrics, revealWords } from '../lib/text.js';
import { E, bezier } from '../lib/ease.js';
import { clamp, prog, lerp } from '../lib/math.js';
import { bg, dotGrid, line, circle, handle, arrowCursor } from '../lib/draw.js';
import { rgba } from '../lib/color.js';

// 05 / Motion — a graph editor reshapes linear into cubic-bezier(.85,0,.15,1) live,
// while a robotic grey ball and a red ball with squash & stretch run on the beat.

const START = 24.0;
const END = 28.0;
const PX = 1170;
const PY = 236;
const PS = 560;
const toP = (x, y) => [PX + x * PS, PY + (1 - y) * PS];
const TX0 = MX + 30;
const TX1 = MX + 830;
const YA = 650;
const YB = 840;
const BR = 26;
const H1 = { from: [1 / 3, 1 / 3], to: [0.85, 0], t: [0.4, 0.8] };
const H2 = { from: [2 / 3, 2 / 3], to: [0.15, 1], t: [0.9, 1.3] };

function handles(lt) {
  const p1 = E.snap(prog(lt, H1.t[0], H1.t[1]));
  const p2 = E.snap(prog(lt, H2.t[0], H2.t[1]));
  return [
    lerp(H1.from[0], H1.to[0], p1),
    lerp(H1.from[1], H1.to[1], p1),
    lerp(H2.from[0], H2.to[0], p2),
    lerp(H2.from[1], H2.to[1], p2),
  ];
}

function ballX(ease, t) {
  const beat = Math.floor(t / 0.5);
  const ph = (t - beat * 0.5) / 0.5;
  const e = ease(ph);
  return beat % 2 === 0 ? e : 1 - e;
}

function drawBall(ctx, ease, t, y, color, squash) {
  const x = lerp(TX0, TX1, ballX(ease, t));
  // onion skin
  for (let i = 7; i >= 1; i--) {
    const tp = t - i * 0.018;
    if (tp < 0) continue;
    const gx = lerp(TX0, TX1, ballX(ease, tp));
    circle(ctx, gx, y, BR, rgba(color, 0.12 * (1 - i / 8)));
  }
  let sx = 1;
  let sy = 1;
  if (squash) {
    const v = Math.abs(ballX(ease, t + 0.004) - ballX(ease, t - 0.004)) / 0.008; // track-lengths per second
    const st = 1 + Math.min(0.75, v * 0.075);
    const ph = (t % 0.5) / 0.5;
    const imp = Math.exp(-ph * 22) * 0.32;
    sx = st * (1 - imp);
    sy = (1 / st) * (1 + imp);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  circle(ctx, 0, 0, BR, color);
  ctx.restore();
  return x;
}

let geo = null;
function geom(ctx) {
  if (geo) return geo;
  const f1 = F.U(800);
  const s1 = Math.floor(fitSize(ctx, f1, 'ДВИГАЮ', 860, -0.03));
  geo = { f1, s1, tr1: -0.03 * s1, cap1: metrics(ctx, f1, s1).cap, b1: 300, b2: 420 };
  return geo;
}

function draw(ctx, lt) {
  const g = geom(ctx);
  bg(ctx, C.ink);
  dotGrid(ctx, 32, 1.2, rgba(C.paper, 0.05));

  // headline: grotesk + italic serif
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, g.b1 - g.cap1 - 30, 1100, g.cap1 + 30 + g.s1 * 0.12);
  ctx.clip();
  chars(ctx, 'ДВИГАЮ', MX - g.s1 * 0.03, g.b1, {
    fam: g.f1,
    size: g.s1,
    color: C.paper,
    tracking: g.tr1,
    each: (i) => {
      const p = E.outExpo(clamp((lt - i * 0.03) / 0.6));
      return { dy: (1 - p) * g.s1 * 1.3 };
    },
  });
  ctx.restore();
  revealWords(ctx, 'с характером', MX, g.b2, { fam: F.P('400i'), size: 112, color: C.red }, lt, 0.12, { stagger: 0.08, dur: 0.6, ease: E.outExpo });

  // tracks
  const ta = E.outExpo(prog(lt, 0.15, 0.6));
  for (const [y, col] of [
    [YA, rgba(C.paper, 0.18)],
    [YB, rgba(C.red, 0.35)],
  ]) {
    ctx.fillStyle = col;
    ctx.fillRect(TX0, y - 1, (TX1 - TX0) * ta, 2);
    ctx.fillRect(TX0 - BR - 6, y - 20, 2, 40 * ta);
    ctx.fillRect(TX1 + BR + 4, y - 20, 2, 40 * ta);
  }
  txt(ctx, 'linear', TX0 - BR, YA - 56, { fam: F.M(700), size: 20, color: rgba(C.paper, 0.75 * ta) });
  txt(ctx, '— как робот', TX0 - BR + 92, YA - 56, { fam: F.M(400), size: 20, color: rgba(C.paper, 0.45 * ta) });
  txt(ctx, 'cubic-bezier', TX0 - BR, YB - 56, { fam: F.M(700), size: 20, color: rgba(C.red, ta) });
  txt(ctx, '— с характером', TX0 - BR + 172, YB - 56, { fam: F.M(400), size: 20, color: rgba(C.red, 0.7 * ta) });

  const [x1, y1, x2, y2] = handles(lt);
  const ease = bezier(x1, y1, x2, y2);
  if (ta > 0.05) {
    ctx.save();
    ctx.globalAlpha = ta;
    drawBall(ctx, E.linear, lt, YA, C.gray, false);
    drawBall(ctx, ease, lt, YB, C.red, true);
    ctx.restore();
  }

  // graph editor panel
  const pa = E.outExpo(prog(lt, 0.05, 0.5));
  ctx.save();
  ctx.globalAlpha = pa;
  ctx.fillStyle = '#141419';
  ctx.fillRect(PX - 30, PY - 30, PS + 60, PS + 60);
  ctx.strokeStyle = rgba(C.paper, 0.12);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PX - 30, PY - 30, PS + 60, PS + 60);
  ctx.fillStyle = rgba(C.paper, 0.06);
  for (let i = 0; i <= 8; i++) {
    ctx.fillRect(PX + (i * PS) / 8, PY, 1, PS);
    ctx.fillRect(PX, PY + (i * PS) / 8, PS, 1);
  }
  ctx.setLineDash([6, 8]);
  line(ctx, PX, PY + PS, PX + PS, PY, rgba(C.paper, 0.22), 1.5);
  ctx.setLineDash([]);
  txt(ctx, 'SPEED GRAPH', PX - 30, PY - 48, { fam: F.M(700), size: 15, color: rgba(C.paper, 0.5), tracking: 2 });
  txt(ctx, 'время →', PX + PS + 30, PY + PS + 64, { fam: F.M(400), size: 16, color: rgba(C.paper, 0.45), align: 'right' });
  ctx.save();
  ctx.translate(PX - 50, PY + PS);
  ctx.rotate(-Math.PI / 2);
  txt(ctx, 'значение →', 0, 0, { fam: F.M(400), size: 16, color: rgba(C.paper, 0.45) });
  ctx.restore();

  // curve
  const [ax, ay] = toP(0, 0);
  const [bx, by] = toP(1, 1);
  const [c1x, c1y] = toP(x1, y1);
  const [c2x, c2y] = toP(x2, y2);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by);
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
  handle(ctx, ax, ay, c1x, c1y, { r: 9, lw: 2 });
  handle(ctx, bx, by, c2x, c2y, { r: 9, lw: 2 });
  circle(ctx, ax, ay, 7, C.paper);
  circle(ctx, bx, by, 7, C.paper);

  // playhead synced with the red ball
  const ph = (lt % 0.5) / 0.5;
  const [hx] = toP(ph, 0);
  ctx.fillStyle = rgba(C.paper, 0.35);
  ctx.fillRect(hx, PY, 1.5, PS);
  const [dx, dy] = toP(ph, ease(ph));
  circle(ctx, dx, dy, 10, C.paper);
  circle(ctx, dx, dy, 18, null, rgba(C.paper, 0.35), 2);

  const f2 = (v) => v.toFixed(2).replace(/^0/, '').replace(/^-0/, '-');
  txt(ctx, `cubic-bezier(${f2(x1)}, ${f2(y1)}, ${f2(x2)}, ${f2(y2)})`, PX - 30, PY + PS + 116, { fam: F.M(700), size: 26, color: C.paper });
  ctx.restore();

  // cursor dragging the handles
  let cur = null;
  if (lt > 0.25 && lt < H1.t[0]) {
    const p = E.outCubic(prog(lt, 0.25, H1.t[0]));
    const t1 = toP(...H1.from);
    cur = [lerp(1500, t1[0], p), lerp(1050, t1[1], p)];
  } else if (lt >= H1.t[0] && lt < H1.t[1] + 0.05) cur = [c1x, c1y];
  else if (lt >= H1.t[1] + 0.05 && lt < H2.t[0]) {
    const p = E.inOutCubic(prog(lt, H1.t[1] + 0.05, H2.t[0]));
    const t2 = toP(...H2.from);
    cur = [lerp(c1x, t2[0], p), lerp(c1y, t2[1], p)];
  } else if (lt >= H2.t[0] && lt < H2.t[1] + 0.1) cur = [c2x, c2y];
  else if (lt >= H2.t[1] + 0.1 && lt < 2.2) {
    const p = E.inOutCubic(prog(lt, H2.t[1] + 0.1, 2.0));
    cur = [lerp(c2x, 1820, p), lerp(c2y, 1130, p)];
  }
  if (cur) arrowCursor(ctx, cur[0] + 4, cur[1] + 4, 1.2, '#FFFFFF', C.ink);
}

const cues = [
  { t: START + H1.t[0], type: 'click', v: 0.7 },
  { t: START + H1.t[1], type: 'snap' },
  { t: START + H2.t[0], type: 'click', v: 0.7 },
  { t: START + H2.t[1], type: 'snap' },
  ...Array.from({ length: 8 }, (_, i) => ({ t: START + i * 0.5, type: 'tick', f: 1600, v: 0.45 })),
];

export default {
  id: 'motion',
  start: START,
  end: END,
  theme: 'dark',
  draw,
  blur: () => 3,
  cues,
};
