import { C } from '../config.js';
import { helmetPaths, STRIPES } from './helmet.js';
import { TAU } from './math.js';

// The Hoplite mark: a round shield (hoplon) carrying the helmet silhouette.
// Helmet art is 1000×1000; its optical centre is nudged so the plume and chin balance in the circle.
const ART_C = [462, 492];
export const helmetScale = (R) => (R * 1.36) / 786;

export function emblemArt(ctx, cx, cy, R) {
  const s = helmetScale(R);
  ctx.translate(cx - ART_C[0] * s, cy - ART_C[1] * s);
  ctx.scale(s, s);
  return s;
}

/**
 * opts: shield/body/crest/stripe colors; reveal progress 0..1 for shield, rim, crest, body, stripes.
 */
export function emblem(ctx, cx, cy, R, o = {}) {
  const {
    shield = C.red,
    body = C.ink,
    crest = C.ink,
    stripe = shield,
    rim = body,
    pShield = 1,
    pRim = 1,
    pCrest = 1,
    pBody = 1,
    pStripes = 1,
  } = o;
  const P = helmetPaths();
  if (pShield > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * Math.min(1, pShield), 0, TAU);
    ctx.fillStyle = shield;
    ctx.fill();
  }
  if (pRim > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.92, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, pRim));
    ctx.strokeStyle = rim;
    ctx.lineWidth = R * 0.028;
    ctx.stroke();
  }
  ctx.save();
  emblemArt(ctx, cx, cy, R);
  if (pCrest > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(652, 312, 950 * pCrest, 0, TAU);
    ctx.clip();
    ctx.fillStyle = crest;
    ctx.fill(P.crest);
    ctx.restore();
  }
  if (pStripes > 0) {
    ctx.save();
    ctx.clip(P.crest);
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2, k] of STRIPES) {
      if (k > pStripes) break;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (pBody > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(612, 588, 950 * pBody, 0, TAU);
    ctx.clip();
    ctx.fillStyle = body;
    ctx.fill(P.body);
    ctx.restore();
  }
  ctx.restore();
}
