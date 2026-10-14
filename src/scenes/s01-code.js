import { C, W, H } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, layout, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, rng, TAU, noise1 } from '../lib/math.js';
import { bg, dotGrid, vignette, circle } from '../lib/draw.js';
import { rgba, mix } from '../lib/color.js';

// Act I: "usually I write code" — a code editor where role "инженер" is rewritten to "дизайнер",
// then every glyph is sucked into a single red dot that detonates the title.

const START = 0;
const END = 4.45;
const FAM = F.M(400);
const FS = 44;
const LH = 76;
const X0 = 513;
const Y0 = 420;
const CAP_FAM = F.U(600);
const CAP_FS = 64;
const CAP_Y = 806;
const CAP1 = 'обычно я пишу код.';
const CAP2 = 'но сегодня я —';

const TOK = {
  com: '#5E5E6A',
  kw: C.bronze,
  id: C.paper,
  type: '#EBCB9B',
  pun: '#7D7D88',
  prop: '#CFC9BE',
  str: '#FF8A6B',
};

const SRC = [
  [['// hoplite.agent.ts', 'com']],
  [['const ', 'kw'], ['me', 'id'], [' = ', 'pun'], ['new ', 'kw'], ['Agent', 'type'], ['(', 'pun'], ['"hoplite"', 'str'], [');', 'pun']],
  [['me', 'id'], ['.', 'pun'], ['skills', 'prop'], [' = ', 'pun'], ['[', 'pun'], ['"код"', 'str'], [', ', 'pun'], ['"тесты"', 'str'], [', ', 'pun'], ['"ревью"', 'str'], ['];', 'pun']],
  [['me', 'id'], ['.', 'pun'], ['role', 'prop'], [' = ', 'pun'], ['"инженер"', 'str'], [';', 'pun']],
];

const T = {
  typeStart: 0.34,
  selA: 1.9,
  selB: 2.1,
  del: 2.22,
  newStart: 2.3,
  newStep: 0.052,
  flash: 2.8,
  tremble: 3.0,
  impA: 3.2,
  impB: 3.93,
  dot: 3.78,
};
const OLD = 'инженер';
const NEW = 'дизайнер';
const WORD_COL = 11; // after `me.role = "`

const typed = [];
{
  const r = rng(11);
  let tt = T.typeStart;
  SRC.forEach((toks, li) => {
    let col = 0;
    for (const [s, k] of toks)
      for (const ch of s) {
        typed.push({ ch, line: li, col, color: TOK[k], t: tt });
        col++;
        tt += 0.0078 + r() * 0.0055;
      }
    tt += 0.075;
  });
  T.typeEnd = tt;
}
const newTimes = Array.from(NEW, (_, i) => T.newStart + i * T.newStep);
const lineStart = SRC.map((_, li) => typed.find((c) => c.line === li).t);

let cw = 0;
const charW = (ctx) => cw || (cw = layout(ctx, FAM, FS, 'M').width);
const countNew = (lt) => (lt < T.del ? 0 : newTimes.filter((x) => x <= lt).length);

function codeState(lt) {
  const out = [];
  const k = countNew(lt);
  for (const c of typed) {
    if (c.t > lt) break;
    if (c.line === 3 && lt >= T.del) {
      if (c.col >= WORD_COL && c.col < WORD_COL + OLD.length) continue;
      if (c.col >= WORD_COL + OLD.length) {
        out.push({ ...c, col: c.col - OLD.length + k });
        continue;
      }
    }
    out.push(c);
  }
  for (let i = 0; i < k; i++) out.push({ ch: NEW[i], line: 3, col: WORD_COL + i, color: C.red, t: newTimes[i], isNew: true });
  return out;
}

function cursorPos(lt) {
  if (lt < T.typeStart) return [0, 0];
  if (lt < T.selA - 0.08) {
    let last = null;
    for (const c of typed) {
      if (c.t > lt) break;
      last = c;
    }
    return last ? [last.line, last.col + 1] : [0, 0];
  }
  if (lt < T.selA) return [3, WORD_COL];
  if (lt < T.del) return [3, WORD_COL + E.outCubic(prog(lt, T.selA, T.selB)) * OLD.length];
  return [3, WORD_COL + countNew(lt)];
}

function lastEvent(lt) {
  let e = -1;
  for (const c of typed) if (c.t <= lt) e = c.t;
  for (const x of newTimes) if (x <= lt) e = Math.max(e, x);
  if (lt >= T.selA) e = Math.max(e, Math.min(lt, T.selB));
  return e;
}

