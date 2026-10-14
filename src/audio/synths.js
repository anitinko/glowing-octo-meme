// Tonal voices: bass (sub + filtered saw), sub drone, polyBLEP supersaw pad, arp pluck, lead.
// All use polyBLEP oscillators, ≥2 ms ramps, and write into a Bus at an absolute time.
import { SR, TAU, Noise, SVF, Biquad, seedOf, span, tail, attack, ms, pan, cosRamp, mtof, sawBL, sqrBL } from './dsp.js';

const A2 = ms(0.002);

/** Offbeat bass note: saturated sine sub + plucky low-passed saw (resonant, decaying cutoff). */
export function bassNote(bus, t0, midi, dur, vel = 1, o = {}) {
  const f = mtof(midi);
  const rel = o.rel ?? 0.04;
  const w = span(t0, dur + rel);
  if (!w) return;
  const { i, n } = w;
  const kRel = Math.round(dur * SR);
  const nRel = ms(rel);
  const att = ms(0.003);
  const dt = f / SR;
  const sat = o.sat ?? 1.5;
  const norm = 1 / Math.tanh(sat);
  const cutBase = o.cut ?? 330;
  const cutMod = o.mod ?? 1700;
  const tauC = o.tauC ?? 0.1;
  const lp = new SVF();
  const hp = new Biquad('hp', Math.max(95, f * 1.6), 0.707);
  const subG = o.sub ?? 0.5;
  const sawG = o.saw ?? 0.28;
  let phS = 0;
  let phA = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = attack(k, att) * (k < kRel ? 1 : cosRamp(1 - (k - kRel) / nRel));
    phS += (TAU * f) / SR;
    const sub = Math.tanh(sat * Math.sin(phS)) * norm;
    phA += dt;
    if (phA >= 1) phA -= 1;
    if ((k & 15) === 0) lp.set(cutBase + cutMod * Math.exp(-t / tauC), o.q ?? 1.3);
    const mid = hp.tick(lp.tick(sawBL(phA, dt)));
    const y = (sub * subG + mid * sawG) * env * vel * tail(k, n);
    bus.l[i + k] += y;
    bus.r[i + k] += y;
  }
}

/** Sine drone / sub with optional slow swell (attPow), exponential decay (tau) and saturation. */
export function subTone(bus, t0, dur, midi, o = {}) {
  const f = mtof(midi);
  const rel = o.rel ?? 0.3;
  const w = span(t0, dur + rel);
  if (!w) return;
  const { i, n } = w;
  const nAtt = Math.max(A2, ms(o.att ?? 0.05));
  const kRel = Math.round(dur * SR);
  const nRel = ms(rel);
  const sat = o.sat ?? 1.3;
  const norm = 1 / Math.tanh(sat);
  const lvl = o.level ?? 0.4;
  const tau = o.tau ?? 0;
  const pw = o.attPow ?? 1;
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const a = k < nAtt ? Math.pow(0.5 - 0.5 * Math.cos((Math.PI * k) / nAtt), pw) : 1;
    const r = k < kRel ? 1 : cosRamp(1 - (k - kRel) / nRel);
    const d = tau ? Math.exp(-k / (tau * SR)) : 1;
    ph += (TAU * f) / SR;
    const y = Math.tanh(sat * Math.sin(ph)) * norm * a * r * d * lvl * tail(k, n);
    bus.l[i + k] += y;
    bus.r[i + k] += y;
  }
}

const UNISON = {
  7: { cents: [-19, -12, -6, 0, 6, 12, 19], pan: [-0.95, -0.6, -0.3, 0, 0.3, 0.6, 0.95], w: [0.8, 0.9, 1, 1, 1, 0.9, 0.8] },
  5: { cents: [-16, -8, 0, 8, 16], pan: [-0.9, -0.5, 0, 0.5, 0.9], w: [0.85, 1, 1, 1, 0.85] },
  3: { cents: [-10, 0, 10], pan: [-0.8, 0, 0.8], w: [0.9, 1, 0.9] },
};

