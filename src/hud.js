import { W, H, MX, MY, C, FPS } from './config.js';
import { F } from './lib/fonts.js';
import { txt } from './lib/text.js';
import { cropMark } from './lib/draw.js';
import { window01 } from './lib/math.js';
import { chapters } from './timeline.js';

// Persistent "designer workspace" overlay: brand, live timecode, chapter, specs, crop marks.

const HUD_FROM = 4.0;
const HUD_TO = 52.0;

function tc(t) {
  const f = Math.floor(t * FPS + 1e-6);
  const ff = f % FPS;
  const s = Math.floor(f / FPS);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(ff)}`;
}

export function drawHUD(ctx, t, theme) {
  const a = window01(t, HUD_FROM, HUD_TO, 0.2, 0.6);
  if (a <= 0) return;
  const col = theme === 'dark' ? C.paper : C.ink;
  const opt = { fam: F.M(500), size: 16, color: col, tracking: 1.6 };
  ctx.save();
  ctx.globalAlpha = a * 0.78;
  const top = MY - 20;
  const bottom = H - MY + 30;
  txt(ctx, 'HOPLITE®', MX, top, { ...opt, fam: F.M(800) });
  txt(ctx, '— SHOWREEL 2026', MX + 102, top, opt);
  txt(ctx, `TC ${tc(t)}`, W - MX, top, { ...opt, align: 'right' });
  let ch = chapters[0];
  for (const c of chapters) if (t >= c.t) ch = c;
  txt(ctx, `${ch.n}`, MX, bottom, { ...opt, fam: F.M(800) });
  txt(ctx, `/ ${ch.title}`, MX + 34, bottom, opt);
  txt(ctx, '1920×1080 · 60 FPS · 120 BPM', W - MX, bottom, { ...opt, align: 'right' });
  const m = 36;
  const L = 18;
  cropMark(ctx, m, m, 1, 1, L, col, 1.5);
  cropMark(ctx, W - m, m, -1, 1, L, col, 1.5);
  cropMark(ctx, m, H - m, 1, -1, L, col, 1.5);
  cropMark(ctx, W - m, H - m, -1, -1, L, col, 1.5);
  ctx.restore();
}
