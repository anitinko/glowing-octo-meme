import { C, W, H } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, chars, fitSize, metrics, layout, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, rng, TAU } from '../lib/math.js';
import { bg, rrect, circle, line } from '../lib/draw.js';
import { rgba, mix } from '../lib/color.js';

// 06 / System — fifteen UI components fly in and lock into a phalanx-like formation,
// then a wave toggles them in sequence: every element holds the line.

const START = 27.75;
const END = 32.0;
const L0 = 0.25;
const TW = 300;
const TH = 150;
const GAP = 24;
const COLS = 5;
const ROWS = 3;
const GX0 = (W - (COLS * TW + (COLS - 1) * GAP)) / 2;
const GY0 = 404;
const CARD = '#FBF9F4';
const TRACK = '#DCD6CA';

export const TILE_CENTERS = Array.from({ length: COLS * ROWS }, (_, i) => [
  GX0 + (i % COLS) * (TW + GAP) + TW / 2,
  GY0 + Math.floor(i / COLS) * (TH + GAP) + TH / 2,
]);

function polyPartial(ctx, pts, p) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * p;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.min(1, left / d);
    ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
    left -= d;
  }
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

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.4, 0, -s * 1.1, -s * 1.1, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 1.1, -s * 1.1, s * 1.4, 0, 0, s * 0.9);
  ctx.closePath();
}

