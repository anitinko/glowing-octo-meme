// DSP primitives for the procedural score: noise, polyBLEP oscillators, filters, reverb, delay,
// master-bus tools (soft clip, true-peak limiter, BS.1770 loudness) and WAV I/O. Pure Node, no deps.
import fs from 'node:fs';
import path from 'node:path';
import { DURATION } from '../config.js';

export const SR = 48000;
export const N = Math.round(SR * DURATION);
export const TAU = Math.PI * 2;
export const GAP_START = 35.875; // full-silence cut right before the drop
export const GAP_END = 36.0;
export const RAMP = 0.002; // minimum attack/release ramp, seconds

export const db = (x) => 10 ** (x / 20);
export const todb = (x) => 20 * Math.log10(Math.max(x, 1e-12));
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (x) => ((x = clamp(x)), x * x * (3 - 2 * x));
/** Raised-cosine ramp 0→1 over x in [0,1]. */
export const cosRamp = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));
export const pan = (p) => {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
};

/** Piecewise curve through [t, v] points; smoothstep between points, exponential (log-domain) if `log`. */
export function curve(points, log = false) {
  const pts = log ? points.map(([t, v]) => [t, Math.log(v)]) : points;
  return (t) => {
    if (t <= pts[0][0]) return log ? Math.exp(pts[0][1]) : pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t < pts[i][0]) {
        const [t0, v0] = pts[i - 1];
        const [t1, v1] = pts[i];
        const v = v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
        return log ? Math.exp(v) : v;
      }
    }
    const v = pts[pts.length - 1][1];
    return log ? Math.exp(v) : v;
  };
}

// ---------------------------------------------------------------- buffers and voice windows

export class Bus {
  constructor(n = N) {
    this.l = new Float32Array(n);
    this.r = new Float32Array(n);
  }
  add(o, g = 1) {
    for (let i = 0; i < this.l.length; i++) {
      this.l[i] += o.l[i] * g;
      this.r[i] += o.r[i] * g;
    }
  }
}

const STOP = Math.round(GAP_START * SR);
const FADE = Math.round(0.003 * SR);

/**
 * Sample window for a voice starting at t0 lasting `len` seconds. Voices starting inside the silence gap
 * are dropped and voices crossing into it are truncated (see `tail`), so nothing rings across the cut.
 */
export function span(t0, len) {
  if (t0 >= GAP_START && t0 < GAP_END) return null;
  const i = Math.round(t0 * SR);
  if (i < 0 || i >= N) return null;
  const end = Math.min(i + Math.ceil(len * SR), N, t0 < GAP_START ? STOP : N);
  return end > i ? { i, n: end - i } : null;
}
/** 3 ms raised-cosine fade over the last samples of a (possibly truncated) voice. */
export const tail = (k, n) => {
  const r = n - k;
  return r >= FADE ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * r) / FADE);
};
/** Attack ramp of `a` samples (≥ RAMP) at sample k. */
export const attack = (k, a) => (k >= a ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * k) / a));
export const ms = (x) => Math.max(1, Math.round(x * SR));

// ---------------------------------------------------------------- noise

export class Noise {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  /** xorshift32 → uniform in [-1, 1) */
  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 2147483648 - 1;
  }
  /** uniform in [0, 1) */
  rand() {
    return (this.next() + 1) * 0.5;
  }
}

/** Stable 32-bit seed from a list of numbers (event times, indices…). */
export function seedOf(...vals) {
  let h = 2166136261;
  for (const v of vals) {
    h = Math.imul(h ^ (Math.round(v * 1000) | 0), 16777619);
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
  }
  return (h >>> 0) || 1;
}

// ---------------------------------------------------------------- band-limited oscillators (polyBLEP)

export function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
export const sawBL = (ph, dt) => 2 * ph - 1 - blep(ph, dt);
export function sqrBL(ph, dt, pw = 0.5) {
  let p2 = ph + 1 - pw;
  if (p2 >= 1) p2 -= 1;
  return (ph < pw ? 1 : -1) + blep(ph, dt) - blep(p2, dt);
}

// ---------------------------------------------------------------- filters