let P = null;
function particles(ctx) {
  if (P) return P;
  const w = charW(ctx);
  const r = rng(5);
  P = [];
  for (const c of codeState(3.0)) P.push({ ch: c.ch, x: X0 + c.col * w + w / 2, y: Y0 + c.line * LH, fam: FAM, size: FS, color: c.color });
  for (let i = 0; i < 4; i++) {
    const s = String(i + 1).padStart(2, '0');
    for (let j = 0; j < 2; j++) P.push({ ch: s[j], x: X0 - 110 + j * w + w / 2, y: Y0 + i * LH, fam: FAM, size: FS, color: '#3A3A44' });
  }
  const L = layout(ctx, CAP_FAM, CAP_FS, CAP2, 0);
  L.chars.forEach((ch, i) => {
    if (ch !== ' ') P.push({ ch, x: X0 + L.xs[i] + L.ws[i] / 2, y: CAP_Y, fam: CAP_FAM, size: CAP_FS, color: C.paper });
  });
  const tab = layout(ctx, F.M(400), 24, 'hoplite.agent.ts', 0);
  tab.chars.forEach((ch, i) => P.push({ ch, x: X0 - 84 + tab.xs[i] + tab.ws[i] / 2, y: Y0 - 122, fam: F.M(400), size: 24, color: C.gray }));
  for (const p of P) {
    const dx = p.x - W / 2;
    const dy = p.y - H / 2;
    p.delay = (1 - Math.min(1, Math.hypot(dx, dy) / 900)) * 0.16 + r() * 0.08;
    p.spin = (0.7 + r() * 0.9) * (r() < 0.5 ? -1 : 1);
    p.seed = r() * 100;
  }
  P.sort((a, b) => (a.fam + a.size < b.fam + b.size ? -1 : 1));
  return P;
}