const T = (ctx, s, x, y, o) => txt(ctx, s, x, y, o);
const COMPONENTS = [
  ['кнопка', (ctx, x, y, s) => {
    const press = Math.sin(clamp(s * 2.5) * Math.PI);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 - 0.07 * press, 1 - 0.07 * press);
    rrect(ctx, -100, -29, 200, 58, 16);
    ctx.fillStyle = mix(C.red, '#B8240F', press);
    ctx.fill();
    T(ctx, 'Отправить', 0, 8, { fam: F.S(700), size: 23, color: C.paper, align: 'center' });
    ctx.restore();
  }],
  ['переключатель', (ctx, x, y, s) => {
    const e = E.outBack(clamp(s * 1.6), 1.8);
    rrect(ctx, x - 54, y - 29, 108, 58, 29);
    ctx.fillStyle = mix(TRACK, C.red, clamp(s * 2));
    ctx.fill();
    circle(ctx, x - 25 + 50 * e, y, 23, '#FFFFFF');
  }],
  ['поиск', (ctx, x, y, s) => {
    rrect(ctx, x - 124, y - 29, 248, 58, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = s > 0 ? C.red : rgba(C.ink, 0.22);
    ctx.lineWidth = 2;
    ctx.stroke();
    circle(ctx, x - 94, y - 3, 9, null, C.ink, 2.5);
    line(ctx, x - 87, y + 4, x - 80, y + 11, C.ink, 2.5);
    const word = 'гоплит';
    const n = Math.floor(clamp(s * 1.6) * word.length);
    if (!n) T(ctx, 'Поиск…', x - 66, y + 8, { fam: F.S(500), size: 22, color: '#9A968E' });
    else {
      T(ctx, word.slice(0, n), x - 66, y + 8, { fam: F.S(700), size: 22, color: C.ink });
      const w = layout(ctx, F.S(700), 22, word.slice(0, n), 0).width;
      ctx.fillStyle = C.red;
      ctx.fillRect(x - 64 + w, y - 14, 2.5, 28);
    }
  }],
  ['аватары', (ctx, x, y, s) => {
    const cols = [C.red, C.bronze, C.ink, C.blue];
    const L = ['Г', 'О', 'П', '+3'];
    const sp = 46 + 8 * E.outBack(clamp(s * 1.5));
    for (let i = 0; i < 4; i++) {
      const pop = i === 3 ? E.outBack(clamp((s - 0.25) / 0.4), 2.5) : 1;
      if (pop <= 0) continue;
      const cx = x - sp * 1.5 + i * sp;
      circle(ctx, cx, y, 30 * pop, cols[i], CARD, 4);
      T(ctx, L[i], cx, y + 7 * pop, { fam: F.U(700), size: 19 * pop, color: i === 1 ? C.ink : C.paper, align: 'center' });
    }
  }],
  ['лайк', (ctx, x, y, s) => {
    const f = clamp(s * 2.2);
    const pop = 1 + 0.3 * Math.sin(clamp(s * 2.2) * Math.PI);
    ctx.save();
    ctx.translate(x, y + 4);
    ctx.scale(pop, pop);
    heartPath(ctx, 26);
    ctx.fillStyle = mix('#FFFFFF', C.red, f);
    ctx.fill();
    ctx.strokeStyle = f > 0.5 ? C.red : C.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    if (s > 0.08 && s < 0.7) {
      const b = (s - 0.08) / 0.62;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const r = 38 + b * 30;
        circle(ctx, x + Math.cos(a) * r, y + 4 + Math.sin(a) * r, 5 * (1 - b), i % 2 ? C.red : C.bronze);
      }
    }
  }],
  ['чекбокс', (ctx, x, y, s) => {
    const bx = x - 92;
    rrect(ctx, bx - 22, y - 22, 44, 44, 11);
    ctx.fillStyle = mix('#FFFFFF', C.ink, clamp(s * 3));
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (s > 0.15) {
      ctx.save();
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      polyPartial(ctx, [[bx - 11, y + 1], [bx - 3, y + 9], [bx + 12, y - 9]], clamp((s - 0.15) / 0.45));
      ctx.stroke();
      ctx.restore();
    }
    T(ctx, 'Запомнить', bx + 40, y + 8, { fam: F.S(600), size: 24, color: C.ink });
  }],
  ['слайдер', (ctx, x, y, s) => {
    const v = lerp(0.24, 0.8, E.inOutCubic(clamp(s * 1.3)));
    const x0 = x - 112;
    rrect(ctx, x0, y + 10, 224, 8, 4);
    ctx.fillStyle = TRACK;
    ctx.fill();
    rrect(ctx, x0, y + 10, 224 * v, 8, 4);
    ctx.fillStyle = C.red;
    ctx.fill();
    circle(ctx, x0 + 224 * v, y + 14, 15, '#FFFFFF', C.ink, 2.5);
    T(ctx, String(Math.round(v * 100)), x0 + 224 * v, y - 18, { fam: F.M(700), size: 18, color: C.ink, align: 'center' });
  }],
  ['сегменты', (ctx, x, y, s) => {
    const labels = ['Сетка', 'Цвет', 'Шрифт'];
    const w = 258;
    const h = 52;
    const sw = w / 3;
    rrect(ctx, x - w / 2, y - h / 2, w, h, 15);
    ctx.fillStyle = '#E6E0D4';
    ctx.fill();
    const idx = 2 * E.snap(clamp(s * 1.4));
    rrect(ctx, x - w / 2 + 4 + idx * sw, y - h / 2 + 4, sw - 8, h - 8, 11);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    labels.forEach((l, i) => T(ctx, l, x - w / 2 + sw * i + sw / 2, y + 7, { fam: F.S(700), size: 19, color: C.ink, align: 'center' }));
  }],
  ['рейтинг', (ctx, x, y, s) => {
    for (let i = 0; i < 5; i++) {
      const cx = x - 104 + i * 52;
      const f = clamp(s * 6 - i);
      const pop = 1 + 0.25 * Math.sin(f * Math.PI);
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(pop, pop);
      starPath(ctx, 0, 0, 21, 9);
      ctx.fillStyle = f > 0.5 ? C.red : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = f > 0.5 ? C.red : C.ink;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }],
  ['уведомления', (ctx, x, y, s) => {
    const sw = s > 0 && s < 0.5 ? Math.sin(s * 40) * 0.25 * (1 - s * 2) : 0;
    ctx.save();
    ctx.translate(x - 8, y - 26);
    ctx.rotate(sw);
    ctx.translate(0, 26);
    ctx.beginPath();
    ctx.moveTo(-26, 16);
    ctx.quadraticCurveTo(-19, 8, -19, -6);
    ctx.bezierCurveTo(-19, -26, -8, -32, 0, -32);
    ctx.bezierCurveTo(8, -32, 19, -26, 19, -6);
    ctx.quadraticCurveTo(19, 8, 26, 16);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
    circle(ctx, 0, 23, 6.5, C.ink);
    ctx.restore();
    const four = s > 0.3;
    const pop = four ? E.outBack(clamp((s - 0.3) / 0.3), 3) : 1;
    circle(ctx, x + 16, y - 26, 16 * pop, C.red, CARD, 3);
    T(ctx, four ? '4' : '3', x + 16, y - 19, { fam: F.M(800), size: 17 * pop, color: '#FFFFFF', align: 'center' });
  }],
  ['теги', (ctx, x, y, s) => {
    const tags = ['#бренд', '#ui', '#моушен'];
    const ws = tags.map((t) => layout(ctx, F.S(700), 19, t, 0).width + 26);
    const total = ws.reduce((a, b) => a + b, 0) + 16;
    let cx = x - total / 2;
    tags.forEach((t, i) => {
      const sel = i === 2 ? clamp(s * 2.5) : 0;
      rrect(ctx, cx, y - 20, ws[i], 40, 20);
      ctx.fillStyle = mix('#FFFFFF', C.ink, sel);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      T(ctx, t, cx + 13, y + 7, { fam: F.S(700), size: 19, color: mix(C.ink, C.paper, sel) });
      cx += ws[i] + 8;
    });
  }],
  ['радио', (ctx, x, y, s) => {
    const sel = E.snap(clamp(s * 1.6));
    ['Код', 'Дизайн'].forEach((o, i) => {
      const oy = y - 22 + i * 46;
      circle(ctx, x - 80, oy, 14, '#FFFFFF', C.ink, 2.5);
      const on = i === 0 ? 1 - sel : sel;
      if (on > 0.02) circle(ctx, x - 80, oy, 7.5 * on, C.red);
      T(ctx, o, x - 54, oy + 8, { fam: F.S(600), size: 23, color: C.ink });
    });
  }],
  ['прогресс', (ctx, x, y, s) => {
    const v = lerp(0.2, 0.86, E.inOutCubic(clamp(s * 1.2)));
    rrect(ctx, x - 122, y + 8, 244, 14, 7);
    ctx.fillStyle = TRACK;
    ctx.fill();
    rrect(ctx, x - 122, y + 8, 244 * v, 14, 7);
    ctx.fillStyle = C.red;
    ctx.fill();
    T(ctx, 'Экспорт', x - 122, y - 14, { fam: F.S(700), size: 20, color: C.ink });
    T(ctx, `${Math.round(v * 100)}%`, x + 122, y - 14, { fam: F.M(700), size: 18, color: C.ink, align: 'right' });
  }],
  ['палитра', (ctx, x, y, s) => {
    const cols = [C.red, C.ink, C.bronze, C.blue, C.lime];
    const sel = 3 * E.snap(clamp(s * 1.5));
    cols.forEach((c, i) => circle(ctx, x - 104 + i * 52, y, 17, c));
    circle(ctx, x - 104 + sel * 52, y, 25, null, C.ink, 3);
  }],
  ['список', (ctx, x, y, s) => {
    rrect(ctx, x - 124, y - 29, 248, 58, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.22);
    ctx.lineWidth = 2;
    ctx.stroke();
    T(ctx, s > 0.4 ? 'Шрифт: Playfair' : 'Шрифт: Unbounded', x - 104, y + 7, { fam: F.S(600), size: 20, color: C.ink });
    ctx.save();
    ctx.translate(x + 98, y);
    ctx.rotate(Math.PI * E.snap(clamp(s * 1.8)));
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(0, 4);
    ctx.lineTo(7, -3);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }],
];
// formation order (row-major): which component sits in which slot
const SLOT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const FLY = (() => {
  const r = rng(31);
  return TILE_CENTERS.map((_, i) => {
    const a = r() * TAU;
    const d = 1250 + r() * 450;
    return { x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, rot: (r() - 0.5) * 1.8, t: 0.08 + i * 0.045 };
  });
})();
const waveT = (i) => 1.5 + ((i % COLS) + Math.floor(i / COLS)) * 0.09;
const pulseT = (i) => 2.6 + (COLS - 1 - (i % COLS) + Math.floor(i / COLS)) * 0.06;

