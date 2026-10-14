import { C, W, H } from '../config.js';
import { F } from '../lib/fonts.js';
import { txt, layout, revealWords } from '../lib/text.js';
import { E } from '../lib/ease.js';
import { clamp, prog, lerp, rng } from '../lib/math.js';
import { bg, circle, dotGrid, vignette } from '../lib/draw.js';
import { rgba, mix } from '../lib/color.js';
import { emblem } from '../lib/emblem.js';
import { LOCK, drawWordmark } from './s11-mark.js';

// 10 / Finale — the lockup flips to signal red on the last impact, signs the work,
// then collapses into a text cursor: back in the editor where it started.

const START = 48.0;
const END = 56.0;
const FAM = F.M(400);
const FS = 44;
const LH = 76;
const X0 = 513;
const Y0 = 470;
const TOK = { com: '#5E5E6A', id: C.paper, pun: '#7D7D88', prop: '#CFC9BE', str: C.red, ok: '#7BE08A' };
const LINES = [
  [['me', 'id'], ['.', 'pun'], ['role', 'prop'], [' = ', 'pun'], ['"дизайнер"', 'str'], [';', 'pun'], ['  // ✓ подтверждено', 'com']],
  [['me', 'id'], ['.', 'pun'], ['ship', 'prop'], ['();', 'pun']],
  [['// спасибо, что досмотрели.', 'com']],
];
const LINE_T = [4.2, 5.55, 6.0];
const STEP = 0.028;

const typed = [];
{
  const r = rng(3);
  LINES.forEach((toks, li) => {
    let col = 0;
    let t = LINE_T[li];
    for (const [s, k] of toks)
      for (const ch of s) {
        typed.push({ ch, li, col, t, color: ch === '✓' ? TOK.ok : TOK[k] });
        col++;
        t += STEP * (0.7 + r() * 0.6);
      }
  });
}
const lastT = typed[typed.length - 1].t;

let cw = 0;
function editor(ctx, lt) {
  bg(ctx, C.ink);
  dotGrid(ctx, 40, 1.3, rgba(C.paper, 0.045));
  cw = cw || layout(ctx, FAM, FS, 'M').width;
  ctx.font = `${FS}px "${FAM}"`;
  let cur = [0, 0];
  for (let li = 0; li < LINES.length; li++) {
    if (lt < LINE_T[li] - 0.15 && li > 0) continue;
    ctx.fillStyle = '#3A3A44';
    ctx.fillText(String(li + 5).padStart(2, '0'), X0 - 110, Y0 + li * LH);
  }
  for (const c of typed) {
    if (c.t > lt) break;
    if (c.ch === '✓') {
      // JetBrains Mono has no U+2713, so the tick is drawn inside its mono cell
      const x = X0 + c.col * cw;
      const y = Y0 + c.li * LH;
      ctx.save();
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + cw * 0.12, y - FS * 0.3);
      ctx.lineTo(x + cw * 0.42, y - FS * 0.04);
      ctx.lineTo(x + cw * 0.92, y - FS * 0.68);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = c.color;
      ctx.fillText(c.ch, X0 + c.col * cw, Y0 + c.li * LH);
    }
    cur = [c.li, c.col + 1];
  }
  const typing = typed.some((c) => c.t <= lt && lt - c.t < 0.3);
  if (typing || Math.floor(lt / 0.25) % 2 === 0) {
    ctx.fillStyle = C.red;
    ctx.fillRect(X0 + cur[1] * cw - 2, Y0 + cur[0] * LH - FS * 0.82, 4, FS * 1.04);
  }
  vignette(ctx, 0.6);
}

function endCard(ctx, lt) {
  bg(ctx, C.red);
  const punch = 1 + 0.06 * (1 - E.outExpo(clamp(lt / 0.45)));
  const drift = 1 + 0.025 * E.inOutCubic(clamp(lt / 3.5));
  const z = punch * drift;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  emblem(ctx, LOCK.cx, LOCK.cy, LOCK.R, { shield: C.ink, body: C.red, crest: C.red, stripe: C.ink, rim: C.red });
  drawWordmark(ctx, 99, C.ink, rgba(C.ink, 0.75));
  ctx.restore();
  revealWords(
    ctx,
    'этот ролик я собрал сам: 3 360 кадров · 0 шаблонов · музыка тоже моя',
    W / 2,
    900,
    { fam: F.M(500), size: 26, color: C.ink, align: 'center' },
    lt,
    0.7,
    { stagger: 0.035, dur: 0.45, ease: E.outExpo },
  );
}

function draw(ctx, lt) {
  if (lt < 3.55) return endCard(ctx, lt);
  if (lt >= 4.0) {
    editor(ctx, lt);
  } else {
    // the whole card collapses into the editor cursor
    const q = E.inExpo(prog(lt, 3.55, 3.97));
    const tx = X0 - 2;
    const ty = Y0 - FS * 0.82;
    bg(ctx, C.ink);
    const x = lerp(-80, tx, q);
    const y = lerp(-80, ty, q);
    const w = lerp(W + 160, 4, q);
    const h = lerp(H + 160, FS * 1.04, q);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const s = lerp(1, 0.04, q);
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.translate(-tx, -ty);
    endCard(ctx, lt);
    ctx.restore();
  }
  const fade = prog(lt, 7.35, 7.95);
  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(-80, -80, W + 160, H + 160);
  }
}

const cues = [
  ...typed.filter((_, i) => i % 2 === 0).map((c) => ({ t: START + c.t, type: 'key', v: 0.55 })),
  { t: START + 3.55, type: 'suck', dur: 0.42 },
  { t: START + lastT + 0.4, type: 'blip', f: 880, v: 0.5 },
];

export default {
  id: 'finale',
  start: START,
  end: END,
  theme: (lt) => (lt < 3.9 ? 'red' : 'dark'),
  draw,
  blur: (lt) => (lt < 0.4 || (lt > 3.5 && lt < 4.0) ? 5 : 1),
  cues,
};
