// Procedural soundtrack: node src/audio/synth.js [--out out/music.wav] [--stems] [--bits 24] [--target -14]
//   --stems     also write dry stems (float32, pre-master, at master gain) to out/stems/
//   --no-cues   music only (skip the timeline cue SFX)
//   --stats     print per-bus RMS per section
// Everything is deterministic (seeded noise); a 56 s stereo 48 kHz render takes well under a minute.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, N, GAP_START, GAP_END, Bus, Reverb, PingPong, Biquad, SVF, softClip, limit, loudnessMeter, writeWav, todb, db, cosRamp } from './dsp.js';
import { arrange, padCutoff, PLACED } from './score.js';
import { SFX } from './sfx.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    a[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return a;
}

// ---- mix settings ------------------------------------------------------------------------------------------------
// level = bus gain into the mix; room/hall = reverb sends; delay = ping-pong send; duck = sidechain depth (linear)
// music buses carry MG so that the master gain lands near 0 dB and SFX amplitudes read as final dBFS
const MG = db(-6.5);
const ROUTE = {
  kick: { level: 0.88 },
  snr: { level: 1.12, room: 0.9, hall: 0.1 },
  hat: { level: 1.58, room: 0.1 },
  cym: { level: 1.46, hall: 0.3 },
  bass: { level: 0.8, duck: 0.58 },
  pad: { level: 1.13, hall: 0.7, duck: 0.62 },
  arp: { level: 1.16, hall: 0.35, delay: 1.2, duck: 0.28 },
  lead: { level: 1.0, hall: 0.35, room: 0.1, delay: 0.2, duck: 0.25 },
  fx: { level: 1.0, hall: 0.5 },
  fxw: { level: 1.0, hall: 0.6 },
  sfx: { level: 1.0, room: 0.2 },
  sfxw: { level: 0, hall: 1.0 },
};
for (const [k, r] of Object.entries(ROUTE)) if (k !== 'sfx' && k !== 'sfxw') r.level *= MG;
const DELAY_OUT = { level: 1.0 * MG, hall: 0.2 };
const STEMS = {
  kick: ['kick'],
  drums: ['kick', 'snr', 'hat', 'cym'],
  bass: ['bass'],
  pad: ['pad'],
  lead: ['lead'],
  fx: ['fx', 'fxw'],
  sfx: ['sfx'],
};

/** Sidechain gain curve: instant duck at each kick, short hold, exponential recovery (the "pump"). */
function duckCurve(times, depth, { hold = 0.012, rel = 0.14, att = 0.003 } = {}) {
  const g = new Float32Array(N).fill(1);
  const span = Math.round(rel * 6 * SR);
  for (const t of times) {
    const i0 = Math.round(t * SR);
    for (let k = 0; k < span && i0 + k < N; k++) {
      const s = k / SR;
      const d = s < att ? cosRamp(s / att) : s < att + hold ? 1 : Math.exp(-(s - att - hold) / rel);
      const v = 1 - depth * d;
      if (v < g[i0 + k]) g[i0 + k] = v;
    }
  }
  return g;
}

async function loadCues(args) {
  if (args['no-cues']) return [];
  const { allCues } = await import('../timeline.js');
  return allCues();
}