let geo = null;
function geom(ctx) {
  if (geo) return geo;
  const fam = F.U(800);
  const size = Math.floor(fitSize(ctx, fam, 'СОБИРАЮ СИСТЕМЫ', COLS * TW + (COLS - 1) * GAP, -0.03));
  geo = { fam, size, tr: -0.03 * size, cap: metrics(ctx, fam, size).cap, b: 318 };
  return geo;
}

function scene(ctx, u) {
  const g = geom(ctx);
  const dark = E.inOutCubic(prog(u, 3.45, 3.75));
  bg(ctx, mix(C.paper, C.ink, dark));

  // headline
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, g.b - g.cap - 30, W, g.cap + 30 + g.size * 0.1);
  ctx.clip();
  chars(ctx, 'СОБИРАЮ СИСТЕМЫ', W / 2, g.b, {
    fam: g.fam,
    size: g.size,
    color: C.ink,
    tracking: g.tr,
    align: 'center',
    each: (i) => {
      const pin = E.outExpo(clamp((u - i * 0.02) / 0.6));
      const pout = E.inExpo(clamp((u - 3.3 - i * 0.01) / 0.3));
      return { dy: (1 - pin) * g.size * 1.3 + pout * g.size * 1.3 };
    },
  });
  ctx.restore();

  // smart guides while the formation locks
  const ga = Math.min(prog(u, 0.75, 0.85), 1 - prog(u, 1.15, 1.35));
  if (ga > 0) {
    ctx.save();
    ctx.globalAlpha = ga;
    for (let r = 0; r < ROWS; r++) line(ctx, GX0 - 60, TILE_CENTERS[r * COLS][1], W - GX0 + 60, TILE_CENTERS[r * COLS][1], C.red, 1);
    for (let c = 0; c <= COLS; c++) {
      const x = GX0 + c * (TW + GAP) - (c ? GAP / 2 : 0);
      line(ctx, x, GY0 - 40, x, GY0 + ROWS * (TH + GAP) + 16, C.red, 1);
    }
    ctx.restore();
  }

  for (let i = 0; i < TILE_CENTERS.length; i++) {
    const [tx, ty] = TILE_CENTERS[i];
    const f = FLY[i];
    const p = clamp((u - f.t) / 0.45);
    if (p <= 0) continue;
    const e = E.outCubic(p);
    const x = lerp(f.x, tx, e);
    const y = lerp(f.y, ty, e);
    const rot = f.rot * (1 - E.outBack(p, 2.2));
    const ws = clamp((u - waveT(i)) / 0.55);
    const bump = Math.sin(clamp((u - waveT(i)) / 0.28) * Math.PI) * 0.07 + Math.sin(clamp((u - pulseT(i)) / 0.25) * Math.PI) * 0.045;
    const col = E.inExpo(clamp((u - 3.4 - ((i % COLS) + Math.floor(i / COLS)) * 0.015) / 0.3));
    const w = lerp(TW, 18, col);
    const h = lerp(TH, 18, col);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1 + bump, 1 + bump);
    rrect(ctx, -w / 2, -h / 2, w, h, lerp(22, 9, col));
    ctx.fillStyle = mix(CARD, C.red, col);
    ctx.fill();
    if (col < 0.3) {
      ctx.strokeStyle = rgba(C.ink, 0.09);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const ca = 1 - clamp(col * 3);
    if (ca > 0) {
      ctx.globalAlpha *= ca;
      const [name, fn] = COMPONENTS[SLOT[i]];
      txt(ctx, name.toUpperCase(), -TW / 2 + 18, -TH / 2 + 28, { fam: F.M(500), size: 12, color: rgba(C.ink, 0.42), tracking: 1.5 });
      fn(ctx, 0, 10, ws);
    }
    ctx.restore();
  }

  revealWords(ctx, 'каждый элемент держит строй.', W / 2, 976, { fam: F.P('400i'), size: 38, color: C.ink, align: 'center' }, u, 1.9, {
    stagger: 0.06,
    dur: 0.5,
    ease: E.outExpo,
    exitAt: 3.3,
    exitDur: 0.25,
    exitEase: E.inExpo,
  });
}