/**
 * Supersaw pad chord. Each note is a detuned polyBLEP unison (slowly drifting detune, alternating stereo
 * mirror per note). The pad is NOT filtered here: the bus gets one shared, automated low-pass afterwards.
 *   o.att/o.attPow  attack length and curve (slow swells)       o.rel  release
 *   o.g0 → o.g1     linear gain ramp across the note (builds)    o.tau/o.hold  exponential decay after hold
 *   o.voices(i)     unison size per note index (3|5|7)
 */
export function padChord(bus, t0, dur, notes, o = {}) {
  const rel = o.rel ?? 0.3;
  const w = span(t0, dur + rel);
  if (!w) return;
  const { i, n } = w;
  const nAtt = Math.max(A2, ms(o.att ?? 0.12));
  const attPow = o.attPow ?? 1;
  const kRel = Math.round(dur * SR);
  const nRel = ms(rel);
  const g0 = o.g0 ?? 1;
  const g1 = o.g1 ?? 1;
  const tau = o.tau ?? 0;
  const hold = Math.round((o.hold ?? 0) * SR);
  const gain = o.gain ?? 1;
  const rnd = new Noise(seedOf(t0, 5));

  const base = [];
  notes.forEach((m, ni) => {
    const u = UNISON[(o.voices ? o.voices(ni, notes.length) : ni === 0 || ni === 1 ? 5 : ni === notes.length - 1 ? 5 : 7)];
    const flip = ni % 2 ? -1 : 1;
    const nW = u.w.reduce((a, b) => a + b * b, 0);
    u.cents.forEach((c, j) => {
      const [gl, gr] = pan(u.pan[j] * flip);
      const amp = (u.w[j] / Math.sqrt(nW)) * (ni === notes.length - 1 ? 0.7 : 1);
      base.push({
        f: mtof(m),
        c,
        gl: gl * amp,
        gr: gr * amp,
        ph: rnd.rand(),
        lfo: rnd.rand(),
        lfoRate: 0.08 + 0.24 * rnd.rand(),
      });
    });
  });
  const M = base.length;
  const ph = new Float64Array(M);
  const dts = new Float64Array(M);
  const gl = new Float64Array(M);
  const gr = new Float64Array(M);
  base.forEach((b, j) => {
    ph[j] = b.ph;
    gl[j] = b.gl;
    gr[j] = b.gr;
  });
  const norm = 0.125 * gain;
  for (let k = 0; k < n; k++) {
    if ((k & 63) === 0) {
      const t = k / SR;
      for (let j = 0; j < M; j++) {
        const b = base[j];
        dts[j] = (b.f * Math.pow(2, (b.c + 2.5 * Math.sin(TAU * (b.lfo + b.lfoRate * t))) / 1200)) / SR;
      }
    }
    let sl = 0;
    let sr = 0;
    for (let j = 0; j < M; j++) {
      const d = dts[j];
      let p = ph[j] + d;
      if (p >= 1) p -= 1;
      ph[j] = p;
      let v = 2 * p - 1;
      if (p < d) {
        const u = p / d;
        v -= u + u - u * u - 1;
      } else if (p > 1 - d) {
        const u = (p - 1) / d;
        v -= u * u + u + u + 1;
      }
      sl += v * gl[j];
      sr += v * gr[j];
    }
    const a = k < nAtt ? Math.pow(0.5 - 0.5 * Math.cos((Math.PI * k) / nAtt), attPow) : 1;
    const r = k < kRel ? 1 : cosRamp(1 - (k - kRel) / nRel);
    const gk = g0 + (g1 - g0) * Math.min(1, k / Math.max(1, kRel));
    const d = tau && k > hold ? Math.exp(-(k - hold) / (tau * SR)) : 1;
    const e = a * r * gk * d * norm * tail(k, n);
    bus.l[i + k] += sl * e;
    bus.r[i + k] += sr * e;
  }
}

