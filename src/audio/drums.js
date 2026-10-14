// Percussion, cymbals, risers and impacts. Every voice writes into a Bus at an absolute time, uses ≥2 ms
// ramps, is seeded from its start time (deterministic) and is truncated at the pre-drop silence gap.
import { SR, TAU, Noise, SVF, Biquad, seedOf, span, tail, attack, ms, pan, cosRamp, clamp, lerp, sawBL, mtof } from './dsp.js';

const A2 = ms(0.002);

function put(bus, i, k, l, r) {
  bus.l[i + k] += l;
  bus.r[i + k] += r;
}

/** Add stereo arrays at time t0 (with gap truncation + fade), optionally reversed to END at t0 + len. */
export function addArrays(bus, t0, L, R, gain = 1) {
  const w = span(t0, L.length / SR);
  if (!w) return;
  for (let k = 0; k < w.n; k++) put(bus, w.i, k, L[k] * gain * tail(k, w.n), R[k] * gain * tail(k, w.n));
}

// ---------------------------------------------------------------- kick

/** Sine kick: 172→46 Hz pitch sweep, soft-saturated, with a short beater click. */
export function kick(bus, t0, vel = 1, o = {}) {
  const w = span(t0, o.len ?? 0.44);
  if (!w) return;
  const { i, n } = w;
  const f0 = o.f0 ?? 172;
  const f1 = o.f1 ?? 46;
  const tauF = o.tauF ?? 0.026;
  const tauA = o.tauA ?? 0.125;
  const drive = o.drive ?? 1.7;
  const click = (o.click ?? 0.3) * vel;
  const norm = 1 / Math.tanh(drive);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t / tauF))) / SR;
    const at = attack(k, A2);
    const body = Math.tanh(drive * Math.sin(ph) * at * Math.exp(-t / tauA)) * norm;
    const c = (Math.sin(TAU * 2100 * t) * 0.6 + Math.sin(TAU * 3700 * t) * 0.4) * Math.exp(-t / 0.0022) * at;
    const y = (body * vel + click * c) * 0.84 * tail(k, n);
    put(bus, i, k, y, y);
  }
}

// ---------------------------------------------------------------- snare / clap / toms

/** 4-burst clap + decaying tail; decorrelated L/R noise through two band-passes. */
export function clap(bus, t0, vel = 1, o = {}) {
  const w = span(t0, 0.42);
  if (!w) return;
  const { i, n } = w;
  const nzL = new Noise(seedOf(t0, 11));
  const nzR = new Noise(seedOf(t0, 12));
  const common = new Noise(seedOf(t0, 19));
  const aL = new SVF(), bL = new SVF(), aR = new SVF(), bR = new SVF();
  for (const f of [aL, aR]) f.set(1350, 1.0);
  for (const f of [bL, bR]) f.set(3100, 0.9);
  const bursts = [0, 0.0105, 0.0215];
  const amps = [0.75, 0.85, 1.0];
  const tailAt = 0.0325;
  const tauT = o.tau ?? 0.085;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let e = 0;
    for (let b = 0; b < 3; b++) {
      const d = t - bursts[b];
      if (d >= 0) e += amps[b] * (d < 0.002 ? cosRamp(d / 0.002) : 1) * Math.exp(-d / 0.0045);
    }
    const dt = t - tailAt;
    if (dt >= 0) e += 1.15 * (dt < 0.002 ? cosRamp(dt / 0.002) : 1) * Math.exp(-dt / tauT);
    const cm = common.next() * 0.3;
    const xl = nzL.next() * 0.7 + cm;
    const xr = nzR.next() * 0.7 + cm;
    aL.tick(xl); bL.tick(xl); aR.tick(xr); bR.tick(xr);
    const g = e * vel * 1.05 * tail(k, n);
    put(bus, i, k, (aL.bp * 1.1 + bL.bp * 0.55) * g, (aR.bp * 1.1 + bR.bp * 0.55) * g);
  }
}

