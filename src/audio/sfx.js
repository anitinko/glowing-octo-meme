// Cue sound effects: one function per cue type, rendered at cue.t into the sfx buses.
// `ctx` carries the buses and the list of score elements already placed (for de-duplication).
import { SR, TAU, Noise, SVF, Biquad, seedOf, span, tail, attack, ms, pan, cosRamp, clamp, smooth, mtof, sawBL } from './dsp.js';
import { boom, impactBurst, rumble, crash, riser, snareRoll, tom } from './drums.js';

const A2 = ms(0.002);
const bell = (p) => Math.sin(Math.PI * clamp(p)) ** 2;

function put(bus, i, k, l, r) {
  bus.l[i + k] += l;
  bus.r[i + k] += r;
}

const near = (list, t, tol = 0.05) => list.some((x) => Math.abs(x - t) <= tol);
const nearSpan = (list, t, dur, tol = 0.05) => list.some((x) => Math.abs(x.t - t) <= tol || Math.abs(x.t + x.dur - (t + dur)) <= tol);

function key(ctx, c) {
  const v = c.v ?? 1;
  const w = span(c.t, 0.035);
  if (!w) return;
  const { i, n } = w;
  const r = new Noise(seedOf(c.t, 1));
  const pitch = 1 + 0.16 * r.next();
  const [gl, gr] = pan(0.25 * r.next());
  const bp = new SVF();
  bp.set(3300 * pitch, 1.8);
  const nz = new Noise(seedOf(c.t, 2));
  const f2 = 255 * (1 + 0.12 * r.next());
  const amp = 0.3 * (0.3 + 0.7 * clamp(v, 0, 1.2));
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    bp.tick(nz.next());
    const click = bp.bp * Math.exp(-t / 0.0017);
    const thock = Math.sin(TAU * f2 * t) * Math.exp(-t / 0.008) * 0.5;
    const y = (click + thock) * attack(k, A2) * amp * tail(k, n);
    put(ctx.sfx, i, k, y * gl, y * gr);
  }
}

function select(ctx, c) {
  const dur = 0.12;
  const w = span(c.t, dur + 0.02);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 3));
  const bp = new SVF();
  for (let k = 0; k < n; k++) {
    const p = k / (dur * SR);
    if ((k & 7) === 0) bp.set(1800 * Math.pow(3, clamp(p)), 1.6);
    bp.tick(nz.next());
    const y = bp.bp * bell(p) * 0.25 * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function del(ctx, c) {
  const w = span(c.t, 0.09);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 4));
  const bp = new SVF();
  bp.set(1900, 1.5);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * (70 + 80 * Math.exp(-t / 0.02))) / SR;
    bp.tick(nz.next());
    const y = (Math.sin(ph) * Math.exp(-t / 0.022) * 0.7 + bp.bp * Math.exp(-t / 0.003) * 0.4) * attack(k, A2) * 0.28 * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function blip(ctx, c) {
  const f = c.f ?? 1200;
  const v = c.v ?? 1;
  const w = span(c.t, 0.14);
  if (!w) return;
  const { i, n } = w;
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * f * (1 + 0.06 * Math.exp(-t / 0.03))) / SR;
    const y = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.exp(-t / 0.026) * attack(k, A2) * 0.2 * v * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function suck(ctx, c) {
  const dur = c.dur ?? 0.7;
  const w = span(c.t, dur);
  if (!w) return;
  const { i, n } = w;
  const nzL = new Noise(seedOf(c.t, 5));
  const nzR = new Noise(seedOf(c.t, 6));
  const bL = new SVF(), bR = new SVF();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const p = k / (dur * SR);
    if ((k & 7) === 0) {
      const fc = 450 * Math.pow(12, Math.pow(p, 1.5));
      bL.set(fc, 1.2);
      bR.set(fc, 1.2);
    }
    ph += (TAU * 260 * Math.pow(5, p * p)) / SR;
    bL.tick(nzL.next());
    bR.tick(nzR.next());
    const env = Math.pow(p, 2.2) * attack(k, A2) * tail(k, n);
    const tone = Math.sin(ph) * 0.05;
    put(ctx.sfx, i, k, (bL.bp * 0.26 + tone) * env, (bR.bp * 0.26 + tone) * env);
    put(ctx.sfxw, i, k, bL.bp * 0.1 * env, bR.bp * 0.1 * env);
  }
}

function pop(ctx, c) {
  const f = c.f ?? 700;
  const w = span(c.t, 0.2);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 7));
  const bp = new SVF();
  bp.set(f * 3, 1.5);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * f * (1.35 - 0.75 * Math.exp(-t / 0.012))) / SR;
    bp.tick(nz.next());
    const y = (Math.sin(ph) * Math.exp(-t / 0.04) + bp.bp * Math.exp(-t / 0.004) * 0.25) * attack(k, A2) * 0.22 * tail(k, n);
    put(ctx.sfx, i, k, y, y);
    put(ctx.sfxw, i, k, y * 0.25, y * 0.25);
  }
}

