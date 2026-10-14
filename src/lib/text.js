// Typography helpers. All sizes in px; tracking in px (use em * size for relative tracking).

export function font(ctx, fam, size) {
  ctx.font = `${size}px "${fam}"`;
}

const layoutCache = new Map();
/** Per-glyph x offsets (kerning-aware via substring measurement). */
export function layout(ctx, fam, size, str, tracking = 0) {
  const key = `${fam}|${size}|${tracking}|${str}`;
  let L = layoutCache.get(key);
  if (L) return L;
  ctx.save();
  font(ctx, fam, size);
  ctx.letterSpacing = '0px';
  const chars = Array.from(str);
  const xs = [];
  let acc = '';
  for (let i = 0; i < chars.length; i++) {
    xs.push(ctx.measureText(acc).width + i * tracking);
    acc += chars[i];
  }
  const width = ctx.measureText(str).width + Math.max(0, chars.length - 1) * tracking;
  const ws = chars.map((_, i) => (i + 1 < chars.length ? xs[i + 1] - tracking : width) - xs[i]);
  ctx.restore();
  L = { chars, xs, ws, width };
  layoutCache.set(key, L);
  return L;
}

export const textWidth = (ctx, fam, size, str, tracking = 0) => layout(ctx, fam, size, str, tracking).width;

/** Font size at which `str` spans exactly maxW (tracking given in em). */
export function fitSize(ctx, fam, str, maxW, trackEm = 0) {
  const w = layout(ctx, fam, 100, str, trackEm * 100).width;
  return (maxW / w) * 100;
}

const metricCache = new Map();
/** { cap, x, asc, desc } for a font at a given size */
export function metrics(ctx, fam, size) {
  const key = `${fam}|${size}`;
  let m = metricCache.get(key);
  if (m) return m;
  ctx.save();
  font(ctx, fam, size);
  const H = ctx.measureText('H');
  const X = ctx.measureText('x');
  const P = ctx.measureText('p');
  const D = ctx.measureText('d');
  m = {
    cap: H.actualBoundingBoxAscent,
    x: X.actualBoundingBoxAscent,
    asc: D.actualBoundingBoxAscent,
    desc: P.actualBoundingBoxDescent,
    fontAsc: H.fontBoundingBoxAscent,
    fontDesc: H.fontBoundingBoxDescent,
  };
  ctx.restore();
  metricCache.set(key, m);
  return m;
}

/** Plain text draw. */
export function txt(ctx, str, x, y, { fam, size, color, align = 'left', tracking = 0, baseline = 'alphabetic', alpha } = {}) {
  font(ctx, fam, size);
  ctx.letterSpacing = `${tracking}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = baseline;
  if (color) ctx.fillStyle = color;
  let ox = x;
  if (align !== 'left') {
    const w = layout(ctx, fam, size, str, tracking).width;
    ox = align === 'center' ? x - w / 2 : x - w;
  }
  if (alpha != null) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.fillText(str, ox, y);
    ctx.globalAlpha = a;
  } else ctx.fillText(str, ox, y);
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Per-glyph animated text. `each(i, n, ch)` returns {dx, dy, rot, scale, sx, sy, alpha, color} or null to skip.
 * Returns the layout with absolute origin `ox`.
 */
export function chars(ctx, str, x, y, { fam, size, color, align = 'left', tracking = 0, each } = {}) {
  const L = layout(ctx, fam, size, str, tracking);
  let ox = x;
  if (align === 'center') ox = x - L.width / 2;
  else if (align === 'right') ox = x - L.width;
  font(ctx, fam, size);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (color) ctx.fillStyle = color;
  const n = L.chars.length;
  for (let i = 0; i < n; i++) {
    const ch = L.chars[i];
    if (ch === ' ') continue;
    const cx = ox + L.xs[i];
    const cw = L.ws[i];
    if (!each) {
      ctx.fillText(ch, cx, y);
      continue;
    }
    const s = each(i, n, ch, cx, cw);
    if (!s || s.alpha === 0) continue;
    ctx.save();
    ctx.translate(cx + cw / 2 + (s.dx || 0), y + (s.dy || 0));
    if (s.rot) ctx.rotate(s.rot);
    if (s.scale != null || s.sx != null || s.sy != null) ctx.scale(s.sx ?? s.scale ?? 1, s.sy ?? s.scale ?? 1);
    if (s.alpha != null) ctx.globalAlpha *= s.alpha;
    if (s.color) ctx.fillStyle = s.color;
    ctx.fillText(ch, -cw / 2, 0);
    ctx.restore();
  }
  return { ...L, ox };
}

/** Clip to a rect and slide content up from below it (p: 0 hidden → 1 in place). */
export function maskUp(ctx, x, y, w, h, p, draw, dir = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(0, (1 - p) * h * dir);
  draw();
  ctx.restore();
}

/**
 * Word-by-word masked reveal of a single line.
 * enter: 0..1 per word handled internally from `t`, start, stagger, dur, ease.
 */
export function revealWords(ctx, str, x, y, opt, t, start, { stagger = 0.06, dur = 0.5, ease, exitAt = Infinity, exitDur = 0.35, exitEase } = {}) {
  const { fam, size, tracking = 0, align = 'left' } = opt;
  const words = str.split(' ');
  const space = layout(ctx, fam, size, ' ', 0).width + tracking;
  const widths = words.map((w) => layout(ctx, fam, size, w, tracking).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const asc = size * 1.05;
  const desc = size * 0.35;
  words.forEach((w, i) => {
    const pin = ease((Math.min(1, Math.max(0, (t - start - i * stagger) / dur))));
    const pout = t > exitAt ? (exitEase || ease)(Math.min(1, Math.max(0, (t - exitAt - i * stagger * 0.6) / exitDur))) : 0;
    if (pin > 0 && pout < 1) {
      const wx = cx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx - size * 0.2, y - asc, widths[i] + size * 0.4, asc + desc);
      ctx.clip();
      const dy = (1 - pin) * (asc + desc) - pout * (asc + desc);
      txt(ctx, w, wx, y + dy, { ...opt, align: 'left' });
      ctx.restore();
    }
    cx += widths[i] + space;
  });
  return total;
}