/** Snare: pitched body + band-passed noise. `tone` (Hz) and `bright` allow the roll to climb in pitch. */
export function snare(bus, t0, vel = 1, o = {}) {
  const w = span(t0, o.len ?? 0.3);
  if (!w) return;
  const { i, n } = w;
  const tone = o.tone ?? 190;
  const bright = o.bright ?? 1;
  const nzA = new Noise(seedOf(t0, 31));
  const nzB = new Noise(seedOf(t0, 32));
  const fa = new SVF();
  const fb = new SVF();
  fa.set(2800 * bright, 0.7);
  fb.set(7000, 0.7);
  let ph = 0;
  const tauN = o.tauN ?? 0.075;
  const tauB = o.tauB ?? 0.055;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * tone * (1 + 0.5 * Math.exp(-t / 0.012))) / SR;
    const at = attack(k, A2);
    const body = Math.sin(ph) * Math.exp(-t / tauB) * 0.75;
    const x = nzA.next();
    fa.tick(x);
    fb.tick(nzB.next());
    const noise = (fa.bp * 1.15 + fb.hp * 0.3) * Math.exp(-t / tauN);
    const y = (body + noise * 0.85) * at * vel * 0.45 * tail(k, n);
    put(bus, i, k, y, y);
  }
}

/** Pitched tom / stab: sine with a quick downward sweep and a soft attack knock. */
export function tom(bus, t0, f = 180, vel = 1, o = {}) {
  const w = span(t0, o.len ?? 0.45);
  if (!w) return;
  const { i, n } = w;
  const tauA = o.tauA ?? 0.14;
  const [gl, gr] = pan(o.pan ?? 0);
  const nz = new Noise(seedOf(t0, f));
  const sv = new SVF();
  sv.set(f * 6, 1.2);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * f * (1 + 0.55 * Math.exp(-t / 0.035))) / SR;
    const at = attack(k, A2);
    sv.tick(nz.next());
    const body = Math.tanh(1.4 * Math.sin(ph)) * Math.exp(-t / tauA);
    const knock = sv.bp * Math.exp(-t / 0.006) * 0.45;
    const y = (body * 0.85 + knock) * at * vel * 1.1 * tail(k, n);
    put(bus, i, k, y * gl, y * gr);
  }
}

// ---------------------------------------------------------------- hats / shaker / small percussion

const METAL = [1, 1.4834, 1.7993, 2.5463, 2.6307, 3.8975];

/** Closed / open hat: high-passed noise + six polyBLEP squares (808-style metal). */
export function hat(bus, t0, vel = 1, o = {}) {
  const open = !!o.open;
  const w = span(t0, o.len ?? (open ? 0.3 : 0.11));
  if (!w) return;
  const { i, n } = w;
  const [gl, gr] = pan(o.pan ?? 0);
  const nz = new Noise(seedOf(t0, open ? 41 : 42));
  const h1 = new SVF();
  const h2 = new SVF();
  const bp = new SVF();
  h1.set(7200, 0.707);
  h2.set(7200, 0.707);
  bp.set(10500, 1.1);
  const base = o.base ?? 2050;
  const dts = METAL.map((m) => (base * m) / SR);
  const phs = METAL.map((_, j) => (j * 0.37) % 1);
  const tau1 = open ? 0.055 : 0.017;
  const tau2 = open ? 0.16 : 0.03;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let metal = 0;
    for (let j = 0; j < 6; j++) {
      let p = phs[j] + dts[j];
      if (p >= 1) p -= 1;
      phs[j] = p;
      const d = dts[j];
      let v = p < 0.5 ? 1 : -1;
      if (p < d) { const u = p / d; v += u + u - u * u - 1; }
      else if (p > 1 - d) { const u = (p - 1) / d; v += u * u + u + u + 1; }
      let p2 = p + 0.5;
      if (p2 >= 1) p2 -= 1;
      if (p2 < d) { const u = p2 / d; v -= u + u - u * u - 1; }
      else if (p2 > 1 - d) { const u = (p2 - 1) / d; v -= u * u + u + u + 1; }
      metal += v;
    }
    h1.tick(nz.next() * 0.8 + metal * 0.05);
    h2.tick(h1.hp);
    bp.tick(h2.hp);
    const x = h2.hp * 0.8 + bp.bp * 0.35;
    const env = open ? 0.55 * Math.exp(-t / tau1) + 0.45 * Math.exp(-t / tau2) : Math.exp(-t / tau1);
    const y = x * env * attack(k, A2) * vel * 0.55 * tail(k, n);
    put(bus, i, k, y * gl, y * gr);
  }
}

