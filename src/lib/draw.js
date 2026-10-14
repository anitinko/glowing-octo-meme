import { W, H, C } from '../config.js';
import { F } from './fonts.js';
import { font } from './text.js';
import { rgba } from './color.js';
import { TAU } from './math.js';

export function bg(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(-80, -80, W + 160, H + 160);
}

export function line(ctx, x1, y1, x2, y2, color, lw = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function circle(ctx, x, y, r, fill, stroke, lw = 1) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)));
}

export function vignette(ctx, strength = 0.55, color = '#000') {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function dotGrid(ctx, step, r, color, ox = 0, oy = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let y = (oy % step) - step; y < H + step; y += step) {
    for (let x = (ox % step) - step; x < W + step; x += step) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
}

/** Classic arrow pointer, tip at (x, y) */
export function arrowCursor(ctx, x, y, s = 1, fill = '#FFFFFF', stroke = '#0D0D0F') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 27);
  ctx.lineTo(6.6, 20.6);
  ctx.lineTo(11.2, 31);
  ctx.lineTo(15.6, 29.2);
  ctx.lineTo(11, 18.9);
  ctx.lineTo(20, 18.9);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = stroke;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Pen-tool nib, tip at (x, y), body pointing up-right */
export function penCursor(ctx, x, y, s = 1, fill = '#FFFFFF', stroke = '#0D0D0F') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(4, -6, 9, -12, 9, -19);
  ctx.lineTo(9, -24);
  ctx.lineTo(5, -28);
  ctx.lineTo(-5, -28);
  ctx.lineTo(-9, -24);
  ctx.lineTo(-9, -19);
  ctx.bezierCurveTo(-9, -12, -4, -6, 0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -13);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -15, 2.4, 0, TAU);
  ctx.fillStyle = stroke;
  ctx.fill();
  ctx.fillRect(-7, -33, 14, 4);
  ctx.restore();
}

/** Square vector anchor (Figma/Illustrator style) */
export function anchor(ctx, x, y, size = 12, { fill = '#FFFFFF', stroke = C.blue, lw = 2, selected = false } = {}) {
  ctx.fillStyle = selected ? stroke : fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.strokeRect(x - size / 2, y - size / 2, size, size);
}

/** Bézier handle: line from anchor to control point with a round knob */
export function handle(ctx, ax, ay, hx, hy, { color = C.blue, r = 6, lw = 1.5 } = {}) {
  line(ctx, ax, ay, hx, hy, color, lw);
  circle(ctx, hx, hy, r, '#FFFFFF', color, lw + 0.5);
}

/** Figma-like selection rectangle with corner handles and a dimension pill */
export function selection(ctx, x, y, w, h, { color = C.blue, label, lw = 2, alpha = 1, handles = true } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
  if (handles) {
    for (const [hx, hy] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(hx - 6, hy - 6, 12, 12);
      ctx.strokeRect(hx - 6, hy - 6, 12, 12);
    }
  }
  if (label) {
    font(ctx, F.M(500), 17);
    ctx.letterSpacing = '0px';
    const tw = ctx.measureText(label).width;
    const pw = tw + 18;
    const ph = 28;
    const px = x + w / 2 - pw / 2;
    const py = y + h + 14;
    rrect(ctx, px, py, pw, ph, 6);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + 9, py + ph / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

/** Red "redline" measurement with end ticks and a label */
export function dimension(ctx, x1, y1, x2, y2, label, { color = C.red, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  line(ctx, x1, y1, x2, y2, color, 1.5);
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const t = 7;
  if (horizontal) {
    line(ctx, x1, y1 - t, x1, y1 + t, color, 1.5);
    line(ctx, x2, y2 - t, x2, y2 + t, color, 1.5);
  } else {
    line(ctx, x1 - t, y1, x1 + t, y1, color, 1.5);
    line(ctx, x2 - t, y2, x2 + t, y2, color, 1.5);
  }
  if (label) {
    font(ctx, F.M(700), 15);
    ctx.letterSpacing = '0px';
    const tw = ctx.measureText(label).width;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const pw = tw + 12;
    const ph = 22;
    rrect(ctx, mx - pw / 2, my - ph / 2, pw, ph, 4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx - tw / 2, my + 1);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

/** Registration / crop mark */
export function cropMark(ctx, x, y, sx, sy, len, color, lw = 1.5) {
  line(ctx, x, y, x + sx * len, y, color, lw);
  line(ctx, x, y, x, y + sy * len, color, lw);
}

/** Draw a path progressively by length fraction using a dash trick. */
export function strokePartial(ctx, path, length, p, color, lw) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (p < 1) {
    ctx.setLineDash([length * p, length * 2]);
    ctx.lineDashOffset = 0;
  }
  ctx.stroke(path);
  ctx.restore();
}

/** Reveal `draw` behind a panel sweeping in from the right, led by a colored band. */
export function wipeIn(ctx, p, draw, { band = C.red, bandW = 44 } = {}) {
  if (p >= 1) return draw();
  if (p <= 0) return;
  const x = W * (1 - p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, -80, W - x + 80, H + 160);
  ctx.clip();
  draw();
  ctx.restore();
  ctx.fillStyle = band;
  ctx.fillRect(x - bandW, -80, bandW, H + 160);
}

/** Reveal `draw` inside a growing circle. */
export function irisIn(ctx, cx, cy, r, draw) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, TAU);
  ctx.clip();
  draw();
  ctx.restore();
}