/** Zero-delay-feedback state-variable filter (Simper/Zavalishin), safe under fast cutoff modulation. */
export class SVF {
  constructor() {
    this.s1 = 0;
    this.s2 = 0;
    this.k = 1;
    this.a1 = this.a2 = this.a3 = 0;
  }
  set(fc, q = Math.SQRT1_2) {
    const f = Math.min(Math.max(fc, 8), SR * 0.45);
    const g = Math.tan((Math.PI * f) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  /** One step; returns the low-pass output, band/high in .bp/.hp (bp has unity peak gain). */
  tick(x) {
    const v3 = x - this.s2;
    const v1 = this.a1 * this.s1 + this.a2 * v3;
    const v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    this.bp = this.k * v1;
    this.hp = x - this.k * v1 - v2;
    return v2;
  }
}

/** RBJ biquad (direct form II transposed). */
export class Biquad {
  constructor(type = 'lp', fc = 1000, q = Math.SQRT1_2, gainDb = 0) {
    this.z1 = this.z2 = 0;
    this.set(type, fc, q, gainDb);
  }
  set(type, fc, q = Math.SQRT1_2, gainDb = 0) {
    const w = (TAU * Math.min(fc, SR * 0.45)) / SR;
    const c = Math.cos(w);
    const s = Math.sin(w);
    const al = s / (2 * q);
    const A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lp':
        b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'hp':
        b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'bp':
        b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'peak':
        b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; break;
      case 'hishelf': {
        const t = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 + (A - 1) * c + t); b1 = -2 * A * (A - 1 + (A + 1) * c); b2 = A * (A + 1 + (A - 1) * c - t);
        a0 = A + 1 - (A - 1) * c + t; a1 = 2 * (A - 1 - (A + 1) * c); a2 = A + 1 - (A - 1) * c - t; break;
      }
      case 'loshelf': {
        const t = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 - (A - 1) * c + t); b1 = 2 * A * (A - 1 - (A + 1) * c); b2 = A * (A + 1 - (A - 1) * c - t);
        a0 = A + 1 + (A - 1) * c + t; a1 = -2 * (A - 1 + (A + 1) * c); a2 = A + 1 + (A - 1) * c - t; break;
      }
      default:
        throw new Error('biquad type ' + type);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  tick(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  run(buf, i0 = 0, i1 = buf.length) {
    for (let i = i0; i < i1; i++) buf[i] = this.tick(buf[i]);
    return buf;
  }
}

/** One-pole low-pass (coefficient from cutoff). */
export class OnePole {
  constructor(fc) {
    this.a = 1 - Math.exp((-TAU * fc) / SR);
    this.y = 0;
  }
  tick(x) {
    this.y += this.a * (x - this.y);
    return this.y;
  }
}

// ---------------------------------------------------------------- reverb (Freeverb topology, RT60-tuned)

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS = [556, 441, 341, 225];

/**
 * Stereo Schroeder/Freeverb reverb: 8 damped parallel combs + 4 series allpasses per channel, right bank
 * offset by 23 samples. Comb feedback is derived from `rt60` so the decay time is what the name says.
 * Input is high-passed and pre-delayed, output low-passed; `process` is wet-only and add-into.
 */
export class Reverb {
  constructor({ rt60 = 2.5, damp = 0.3, predelay = 0.02, size = 1.15, hp = 180, lp = 9000, level = 1 } = {}) {
    const sc = (SR / 44100) * size;
    this.banks = [0, 1].map((ch) => {
      const spread = ch * Math.round(23 * sc);
      return {
        combs: COMBS.map((d) => {
          const len = Math.round(d * sc) + spread;
          return { buf: new Float64Array(len), i: 0, fb: 10 ** ((-3 * len) / (rt60 * SR)), z: 0 };
        }),
        aps: ALLPASS.map((d) => ({ buf: new Float64Array(Math.round(d * sc) + spread), i: 0 })),
        lp: new OnePole(lp),
      };
    });
    this.damp = damp;
    this.pre = new Float64Array(Math.max(1, Math.round(predelay * SR)));
    this.pi = 0;
    this.hp = new Biquad('hp', hp, 0.707);
    this.gain = level * 0.11;
  }
  reset() {
    for (const b of this.banks) {
      for (const c of b.combs) { c.buf.fill(0); c.z = 0; c.i = 0; }
      for (const a of b.aps) { a.buf.fill(0); a.i = 0; }
      b.lp.y = 0;
    }
    this.pre.fill(0);
    this.hp.z1 = this.hp.z2 = 0;
  }
  /** Process samples [i0,i1) of (inL,inR) and ADD the wet signal into (outL,outR). */
  process(inL, inR, outL, outR, i0 = 0, i1 = inL.length) {
    const dmp = this.damp;
    const g = this.gain;
    const [bl, br] = this.banks;
    const pre = this.pre;
    const pl = pre.length;
    for (let n = i0; n < i1; n++) {
      const x0 = this.hp.tick((inL[n] + inR[n]) * 0.5);
      const x = pre[this.pi];
      pre[this.pi] = x0;
      if (++this.pi >= pl) this.pi = 0;
      let sl = 0;
      let sr = 0;
      for (let c = 0; c < 8; c++) {
        const a = bl.combs[c];
        let y = a.buf[a.i];
        a.z = y + (a.z - y) * dmp;
        a.buf[a.i] = x + a.z * a.fb;
        if (++a.i >= a.buf.length) a.i = 0;
        sl += y;
        const b = br.combs[c];
        y = b.buf[b.i];
        b.z = y + (b.z - y) * dmp;
        b.buf[b.i] = x + b.z * b.fb;
        if (++b.i >= b.buf.length) b.i = 0;
        sr += y;
      }
      for (let p = 0; p < 4; p++) {
        let ap = bl.aps[p];
        let d = ap.buf[ap.i];
        let w = sl + 0.5 * d;
        sl = d - 0.5 * w;
        ap.buf[ap.i] = w;
        if (++ap.i >= ap.buf.length) ap.i = 0;
        ap = br.aps[p];
        d = ap.buf[ap.i];
        w = sr + 0.5 * d;
        sr = d - 0.5 * w;
        ap.buf[ap.i] = w;
        if (++ap.i >= ap.buf.length) ap.i = 0;
      }
      outL[n] += bl.lp.tick(sl) * g;
      outR[n] += br.lp.tick(sr) * g;
    }
  }
}

// ---------------------------------------------------------------- ping-pong delay

/** Tempo-synced ping-pong delay; input is mono-summed, echoes alternate L/R, feedback is band-limited. */
export class PingPong {
  constructor({ time = 0.375, feedback = 0.5, lp = 4200, hp = 280 } = {}) {
    this.len = Math.round(time * SR);
    this.bl = new Float64Array(this.len);
    this.br = new Float64Array(this.len);
    this.i = 0;
    this.fb = feedback;
    this.lpL = new OnePole(lp);
    this.lpR = new OnePole(lp);
    this.hpL = new Biquad('hp', hp, 0.707);
    this.hpR = new Biquad('hp', hp, 0.707);
  }
  reset() {
    this.bl.fill(0);
    this.br.fill(0);
    this.lpL.y = this.lpR.y = 0;
    this.hpL.z1 = this.hpL.z2 = this.hpR.z1 = this.hpR.z2 = 0;
  }
  /** ADD echoes of samples [i0,i1) into (outL,outR). Feedback may be a function of time (sec). */
  process(inL, inR, outL, outR, i0 = 0, i1 = inL.length, fbFn = null) {
    const { bl, br, len } = this;
    let i = this.i;
    for (let n = i0; n < i1; n++) {
      const fb = fbFn ? fbFn(n / SR) : this.fb;
      const yl = bl[i];
      const yr = br[i];
      const x = (inL[n] + inR[n]) * 0.5;
      const fr = this.hpR.tick(this.lpR.tick(yr));
      const fl = this.hpL.tick(this.lpL.tick(yl));
      bl[i] = x + fb * fr;
      br[i] = fb * fl;
      outL[n] += yl;
      outR[n] += yr;
      if (++i >= len) i = 0;
    }
    this.i = i;
  }
}

// ---------------------------------------------------------------- master-bus tools

export const softClip = (x, a = 0.6) => {
  const s = x < 0 ? -x : x;
  if (s <= a) return x;
  const y = a + (1 - a) * Math.tanh((s - a) / (1 - a));
  return x < 0 ? -y : y;
};

/** Windowed-sinc 4× interpolation taps for true-peak detection (phases 1..3 of 4), Kaiser β=7.5. */
const TP_HALF = 16;
const bessel0 = (x) => {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 40; k++) {
    term *= (x / (2 * k)) ** 2;
    sum += term;
  }
  return sum;
};
const TP_TAPS = [1, 2, 3].map((p) => {
  const frac = p / 4;
  const beta = 7.5;
  const norm = bessel0(beta);
  const c = new Float64Array(2 * TP_HALF);
  for (let j = 0; j < 2 * TP_HALF; j++) {
    const x = frac - (j - (TP_HALF - 1)); // distance from tap to the interpolation point
    const t = x / TP_HALF;
    const win = Math.abs(t) < 1 ? bessel0(beta * Math.sqrt(1 - t * t)) / norm : 0;
    c[j] = (Math.sin(Math.PI * x) / (Math.PI * x)) * win;
  }
  return c;
});

/** Per-sample true-peak magnitude estimate (max over 4× interpolated points in [n, n+1)). */
export function truePeakEnv(L, R) {
  const n = L.length;
  const env = new Float32Array(n);
  for (const ch of [L, R]) {
    for (let i = 0; i < n; i++) {
      let m = Math.abs(ch[i]);
      if (i >= TP_HALF && i < n - TP_HALF) {
        for (let p = 0; p < 3; p++) {
          const c = TP_TAPS[p];
          let s = 0;
          const base = i - (TP_HALF - 1);
          for (let j = 0; j < 2 * TP_HALF; j++) s += ch[base + j] * c[j];
          if (s < 0) s = -s;
          if (s > m) m = s;
        }
      }
      if (m > env[i]) env[i] = m;
    }
  }
  return env;
}

/**
 * Lookahead brick-wall limiter driven by the true-peak envelope. Gain = boxcar-smoothed sliding minimum of the
 * required gain (so it is already down when the peak arrives), then a one-sided exponential release.
 * Works in place; returns { maxGR (dB), grAt (s) }.
 */
export function limit(L, R, ceilingDb = -1.3, { attackMs = 3, releaseMs = 90 } = {}) {
  const n = L.length;
  const ceil = db(ceilingDb);
  const tp = truePeakEnv(L, R);
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) req[i] = tp[i] > ceil ? ceil / tp[i] : 1;
  const W = Math.max(1, Math.round((attackMs / 1000) * SR));
  // sliding minimum over [i-W, i+W] (monotonic deque)
  const mn = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0;
  let t = 0;
  for (let i = 0; i < n + W; i++) {
    if (i < n) {
      while (t > h && req[dq[t - 1]] >= req[i]) t--;
      dq[t++] = i;
    }
    const c = i - W;
    if (c >= 0) {
      while (dq[h] < c - W) h++;
      mn[c] = req[dq[h]];
    }
  }
  // boxcar mean over [i-W, i+W]
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + mn[i];
  const rel = 1 - Math.exp(-1 / ((releaseMs / 1000) * SR));
  let y = 1;
  let maxGR = 0;
  let grAt = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - W);
    const b = Math.min(n - 1, i + W);
    const g = (pre[b + 1] - pre[a]) / (b - a + 1);
    y = Math.min(g, y + (1 - y) * rel);
    L[i] *= y;
    R[i] *= y;
    const gr = -todb(y);
    if (gr > maxGR) {
      maxGR = gr;
      grAt = i / SR;
    }
  }
  return { maxGR, grAt };
}