export async function render(args = {}) {
  const t00 = Date.now();
  const log = (...m) => (args.quiet ? 0 : console.log(...m));
  const B = {};
  for (const k of Object.keys(ROUTE)) B[k] = new Bus();

  const cues = await loadCues(args);

  // ------------------------------------------------------------ musical score
  const finalAmp = cues.find((c) => c.type === 'impact' && Math.abs(c.t - 48) <= 0.05)?.amp;
  const { kicks } = arrange(B, { finalAmp });
  log(`score: ${kicks.length} kicks (${((Date.now() - t00) / 1000).toFixed(1)}s)`);

  // ------------------------------------------------------------ cue SFX
  const ctx = { ...B, placed: PLACED, drumsFx: B.snr };
  const unknown = {};
  const counts = {};
  for (const c of cues) {
    const f = SFX[c.type];
    if (!f) {
      unknown[c.type] = (unknown[c.type] || 0) + 1;
      continue;
    }
    if (!Number.isFinite(c.t)) continue;
    f(ctx, c);
    counts[c.type] = (counts[c.type] || 0) + 1;
  }
  const unk = Object.entries(unknown);
  if (unk.length) console.warn(`[audio] ignored unknown cue type(s): ${unk.map(([k, v]) => `${k} (x${v})`).join(', ')}`);
  log(`cues: ${cues.length} (${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ')}) (${((Date.now() - t00) / 1000).toFixed(1)}s)`);

  // ------------------------------------------------------------ pad bus filter, sidechain
  padBusFilter(B.pad);
  for (const [name, r] of Object.entries(ROUTE)) {
    if (!r.duck) continue;
    const g = duckCurve(kicks, r.duck);
    const b = B[name];
    for (let i = 0; i < N; i++) {
      b.l[i] *= g[i];
      b.r[i] *= g[i];
    }
  }

  // ------------------------------------------------------------ sends, delay, reverbs
  const room = new Bus();
  const hall = new Bus();
  const dly = new Bus();
  const dIn = new Bus();
  const sendAdd = (dst, src, amt) => {
    if (!amt) return;
    for (let i = 0; i < N; i++) {
      dst.l[i] += src.l[i] * amt;
      dst.r[i] += src.r[i] * amt;
    }
  };
  for (const [name, r] of Object.entries(ROUTE)) {
    sendAdd(room, B[name], (r.room || 0) * r.level);
    sendAdd(hall, B[name], (r.hall || 0) * r.level);
    sendAdd(dIn, B[name], (r.delay || 0) * r.level);
  }
  const g0 = Math.round(GAP_START * SR);
  const g1 = Math.round(GAP_END * SR);
  const delay = new PingPong({ time: 0.375, feedback: 0.48, lp: 4200, hp: 300 });
  const fbFn = (t) => (t >= 47.9 ? 0.6 : t >= 32 && t < 36 ? 0.55 : 0.48);
  delay.process(dIn.l, dIn.r, dly.l, dly.r, 0, g0, fbFn);
  delay.reset();
  delay.process(dIn.l, dIn.r, dly.l, dly.r, g1, N, fbFn);
  sendAdd(hall, dly, DELAY_OUT.hall);

  const roomVerb = new Reverb({ rt60: 1.35, damp: 0.35, predelay: 0.008, hp: 220, lp: 8000 });
  const hallVerb = new Reverb({ rt60: 4.4, damp: 0.3, predelay: 0.028, hp: 160, lp: 7500, size: 1.25 });
  const rtn = { room: new Bus(), hall: new Bus() };
  for (const [v, inp, out] of [[roomVerb, room, rtn.room], [hallVerb, hall, rtn.hall]]) {
    v.process(inp.l, inp.r, out.l, out.r, 0, g0);
    v.reset();
    v.process(inp.l, inp.r, out.l, out.r, g1, N);
  }
  log(`fx: delay + reverbs (${((Date.now() - t00) / 1000).toFixed(1)}s)`);

  // ------------------------------------------------------------ sum
  const mix = new Bus();
  const stems = {};
  for (const [name, r] of Object.entries(ROUTE)) mix.add(B[name], r.level);
  mix.add(dly, DELAY_OUT.level);
  mix.add(rtn.room, 1);
  mix.add(rtn.hall, 1);
  for (const [s, names] of Object.entries(STEMS)) {
    stems[s] = new Bus();
    for (const n of names) stems[s].add(B[n], ROUTE[n].level);
  }
  stems.arp = new Bus();
  stems.arp.add(B.arp, ROUTE.arp.level);
  stems.arp.add(dly, DELAY_OUT.level);
  stems.reverb = new Bus();
  stems.reverb.add(rtn.room, 1);
  stems.reverb.add(rtn.hall, 1);

  if (args.stats) busStats({ ...Object.fromEntries(Object.keys(ROUTE).map((k) => [k, mkScaled(B[k], ROUTE[k].level)])), dly: mkScaled(dly, DELAY_OUT.level), room: rtn.room, hall: rtn.hall, MIX: mix });

  // ------------------------------------------------------------ master
  const target = Number(args.target ?? -14);
  const res = master(mix, target, log);
  log(`master: ${((Date.now() - t00) / 1000).toFixed(1)}s`);

  const out = path.resolve(ROOT, args.out || 'out/music.wav');
  writeWav(out, [res.L, res.R], { bits: Number(args.bits || 24) });
  if (args.stems) {
    const dir = path.join(path.dirname(out), 'stems');
    for (const [name, b] of Object.entries(stems)) {
      for (let i = 0; i < N; i++) {
        b.l[i] *= res.gain;
        b.r[i] *= res.gain;
      }
      writeWav(path.join(dir, `${name}.wav`), [b.l, b.r], { bits: 32 });
    }
  }
  log(`wrote ${out} (${((Date.now() - t00) / 1000).toFixed(1)}s total)`);
  return { ...res, out, kicks };
}