function tick(ctx, c) {
  const f = c.f ?? 2400;
  const v = c.v ?? 1;
  const w = span(c.t, 0.025);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 8));
  const bp = new SVF();
  bp.set(f, 3);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    bp.tick(nz.next());
    const y = (Math.sin(TAU * f * t) * Math.exp(-t / 0.0028) * 0.8 + bp.bp * Math.exp(-t / 0.002) * 0.3) * attack(k, A2) * 0.28 * v * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function swish(ctx, c) {
  const dur = 0.2;
  const w = span(c.t, dur + 0.03);
  if (!w) return;
  const { i, n } = w;
  const nzL = new Noise(seedOf(c.t, 9));
  const nzR = new Noise(seedOf(c.t, 10));
  const bL = new SVF(), bR = new SVF();
  for (let k = 0; k < n; k++) {
    const p = k / (dur * SR);
    if ((k & 7) === 0) {
      const fc = 1500 * Math.pow(4.3, clamp(p));
      bL.set(fc, 0.9);
      bR.set(fc, 0.9);
    }
    bL.tick(nzL.next());
    bR.tick(nzR.next());
    const e = bell(p) * 0.21 * tail(k, n);
    const [gl, gr] = pan(-0.35 + 0.7 * clamp(p));
    put(ctx.sfx, i, k, bL.bp * e * gl * 1.4, bR.bp * e * gr * 1.4);
    put(ctx.sfxw, i, k, bL.bp * e * 0.2, bR.bp * e * 0.2);
  }
}

function marker(ctx, c) {
  const dur = c.dur ?? 0.3;
  const w = span(c.t, dur);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 12));
  const bp = new SVF();
  const hp = new SVF();
  hp.set(1600, 0.707);
  let ph = 0;
  const att = ms(0.025);
  const rel = ms(0.05);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if ((k & 7) === 0) bp.set(3100 * (1 + 0.07 * Math.sin(TAU * 11 * t)), 3.2);
    bp.tick(nz.next());
    hp.tick(bp.bp);
    const env = attack(k, att) * cosRamp((n - k) / rel);
    ph += (TAU * (2500 + 220 * Math.sin(TAU * 7 * t) + 90 * Math.sin(TAU * 33 * t) + 180 * smooth(t / dur))) / SR;
    const squeak = Math.sin(ph) * (0.35 + 0.65 * bell(((t / dur) * 2.3) % 1)) * 0.11 * Math.exp(-Math.pow(t / dur - 0.55, 2) * 14);
    const y = (hp.hp * 0.5 * (0.75 + 0.25 * Math.sin(TAU * 23 * t)) + squeak) * env * 0.62 * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function whoosh(ctx, c) {
  const dur = c.dur ?? 0.4;
  const w = span(c.t, dur + 0.05);
  if (!w) return;
  const { i, n } = w;
  const nzL = new Noise(seedOf(c.t, 13));
  const nzR = new Noise(seedOf(c.t, 14));
  const bL = new SVF(), bR = new SVF(), lp = new SVF();
  lp.set(9000, 0.707);
  for (let k = 0; k < n; k++) {
    const p = k / (dur * SR);
    if ((k & 7) === 0) {
      const fc = 350 * Math.pow(15, smooth(clamp(p)));
      bL.set(fc, 1.3);
      bR.set(fc, 1.3);
    }
    bL.tick(nzL.next() * 0.6 + nzR.next() * 0.4);
    bR.tick(nzR.next() * 0.6 + nzL.next() * 0.4);
    const e = Math.pow(bell(Math.pow(clamp(p), 0.8)), 1.1) * 0.5 * tail(k, n);
    const [gl, gr] = pan(-0.8 + 1.6 * smooth(clamp(p)));
    const l = bL.bp * e * gl * 1.35;
    const r = bR.bp * e * gr * 1.35;
    put(ctx.sfx, i, k, l, r);
    put(ctx.sfxw, i, k, l * 0.3, r * 0.3);
  }
}