/** 16th-note shaker: soft band-passed noise, 5 ms swell. */
export function shaker(bus, t0, vel = 1, o = {}) {
  const w = span(t0, 0.12);
  if (!w) return;
  const { i, n } = w;
  const [gl, gr] = pan(o.pan ?? 0);
  const nz = new Noise(seedOf(t0, 51));
  const f = new SVF();
  const hp = new SVF();
  f.set(7000, 0.8);
  hp.set(3800, 0.707);
  const att = ms(0.005);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = nz.next();
    f.tick(x);
    hp.tick(f.bp);
    const y = hp.hp * attack(k, att) * Math.exp(-t / 0.032) * vel * 0.5 * tail(k, n);
    put(bus, i, k, y * gl, y * gr);
  }
}

/** Rim / clave tick or conga-ish hit for groove variation. */
export function perc(bus, t0, kind = 'rim', vel = 1, o = {}) {
  const w = span(t0, kind === 'conga' ? 0.3 : 0.09);
  if (!w) return;
  const { i, n } = w;
  const [gl, gr] = pan(o.pan ?? 0);
  const nz = new Noise(seedOf(t0, 61));
  const sv = new SVF();
  sv.set(kind === 'conga' ? 1800 : 3300, 1.4);
  const f = o.f ?? (kind === 'conga' ? 330 : 1650);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const at = attack(k, A2);
    sv.tick(nz.next());
    let y;
    if (kind === 'conga') {
      ph += (TAU * f * (1 + 0.28 * Math.exp(-t / 0.018))) / SR;
      y = (Math.sin(ph) * Math.exp(-t / 0.085) * 0.9 + sv.bp * Math.exp(-t / 0.006) * 0.3) * at;
    } else {
      ph += (TAU * f) / SR;
      y = (Math.sin(ph) * Math.exp(-t / 0.011) * 0.7 + Math.sin(ph * 0.29) * Math.exp(-t / 0.02) * 0.4 + sv.bp * Math.exp(-t / 0.004) * 0.35) * at;
    }
    y *= vel * 0.52 * tail(k, n);
    put(bus, i, k, y * gl, y * gr);
  }
}

// ---------------------------------------------------------------- cymbals

/** Crash cymbal as arrays: stereo noise darkening over time + inharmonic ring partials. */
export function makeCrash(len = 3.4, seed = 1, o = {}) {
  const n = Math.round(len * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const tau2 = o.tau2 ?? 1.0;
  const partials = [3130, 4287, 5359, 6551, 7783, 8942, 10211, 11437, 2477, 5870];
  const att = ms(0.003);
  [L, R].forEach((out, c) => {
    const nz = new Noise(seedOf(seed, c));
    const h1 = new SVF();
    const h2 = new SVF();
    const lp = new SVF();
    const body = new SVF();
    h1.set(2300, 0.707);
    h2.set(2300, 0.707);
    body.set(1100, 0.8);
    const ph = partials.map((_, j) => new Noise(seedOf(seed, 100 + j + c * 17)).rand());
    const dts = partials.map((f, j) => (f * (1 + 0.004 * (c ? 1 : -1) * (j % 3))) / SR);
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      if ((k & 31) === 0) lp.set(5500 + 11000 * Math.exp(-t / 1.4), 0.6);
      const x = nz.next();
      h1.tick(x);
      h2.tick(h1.hp);
      body.tick(x);
      let ring = 0;
      for (let j = 0; j < 10; j++) {
        ph[j] += dts[j];
        if (ph[j] >= 1) ph[j] -= 1;
        ring += Math.sin(TAU * ph[j]) * Math.exp(-t / (0.9 - j * 0.04));
      }
      const z = lp.tick(h2.hp + body.bp * 0.22 * Math.exp(-t / 0.35)) + ring * 0.03;
      const env = (0.55 * Math.exp(-t / 0.2) + 0.45 * Math.exp(-t / tau2)) * attack(k, att);
      out[k] = z * env * 0.37;
    }
  });
  return { L, R };
}

