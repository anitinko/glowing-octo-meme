import { Path2D } from '@napi-rs/canvas';

// Corinthian helmet, side view facing right, designed on a 1000×1000 artboard.
// Anchors: [x, y, inX, inY, outX, outY]. Segment i→i+1 = cubic(out_i, in_{i+1}, p_{i+1}).
// Kept as anchor data (not an SVG string) so the pen-tool scene can draw it point by point.

export const BODY = [
  [470, 300, 340, 300, 600, 300], // crown
  [722, 428, 690, 352, 748, 492], // forehead
  [770, 548, 768, 520, 770, 548], // brow tip (corner)
  [612, 588, 660, 566, 650, 608], // back of the eye slot
  [784, 634, 726, 624, 784, 634], // nose guard (corner)
  [790, 820, 808, 700, 790, 820], // chin point (corner)
  [560, 792, 700, 850, 530, 766], // jaw
  [522, 730, 528, 748, 522, 730], // ear notch (corner)
  [400, 832, 470, 772, 400, 832], // neck guard
  [248, 862, 312, 866, 248, 862], // flare tip (corner)
  [292, 700, 262, 800, 300, 640], // nape
  [262, 500, 270, 590, 258, 410], // occiput
];

// Inner edge runs parallel to the dome (24 units offset) so the plume reads as one geometric family.
export const CREST = [
  [652, 312, 610, 284, 652, 312], // front inner (corner)
  [712, 228, 712, 228, 680, 150], // front outer (corner)
  [456, 112, 600, 112, 300, 112], // top
  [112, 420, 130, 240, 100, 540], // back
  [200, 712, 130, 650, 200, 712], // tail tip (corner)
  [238, 504, 234, 610, 238, 400], // occiput inner
  [470, 276, 352, 276, 560, 276], // crown inner
];

export function pathFrom(anchors, closed = true, upTo = anchors.length) {
  const p = new Path2D();
  const n = Math.min(upTo, anchors.length);
  if (!n) return p;
  p.moveTo(anchors[0][0], anchors[0][1]);
  for (let i = 1; i < n; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    p.bezierCurveTo(a[4], a[5], b[2], b[3], b[0], b[1]);
  }
  if (closed && n === anchors.length) {
    const a = anchors[n - 1];
    const b = anchors[0];
    p.bezierCurveTo(a[4], a[5], b[2], b[3], b[0], b[1]);
    p.closePath();
  }
  return p;
}

/** Point on segment i→i+1 at parameter u (for drawing a segment partially). */
export function segPoint(anchors, i, u) {
  const a = anchors[i % anchors.length];
  const b = anchors[(i + 1) % anchors.length];
  const m = 1 - u;
  const x = m * m * m * a[0] + 3 * m * m * u * a[4] + 3 * m * u * u * b[2] + u * u * u * b[0];
  const y = m * m * m * a[1] + 3 * m * m * u * a[5] + 3 * m * u * u * b[3] + u * u * u * b[1];
  return [x, y];
}

/** Split a cubic at u and return the first part's control points (de Casteljau). */
export function segPart(anchors, i, u) {
  const a = anchors[i % anchors.length];
  const b = anchors[(i + 1) % anchors.length];
  const L = (p, q) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  const p0 = [a[0], a[1]];
  const p1 = [a[4], a[5]];
  const p2 = [b[2], b[3]];
  const p3 = [b[0], b[1]];
  const q0 = L(p0, p1);
  const q1 = L(p1, p2);
  const q2 = L(p2, p3);
  const r0 = L(q0, q1);
  const r1 = L(q1, q2);
  const s = L(r0, r1);
  return [p0, q0, r0, s];
}

// Radial horsehair strokes, from the front of the plume to the tail.
export const STRIPES = Array.from({ length: 15 }, (_, i) => {
  const k = i / 14;
  const a = -0.62 - k * 3.2;
  const cx = 445;
  const cy = 482;
  return [cx + Math.cos(a) * 180, cy + Math.sin(a) * 180, cx + Math.cos(a) * 440, cy + Math.sin(a) * 440, k];
});

export function pathLength(anchors, closed = true) {
  let L = 0;
  const n = closed ? anchors.length : anchors.length - 1;
  for (let i = 0; i < n; i++) {
    let [px, py] = segPoint(anchors, i, 0);
    for (let k = 1; k <= 40; k++) {
      const [x, y] = segPoint(anchors, i, k / 40);
      L += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
  }
  return L;
}

let cache = null;
export function helmetPaths() {
  if (cache) return cache;
  cache = { body: pathFrom(BODY), crest: pathFrom(CREST) };
  return cache;
}

/**
 * Draws the full helmet mark into the 1000×1000 artboard space (caller sets the transform).
 * style: { body, crest, stripe, stripes: 0..1 reveal, outline }
 */
export function drawHelmet(ctx, style = {}) {
  const { body = '#FF3D21', crest = '#0D0D0F', stripe = '#F2EEE6', stripes = 1, crestAlpha = 1, bodyAlpha = 1 } = style;
  const P = helmetPaths();
  if (crestAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= crestAlpha;
    ctx.fillStyle = crest;
    ctx.fill(P.crest);
    if (stripes > 0) {
      ctx.save();
      ctx.clip(P.crest);
      ctx.strokeStyle = stripe;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2, k] of STRIPES) {
        if (k > stripes) break;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  if (bodyAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= bodyAlpha;
    ctx.fillStyle = body;
    ctx.fill(P.body);
    ctx.restore();
  }
}

/** Strokes anchors up to P segments (fractional), returns the pen tip. Caller sets stroke style. */
export function tracePath(ctx, A, P) {
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
