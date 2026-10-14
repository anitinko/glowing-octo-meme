export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** 0..1 progress of t inside [a, b] */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
/** 0..1 progress of t inside [a, a + d] */
export const seg = (t, a, d) => clamp((t - a) / d);
export const mapr = (x, a, b, c, d) => c + (d - c) * clamp((x - a) / (b - a));
/** Rises 0→1 over [a, a+din], holds, falls 1→0 over [b-dout, b] */
export const window01 = (t, a, b, din, dout = din) => Math.min(seg(t, a, din), 1 - seg(t, b - dout, dout));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth value noise in [-1, 1] */
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}

/** Exponential decay pulse after each beat; 1 on the beat, ~0 before the next */
export const beatPulse = (t, beat = 0.5, k = 10) => Math.exp(-((((t % beat) + beat) % beat) * k));