const crashCache = new Map();
function crashFor(len, seed, tau2) {
  const key = `${len}|${seed}|${tau2}`;
  if (!crashCache.has(key)) crashCache.set(key, makeCrash(len, seed, { tau2 }));
  return crashCache.get(key);
}

export function crash(bus, t0, vel = 1, o = {}) {
  const c = crashFor(o.len ?? 3.4, o.seed ?? 7, o.tau2 ?? 1.0);
  addArrays(bus, t0, c.L, c.R, vel);
}

/** Reverse-cymbal swell that ends exactly at tEnd (a crash played backwards, plus an extra crescendo). */
export function revCymbal(bus, tEnd, dur = 1.7, vel = 1) {
  const c = crashFor(3.4, 23, 1.2);
  const n = Math.round(dur * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const g = Math.pow(p, 1.4) * attack(n - 1 - k, ms(0.004));
    L[k] = c.L[n - 1 - k] * g;
    R[k] = c.R[n - 1 - k] * g;
  }
  addArrays(bus, tEnd - dur, L, R, vel);
}

// ---------------------------------------------------------------- risers

/**
 * Noise sweep (band-pass climbing 220 Hz → 11 kHz) over a rising two-saw tone, crescendo all the way to t0+dur
 * where it is cut. The tone travels exponentially from `from` to `to` (MIDI).
 */
export function riser(bus, t0, dur, o = {}) {
  const w = span(t0, dur);
  if (!w) return;
  const { i, n } = w;
  const nTot = Math.round(dur * SR);
  const lvl = o.level ?? 1;
  const fa = mtof(o.from ?? 57);
  const fb = mtof(o.to ?? 81);
  const nzL = new Noise(seedOf(t0, 71));
  const nzR = new Noise(seedOf(t0, 72));
  const bpL = new SVF(), bpR = new SVF(), hpL = new SVF(), hpR = new SVF(), lpTone = new SVF();
  let p1 = 0.1;
  let p2 = 0.6;
  for (let k = 0; k < n; k++) {
    const p = k / nTot;
    const f = fa * Math.pow(fb / fa, Math.pow(p, 1.7));
    if ((k & 15) === 0) {
      const fc = 220 * Math.pow(11000 / 220, Math.pow(p, 1.35));
      bpL.set(fc, 1.1); bpR.set(fc, 1.1);
      hpL.set(fc * 0.55, 0.707); hpR.set(fc * 0.55, 0.707);
      lpTone.set(Math.min(f * 3.2, 9000), 0.9);
    }
    const d1 = (f * 1.0035) / SR;
    const d2 = (f * 0.9965) / SR;
    p1 += d1; if (p1 >= 1) p1 -= 1;
    p2 += d2; if (p2 >= 1) p2 -= 1;
    const tone = lpTone.tick(sawBL(p1, d1) + sawBL(p2, d2)) * 0.057 * Math.pow(p, 2.2);
    const xl = nzL.next();
    const xr = nzR.next();
    bpL.tick(xl); hpL.tick(xl); bpR.tick(xr); hpR.tick(xr);
    const env = (0.03 + 0.97 * p * p) * attack(k, A2) * tail(k, n) * lvl;
    put(bus, i, k, ((bpL.bp * 0.9 + hpL.hp * 0.3 * p) * 0.29 + tone) * env, ((bpR.bp * 0.9 + hpR.hp * 0.3 * p) * 0.29 + tone) * env);
  }
}

