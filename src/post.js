import { noise1 } from './lib/math.js';
import { impacts } from './timeline.js';

// Impact-driven camera shake, white flash and RGB split.

export function shakeAt(t) {
  let x = 0;
  let y = 0;
  for (const c of impacts) {
    const d = t - c.t;
    if (d < 0 || d > 0.9) continue;
    const a = c.amp * Math.exp(-d * 7);
    x += a * noise1(d * 38 + c.t * 13.1);
    y += a * noise1(d * 38 + 71 + c.t * 7.7);
  }
  return [x, y];
}

export function flashAt(t) {
  let f = 0;
  for (const c of impacts) {
    const d = t - c.t;
    if (d < 0 || d > 0.6 || !c.flash) continue;
    f += c.flash * Math.exp(-d * 11);
  }
  return Math.min(1, f);
}

export function rgbAt(t) {
  let s = 0;
  for (const c of impacts) {
    const d = t - c.t;
    if (d < 0 || d > 0.7 || !c.rgb) continue;
    s += c.rgb * Math.exp(-d * 8);
  }
  return s;
}