/** Arp pluck: two detuned saws + a square through a resonant low-pass whose cutoff snaps down (pluck). */
export function pluck(bus, t0, midi, vel = 1, o = {}) {
  const f = mtof(midi);
  const tauA = o.tau ?? 0.105;
  const w = span(t0, o.len ?? Math.max(0.3, tauA * 5));
  if (!w) return;
  const { i, n } = w;
  const [gl, gr] = pan(o.pan ?? 0);
  const cutBase = o.cutBase ?? Math.max(1100, f * 2.4);
  const cutPeak = (o.cutPeak ?? 6200) * (0.55 + 0.45 * vel);
  const tauC = o.tauC ?? 0.07;
  const sqG = o.square ?? 0.35;
  const dA = (f * Math.pow(2, 5 / 1200)) / SR;
  const dB = (f * Math.pow(2, -5 / 1200)) / SR;
  const dC = f / SR;
  const lp = new SVF();
  const lp2 = new SVF();
  let pA = 0.13;
  let pB = 0.71;
  let pC = 0.4;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if ((k & 7) === 0) {
      const fc = cutBase + (cutPeak - cutBase) * Math.exp(-t / tauC);
      lp.set(fc, o.q ?? 1.2);
      lp2.set(fc * 1.3, 0.707);
    }
    pA += dA; if (pA >= 1) pA -= 1;
    pB += dB; if (pB >= 1) pB -= 1;
    pC += dC; if (pC >= 1) pC -= 1;
    const x = sawBL(pA, dA) * 0.5 + sawBL(pB, dB) * 0.5 + sqrBL(pC, dC, 0.5) * sqG;
    const y = lp2.tick(lp.tick(x)) * attack(k, A2) * Math.exp(-t / tauA) * vel * 0.48 * tail(k, n);
    bus.l[i + k] += y * gl;
    bus.r[i + k] += y * gr;
  }
}

/**
 * Lead: detuned saw pair (stereo) + sub-octave square + quiet octave-up saw, delayed vibrato, and a filter that
 * opens briefly on every note.
 */
export function leadNote(bus, t0, midi, dur, vel = 1, o = {}) {
  const f = mtof(midi);
  const rel = o.rel ?? 0.09;
  const w = span(t0, dur + rel);
  if (!w) return;
  const { i, n } = w;
  const kRel = Math.round(dur * SR);
  const nRel = ms(rel);
  const att = ms(0.006);
  const [aL, aR] = pan(-0.4);
  const [bL, bR] = pan(0.4);
  const lpL = new SVF();
  const lpR = new SVF();
  const rnd = new Noise(seedOf(t0, midi));
  let pA = rnd.rand();
  let pB = rnd.rand();
  let pS = 0;
  let pO = rnd.rand();
  let vph = 0;
  const vibD = o.vib ?? 11;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const vd = vibD * cosRamp((t - 0.15) / 0.3);
    vph += (TAU * 5.3) / SR;
    const m = Math.pow(2, (vd * Math.sin(vph)) / 1200);
    const dA = (f * m * Math.pow(2, 7 / 1200)) / SR;
    const dB = (f * m * Math.pow(2, -7 / 1200)) / SR;
    const dS = (f * m * 0.5) / SR;
    const dO = (f * m * 2) / SR;
    pA += dA; if (pA >= 1) pA -= 1;
    pB += dB; if (pB >= 1) pB -= 1;
    pS += dS; if (pS >= 1) pS -= 1;
    pO += dO; if (pO >= 1) pO -= 1;
    if ((k & 15) === 0) {
      const fc = (o.cut ?? 2600) + 3400 * Math.exp(-t / 0.3);
      lpL.set(fc, 1.1);
      lpR.set(fc, 1.1);
    }
    const sa = sawBL(pA, dA) * 0.5;
    const sb = sawBL(pB, dB) * 0.5;
    const mid = sqrBL(pS, dS, 0.5) * 0.28 + sawBL(pO, dO) * (o.octUp ?? 0.14);
    const env = attack(k, att) * (k < kRel ? 1 : cosRamp(1 - (k - kRel) / nRel)) * vel * 0.32 * tail(k, n);
    bus.l[i + k] += lpL.tick(sa * aL + sb * bL + mid) * env;
    bus.r[i + k] += lpR.tick(sa * aR + sb * bR + mid) * env;
  }
}