function draw(ctx, lt) {
  const u = lt - L0;
  if (lt >= L0) return scene(ctx, u);
  // paper panel rising from the bottom, led by a red band
  const p = E.inOutQuart(clamp(lt / L0));
  const y = H * (1 - p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-80, y, W + 160, H - y + 80);
  ctx.clip();
  scene(ctx, u);
  ctx.restore();
  ctx.fillStyle = C.red;
  ctx.fillRect(-80, y - 40, W + 160, 40);
}

const cues = [
  { t: START, type: 'whoosh', dur: L0 + 0.05 },
  ...FLY.map((f, i) => ({ t: START + L0 + f.t + 0.45, type: 'click', v: 0.5 + (i % 3) * 0.15 })),
  { t: START + L0 + 0.8, type: 'snap' },
  ...TILE_CENTERS.map((_, i) => ({ t: START + L0 + waveT(i), type: 'tick', f: 1500 + ((i % COLS) + Math.floor(i / COLS)) * 160, v: 0.55 })),
  { t: START + L0 + 3.38, type: 'suck', dur: 0.37 },
];

export default {
  id: 'system',
  start: START,
  end: END,
  theme: (lt) => (lt < L0 ? 'dark' : lt - L0 > 3.6 ? 'dark' : 'light'),
  draw,
  blur: (lt) => (lt < L0 + 0.85 || lt - L0 > 3.38 ? 5 : 1),
  cues,
};