// ---------------------------------------------------------------- loudness (ITU-R BS.1770-4 / EBU R128)

function kWeights() {
  // stage 1: high shelf, stage 2: RLB high-pass (coefficients computed for any sample rate)
  const f0 = 1681.974450955533;
  const Q = 0.7071752369554196;
  const G = 3.999843853973347;
  let K = Math.tan((Math.PI * f0) / SR);
  const Vh = 10 ** (G / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const s1 = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  const f1 = 38.13547087602444;
  const Q2 = 0.5003270373238773;
  K = Math.tan((Math.PI * f1) / SR);
  a0 = 1 + K / Q2 + K * K;
  const s2 = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q2 + K * K) / a0 };
  return [s1, s2];
}

function kFilter(x) {
  const out = new Float64Array(x.length);
  const [s1, s2] = kWeights();
  let z11 = 0, z12 = 0, z21 = 0, z22 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    let y = s1.b0 * v + z11;
    z11 = s1.b1 * v - s1.a1 * y + z12;
    z12 = s1.b2 * v - s1.a2 * y;
    const w = y;
    y = s2.b0 * w + z21;
    z21 = s2.b1 * w - s2.a1 * y + z22;
    z22 = s2.b2 * w - s2.a2 * y;
    out[i] = y;
  }
  return out;
}