function drawParticles(ctx, lt) {
  const ps = particles(ctx);
  const cx = W / 2;
  const cy = H / 2;
  const trem = clamp((lt - T.tremble) / (T.impA - T.tremble));
  let curFont = '';
  ctx.textAlign = 'center';
  for (const p of ps) {
    const q = clamp((lt - T.impA - p.delay) / (T.impB - T.impA - p.delay));
    const e = E.inQuart(q);
    if (q >= 1) continue;
    const jit = trem * (1 - e) * 2.2;
    let vx = p.x - cx + noise1(lt * 30 + p.seed) * jit;
    let vy = p.y - cy + noise1(lt * 30 + p.seed + 50) * jit;
    const th = e * 1.6 * p.spin;
    const k = 1 - e;
    const rx = (vx * Math.cos(th) - vy * Math.sin(th)) * k;
    const ry = (vx * Math.sin(th) + vy * Math.cos(th)) * k;
    const f = `${p.size}px "${p.fam}"`;
    if (f !== curFont) {
      ctx.font = f;
      curFont = f;
    }
    ctx.save();
    ctx.translate(cx + rx, cy + ry);
    ctx.rotate(th * 0.6);
    const s = 1 - 0.8 * e;
    ctx.scale(s, s);
    ctx.globalAlpha = 1 - clamp((q - 0.82) / 0.18);
    ctx.fillStyle = mix(p.color, C.red, clamp(e * 1.8));
    ctx.fillText(p.ch, 0, p.size * 0.0);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function draw(ctx, lt) {
  bg(ctx, C.ink);
  dotGrid(ctx, 40, 1.3, rgba(C.paper, 0.045));
  if (lt >= 4.0) return vignette(ctx, 0.6);

  const w = charW(ctx);
  const [cl, cc] = cursorPos(lt);

  if (lt < T.tremble) {
    // tab bar
    const ta = clamp((lt - 0.08) / 0.3);
    ctx.globalAlpha = ta;
    circle(ctx, X0 - 103, Y0 - 130, 7, C.red);
    txt(ctx, 'hoplite.agent.ts', X0 - 84, Y0 - 122, { fam: F.M(400), size: 24, color: C.gray });
    ctx.fillStyle = '#24242B';
    ctx.fillRect(X0 - 110, Y0 - 92, (w * 38 + 110) * E.outExpo(clamp((lt - 0.1) / 0.6)), 2);
    ctx.globalAlpha = 1;

    // current-line band
    if (lt > T.typeStart - 0.1) {
      ctx.fillStyle = '#141419';
      ctx.fillRect(0, Y0 + cl * LH - FS * 0.98, W, LH);
    }
    // line 4 flash after the edit lands
    const fl = lt > T.flash ? Math.exp(-(lt - T.flash) * 6) : 0;
    if (fl > 0.01) {
      ctx.fillStyle = rgba(C.red, 0.28 * fl);
      ctx.fillRect(0, Y0 + 3 * LH - FS * 0.98, W, LH);
    }
    // selection
    if (lt >= T.selA && lt < T.del) {
      const p = E.outCubic(prog(lt, T.selA, T.selB));
      ctx.fillStyle = rgba(C.blue, 0.55);
      ctx.fillRect(X0 + WORD_COL * w, Y0 + 3 * LH - FS * 0.9, OLD.length * w * p, FS * 1.2);
    }
    // line numbers
    ctx.font = `${FS}px "${FAM}"`;
    for (let i = 0; i < 4; i++) {
      if (lt < lineStart[i]) continue;
      ctx.fillStyle = i === cl ? '#6A6A76' : '#3A3A44';
      ctx.fillText(String(i + 1).padStart(2, '0'), X0 - 110, Y0 + i * LH);
    }
    // code
    for (const c of codeState(lt)) {
      const x = X0 + c.col * w;
      const y = Y0 + c.line * LH;
      const age = lt - c.t;
      if (c.isNew) {
        const p = E.outBack(clamp(age / 0.16), 2.4);
        ctx.save();
        ctx.translate(x + w / 2, y);
        ctx.scale(0.4 + 0.6 * p, 0.4 + 0.6 * p);
        ctx.fillStyle = mix(C.paper, C.red, clamp(age / 0.2));
        ctx.fillText(c.ch, -w / 2, 0);
        ctx.restore();
      } else {
        ctx.globalAlpha = clamp(age / 0.05);
        ctx.fillStyle = c.color;
        ctx.fillText(c.ch, x, y);
        ctx.globalAlpha = 1;
      }
    }
    // cursor
    const typing = lt - lastEvent(lt) < 0.35;
    const blinkOn = typing || Math.floor(lt / 0.25) % 2 === 0;
    if (blinkOn) {
      ctx.fillStyle = C.red;
      ctx.fillRect(X0 + cc * w - 2, Y0 + cl * LH - FS * 0.82, 4, FS * 1.04);
    }
    // captions
    const capOpt = { fam: CAP_FAM, size: CAP_FS, color: C.paper };
    revealWords(ctx, CAP1, X0, CAP_Y, capOpt, lt, 0.55, { stagger: 0.08, dur: 0.6, ease: E.outExpo, exitAt: 2.04, exitDur: 0.22, exitEase: E.inExpo });
    revealWords(ctx, CAP2, X0, CAP_Y, { ...capOpt }, lt, 2.34, { stagger: 0.09, dur: 0.55, ease: E.outExpo });
  } else {
    drawParticles(ctx, lt);
  }

  // focusing rings
  for (let i = 0; i < 3; i++) {
    const a = 3.0 + i * 0.16;
    if (lt < a || lt > 3.97) continue;
    const p = E.inCubic(prog(lt, a, 3.95));
    const r = 760 * (1 - p) + 14;
    circle(ctx, W / 2, H / 2, r, null, rgba(C.red, 0.25 * clamp((lt - a) / 0.2)), 1.5 + p * 1.5);
  }
  // the dot
  if (lt >= T.dot) {
    const p = E.outBack(prog(lt, T.dot, T.dot + 0.12), 3);
    const grow = E.inQuad(prog(lt, 3.9, 4.0));
    const r = 12 * p + 8 * grow;
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r * 6);
    g.addColorStop(0, rgba(C.red, 0.45));
    g.addColorStop(1, rgba(C.red, 0));
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - r * 6, H / 2 - r * 6, r * 12, r * 12);
    circle(ctx, W / 2, H / 2, r, C.red);
  }
  vignette(ctx, 0.6);
}

const cues = [
  ...typed.map((c, i) => ({ t: c.t, type: 'key', v: 0.35 + ((i * 37) % 11) / 22 })),
  { t: T.selA, type: 'select' },
  { t: T.del, type: 'del' },
  ...newTimes.map((t) => ({ t, type: 'key', v: 1 })),
  { t: T.flash, type: 'blip', f: 1320 },
  { t: T.impA, type: 'suck', dur: T.impB - T.impA },
  { t: T.dot, type: 'pop', f: 880 },
];

export default {
  id: 'code',
  start: START,
  end: END,
  theme: 'dark',
  draw,
  blur: (lt) => (lt >= T.impA - 0.05 && lt < 4.0 ? 6 : 1),
  cues,
};