// ---------------------------------------------------------------- impact pieces

/** Deep sub boom: pitch-dropping sine (110→34 Hz) with ~1.2 s decay and a short thud knock. */
export function boom(bus, t0, vel = 1, o = {}) {
  const w = span(t0, o.len ?? 1.8);
  if (!w) return;
  const { i, n } = w;
  const tauA = o.tauA ?? 0.38;
  const f0 = o.f0 ?? 112;
  const f1 = o.f1 ?? 34;
  let ph = 0;
  let ph2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.17))) / SR;
    ph2 += (TAU * (60 + 190 * Math.exp(-t / 0.03))) / SR;
    const at = attack(k, A2);
    const body = Math.tanh(1.5 * Math.sin(ph)) * Math.exp(-t / tauA);
    const knock = Math.sin(ph2) * Math.exp(-t / 0.045) * 0.5;
    const y = (body * 0.85 + knock) * at * vel * 0.7 * tail(k, n);
    put(bus, i, k, y, y);
  }
}

/** Noise burst whose low-pass falls from 9 kHz to 350 Hz — the part that feeds the long reverb. */
export function impactBurst(bus, t0, vel = 1) {
  const w = span(t0, 1.2);
  if (!w) return;
  const { i, n } = w;
  const nzL = new Noise(seedOf(t0, 81));
  const nzR = new Noise(seedOf(t0, 82));
  const hpL = new SVF(), hpR = new SVF(), lpL = new SVF(), lpR = new SVF();
  hpL.set(180, 0.707); hpR.set(180, 0.707);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if ((k & 15) === 0) {
      const fc = 350 + 8650 * Math.exp(-t / 0.22);
      lpL.set(fc, 0.8); lpR.set(fc, 0.8);
    }
    const env = Math.exp(-t / 0.2) * attack(k, A2) * vel * tail(k, n) * 0.5;
    hpL.tick(nzL.next()); hpR.tick(nzR.next());
    put(bus, i, k, lpL.tick(hpL.hp) * env, lpR.tick(hpR.hp) * env);
  }
}

/** Low rumble (noise through a ~95 Hz 4-pole low-pass) for cinematic weight under the boom. */
export function rumble(bus, t0, vel = 1, len = 2.4) {
  const w = span(t0, len);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(t0, 91));
  const a = new SVF();
  const b = new SVF();
  a.set(95, 0.707);
  b.set(95, 0.707);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const z = b.tick(a.tick(nz.next())) * 4.2;
    const env = Math.exp(-t / 0.8) * attack(k, ms(0.02)) * vel * tail(k, n);
    put(bus, i, k, z * env, z * env);
  }
}

/**
 * Accelerating snare roll over [t0, t0+dur): first half in 8ths, then 16ths, then 32nds (tempo-locked grid),
 * crescendo and rising pitch. Hits that would start inside the silence gap are skipped by `snare` itself.
 */
export function rollHits(t0, dur, beat = 0.5) {
  const a = beat / 2;
  const hits = [];
  let t = 0;
  while (t < dur - 1e-9) {
    const p = t / dur;
    hits.push({ t: t0 + t, p });
    t += p < 0.5 ? a : p < 0.75 ? a / 2 : a / 4;
  }
  return hits;
}

export function snareRoll(bus, t0, dur, vel = 1, beat = 0.5) {
  for (const h of rollHits(t0, dur, beat)) {
    const p = h.p;
    snare(bus, h.t, vel * (0.2 + 0.8 * Math.pow(p, 1.1)), {
      tone: 165 + 170 * p,
      bright: 1 + 0.7 * p,
      tauN: 0.06 - 0.025 * p,
      tauB: 0.05 - 0.02 * p,
      len: 0.2,
    });
  }
}