/** Mean-square (per 100 ms hop prefix sums) of K-weighted L+R, for block loudness. */
export function loudnessMeter(L, R) {
  const kl = kFilter(L);
  const kr = kFilter(R);
  const hop = SR / 10;
  const nh = Math.floor(L.length / hop);
  const hops = new Float64Array(nh);
  for (let h = 0; h < nh; h++) {
    let s = 0;
    for (let i = h * hop; i < (h + 1) * hop; i++) s += kl[i] * kl[i] + kr[i] * kr[i];
    hops[h] = s / hop;
  }
  const lufs = (ms) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-14));
  /** loudness of a window made of `len` hops starting at hop h */
  const win = (h, len) => {
    let s = 0;
    for (let k = 0; k < len; k++) s += hops[h + k];
    return s / len;
  };
  return {
    hops,
    /** gated integrated loudness (LUFS) */
    integrated() {
      const blocks = [];
      for (let h = 0; h + 4 <= nh; h++) blocks.push(win(h, 4));
      const abs = blocks.filter((b) => lufs(b) > -70);
      if (!abs.length) return -Infinity;
      const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
      const rel = lufs(mean) - 10;
      const keep = abs.filter((b) => lufs(b) > rel);
      return lufs(keep.reduce((a, b) => a + b, 0) / keep.length);
    },
    /** short-term (3 s) loudness at the window ending at t seconds */
    shortTerm(t) {
      const h1 = Math.min(nh, Math.round(t * 10));
      const h0 = Math.max(0, h1 - 30);
      return lufs(win(h0, Math.max(1, h1 - h0)));
    },
    /** loudness of the mean energy between two times */
    range(t0, t1) {
      const h0 = Math.max(0, Math.round(t0 * 10));
      const h1 = Math.min(nh, Math.round(t1 * 10));
      return lufs(win(h0, Math.max(1, h1 - h0)));
    },
  };
}