function mkScaled(b, g) {
  const o = new Bus();
  o.add(b, g);
  return o;
}

function busStats(buses) {
  const secs = [[0, 4], [4, 8], [8, 32], [32, 36], [36, 44], [44, 48], [48, 56]];
  const meters = Object.fromEntries(Object.entries(buses).map(([k, b]) => [k, loudnessMeter(b.l, b.r)]));
  console.log('bus loudness, dB relative to the full mix (K-weighted) per section; last column = bus peak dBFS');
  console.log(''.padEnd(6) + secs.map((s) => `${s[0]}-${s[1]}`.padStart(8)).join(''));
  for (const [name, b] of Object.entries(buses)) {
    const row = secs.map(([a, c]) => {
      const d = meters[name].range(a, c) - meters.MIX.range(a, c);
      return (d < -90 ? '--' : d.toFixed(1)).padStart(8);
    });
    let pk = 0;
    for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(b.l[i]), Math.abs(b.r[i]));
    console.log(name.padEnd(6) + row.join('') + `   peak ${todb(pk).toFixed(1)}`);
  }
  console.log('MIX'.padEnd(6) + secs.map(([a, c]) => meters.MIX.range(a, c).toFixed(1).padStart(8)).join('') + '   (LUFS before master gain)');
}

/** One shared 4-pole low-pass with automated cutoff + 140 Hz high-pass over the whole pad bus. */
function padBusFilter(pad) {
  const chans = [pad.l, pad.r].map((buf) => ({ buf, a: new SVF(), b: new SVF(), hp: new Biquad('hp', 140, 0.707) }));
  for (const c of chans) {
    for (let i = 0; i < N; i++) {
      if ((i & 31) === 0) {
        const fc = padCutoff(i / SR);
        c.a.set(fc, 0.5412);
        c.b.set(fc, 1.3066);
      }
      c.buf[i] = c.hp.tick(c.b.tick(c.a.tick(c.buf[i])));
    }
  }
}

/** Master chain + loudness search: DC-block, 25 Hz high-pass, soft clip, gap/fade gate, true-peak limiter. */
function master(mix, target, log) {
  const gate = new Float32Array(N).fill(1);
  const gs = Math.round(GAP_START * SR);
  const ge = Math.round(GAP_END * SR);
  const ramp = Math.round(0.004 * SR);
  for (let i = gs - ramp; i < gs; i++) gate[i] = cosRamp((gs - i) / ramp);
  for (let i = gs; i < ge; i++) gate[i] = 0;
  const f0 = Math.round(55.2 * SR);
  const f1 = Math.round(55.8 * SR);
  for (let i = f0; i < N; i++) gate[i] = i >= f1 ? 0 : cosRamp((f1 - i) / (f1 - f0));

  const chain = (g) => {
    const L = new Float32Array(N);
    const R = new Float32Array(N);
    const hp = [new Biquad('hp', 25, 0.707), new Biquad('hp', 25, 0.707)];
    const rdc = 1 - (2 * Math.PI * 5) / SR;
    const st = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    for (let i = 0; i < N; i++) {
      const ins = [mix.l[i] * g, mix.r[i] * g];
      const outs = [0, 0];
      for (let c = 0; c < 2; c++) {
        const x = ins[c];
        const y = x - st[c].x + rdc * st[c].y;
        st[c].x = x;
        st[c].y = y;
        outs[c] = softClip(hp[c].tick(y), 0.62) * gate[i];
      }
      L[i] = outs[0];
      R[i] = outs[1];
    }
    const lim = limit(L, R, -1.3, { attackMs: 3, releaseMs: 90 });
    return { L, R, lim };
  };

  let g = 1;
  {
    const I0 = loudnessMeter(mix.l, mix.r).integrated();
    g = db(target - I0);
  }
  let best;
  for (let it = 0; it < 8; it++) {
    best = chain(g);
    const I = loudnessMeter(best.L, best.R).integrated();
    log(`  loudness iter ${it}: gain ${todb(g).toFixed(2)} dB -> ${I.toFixed(2)} LUFS (max GR ${best.lim.maxGR.toFixed(1)} dB @ ${best.lim.grAt.toFixed(2)}s)`);
    if (Math.abs(I - target) < 0.04) break;
    g *= db(target - I);
  }
  best.gain = g;
  return best;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await render(parseArgs(process.argv.slice(2)));
}