function click(ctx, c) {
  const v = c.v ?? 1;
  const w = span(c.t, 0.035);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 15));
  const bp = new SVF();
  bp.set(4200, 1.2);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    bp.tick(nz.next());
    const y = (Math.sin(TAU * 1900 * t) * Math.exp(-t / 0.0045) * 0.7 + Math.sin(TAU * 640 * t) * Math.exp(-t / 0.009) * 0.45 + bp.bp * Math.exp(-t / 0.0025) * 0.3) * attack(k, A2) * 0.26 * v * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function snap(ctx, c) {
  const w = span(c.t, 0.18);
  if (!w) return;
  const { i, n } = w;
  const nz = new Noise(seedOf(c.t, 16));
  const bp = new SVF();
  bp.set(2600, 1.4);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * (62 + 62 * Math.exp(-t / 0.03))) / SR;
    bp.tick(nz.next());
    const click = bp.bp * Math.exp(-t / 0.003) * 0.7 + Math.sin(TAU * 3300 * t) * Math.exp(-t / 0.007) * 0.4;
    const thud = Math.sin(ph) * Math.exp(-t / 0.06) * 0.9;
    const y = (click * 0.5 + thud * 0.55) * attack(k, A2) * 0.4 * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function count(ctx, c) {
  const f = c.f ?? 220;
  tom(ctx.sfx, c.t, f, 0.5, { tauA: 0.16 });
  const w = span(c.t, 0.22);
  if (!w) return;
  const { i, n } = w;
  const lp = new SVF();
  const d = f / SR;
  let p = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    p += d; if (p >= 1) p -= 1;
    if ((k & 7) === 0) lp.set(f * 2 + 3200 * Math.exp(-t / 0.05), 1);
    const y = lp.tick(sawBL(p, d)) * Math.exp(-t / 0.06) * attack(k, A2) * 0.14 * tail(k, n);
    put(ctx.sfx, i, k, y, y);
  }
}

function shine(ctx, c) {
  const freqs = [1174.66, 1396.91, 1760, 2349.32, 2793.83, 3520, 4698.64];
  const len = 3.2;
  const w = span(c.t, len);
  if (!w) return;
  const { i, n } = w;
  const r = new Noise(seedOf(c.t, 17));
  const parts = freqs.flatMap((f, j) =>
    [-1, 1].map((s) => ({
      f: f * (1 + s * 0.0014),
      on: Math.round((0.022 * j + 0.004 * (s + 1)) * SR),
      tau: 1.5 - j * 0.12,
      g: (0.1 / (1 + j * 0.22)) * 0.6,
      pl: pan(((j + (s > 0 ? 1 : 0)) % 2 ? 0.55 : -0.55) * (0.6 + 0.4 * r.rand())),
      tr: 3 + 4 * r.rand(),
      ph: r.rand() * TAU,
    })),
  );
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let l = 0;
    let rr = 0;
    for (const p of parts) {
      if (k < p.on) continue;
      const tt = (k - p.on) / SR;
      const y = Math.sin(TAU * p.f * t + p.ph) * Math.exp(-tt / p.tau) * attack(k - p.on, ms(0.004)) * (0.8 + 0.2 * Math.sin(TAU * p.tr * tt)) * p.g;
      l += y * p.pl[0];
      rr += y * p.pl[1];
    }
    const e = tail(k, n);
    put(ctx.sfx, i, k, l * e * 0.5, rr * e * 0.5);
    put(ctx.sfxw, i, k, l * e * 0.9, rr * e * 0.9);
  }
}

function boomCue(ctx, c) {
  boom(ctx.fx, c.t, 0.8, { len: 1.6 });
}

function impact(ctx, c) {
  if (near(ctx.placed.impacts, c.t)) return;
  const s = (c.amp ?? 18) / 18;
  // small impacts (stutter hits before a drop) get a shorter boom and crash so they do not pile up as sub mud
  const size = clamp(s, 0, 1);
  const k = 0.3 + 0.7 * Math.sqrt(size);
  boom(ctx.fx, c.t, 0.85 * s, { tauA: 0.38 * k, len: 0.6 + 1.2 * k });
  rumble(ctx.fx, c.t, 0.5 * s, 0.8 + 1.6 * k);
  impactBurst(ctx.fxw, c.t, s);
  if (!near(ctx.placed.crashes, c.t)) crash(ctx.cym, c.t, 0.9 * s, { len: 1 + 2.4 * k, seed: 7, tau2: 0.5 + 0.5 * k });
}

function riserCue(ctx, c) {
  const dur = c.dur ?? 2;
  if (nearSpan(ctx.placed.risers, c.t, dur)) return;
  riser(ctx.fxw, c.t, dur, { level: 0.8 });
}

function rollCue(ctx, c) {
  const dur = c.dur ?? 2;
  if (nearSpan(ctx.placed.rolls, c.t, dur)) return;
  snareRoll(ctx.drumsFx, c.t, dur, 0.8);
}

export const SFX = {
  key, select, del, blip, suck, pop, tick, swish, marker, whoosh, click, snap, count, shine,
  boom: boomCue,
  impact,
  riser: riserCue,
  roll: rollCue,
};