// ---------------------------------------------------------------- WAV I/O

export function writeWav(file, chans, { bits = 24, sampleRate = SR } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const nch = chans.length;
  const n = chans[0].length;
  const bps = bits / 8;
  const dataBytes = n * nch * bps;
  const float = bits === 32;
  const hdr = Buffer.alloc(float ? 58 : 44);
  let o = 0;
  const w32 = (v) => { hdr.writeUInt32LE(v, o); o += 4; };
  const w16 = (v) => { hdr.writeUInt16LE(v, o); o += 2; };
  hdr.write('RIFF', o); o += 4;
  w32(hdr.length - 8 + dataBytes);
  hdr.write('WAVE', o); o += 4;
  hdr.write('fmt ', o); o += 4;
  w32(float ? 18 : 16);
  w16(float ? 3 : 1);
  w16(nch);
  w32(sampleRate);
  w32(sampleRate * nch * bps);
  w16(nch * bps);
  w16(bits);
  if (float) {
    w16(0);
    hdr.write('fact', o); o += 4;
    w32(4);
    w32(n);
  }
  hdr.write('data', o); o += 4;
  w32(dataBytes);
  const data = Buffer.allocUnsafe(dataBytes);
  let p = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      const x = chans[c][i];
      if (float) {
        data.writeFloatLE(x, p);
      } else if (bits === 24) {
        const v = Math.round(clamp(x, -1, 1) * 8388607);
        data[p] = v & 255;
        data[p + 1] = (v >> 8) & 255;
        data[p + 2] = (v >> 16) & 255;
      } else {
        data.writeInt16LE(Math.round(clamp(x, -1, 1) * 32767), p);
      }
      p += bps;
    }
  }
  fs.writeFileSync(file, Buffer.concat([hdr, data]));
}

/** Minimal WAV reader (PCM 16/24, float32) → { rate, chans: Float32Array[] } */
export function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12;
  let fmt = null;
  let data = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') { data = b.subarray(o + 8, o + 8 + Math.min(sz, b.length - o - 8)); break; }
    o += 8 + sz + (sz & 1);
  }
  const bps = fmt.bits / 8;
  const n = Math.floor(data.length / (bps * fmt.ch));
  const chans = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const p = (i * fmt.ch + c) * bps;
      chans[c][i] = fmt.tag === 3 ? data.readFloatLE(p) : fmt.bits === 24 ? data.readIntLE(p, 3) / 8388608 : data.readInt16LE(p) / 32768;
    }
  }
  return { rate: fmt.rate, chans };
}
