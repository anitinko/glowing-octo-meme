// The arrangement: chords, patterns and section logic. D minor, 120 BPM, 1 bar = 2 s.
// `arrange(B)` schedules every musical element onto the named buses in B and returns the kick times
// (the sidechain reference) plus the score elements that cue SFX must not duplicate.
import { BEAT, BAR } from '../config.js';
import { curve } from './dsp.js';
import { kick, clap, snare, tom, hat, shaker, perc, crash, revCymbal, riser, boom, impactBurst, rumble, snareRoll } from './drums.js';
import { bassNote, subTone, padChord, pluck, leadNote } from './synths.js';

// ---- harmony ------------------------------------------------------------------------------------------------
// pad: 6-note voicings (MIDI) with smooth voice-leading; ladder: ascending chord tones for the arp;
// bass: root in the 55–90 Hz range so it stays audible on small speakers.
export const CHORDS = {
  Dm: { pad: [50, 57, 62, 65, 69, 74], ladder: [62, 65, 69, 74, 77, 81, 86], bass: 38 },
  Bb: { pad: [50, 58, 62, 65, 70, 74], ladder: [62, 65, 70, 74, 77, 82, 86], bass: 34 },
  F: { pad: [53, 57, 60, 65, 69, 72], ladder: [60, 65, 69, 72, 77, 81, 84], bass: 41 },
  C: { pad: [52, 55, 60, 64, 67, 72], ladder: [60, 64, 67, 72, 76, 79, 84], bass: 36 },
  Gm: { pad: [50, 55, 58, 62, 67, 70], ladder: [62, 67, 70, 74, 79, 82, 86], bass: 43 },
  A: { pad: [52, 57, 61, 64, 69, 73], ladder: [61, 64, 69, 73, 76, 81, 85], bass: 33 },
};
const DM_FINAL = [50, 57, 62, 65, 69, 74, 81];

// chord per bar, from the brief
export const BARS = [
  [0, 'Dm'], [2, 'Dm'], [4, 'Dm'], [6, 'Bb'], [8, 'F'], [10, 'C'], [12, 'Dm'], [14, 'Bb'], [16, 'F'], [18, 'C'],
  [20, 'Dm'], [22, 'Bb'], [24, 'F'], [26, 'C'], [28, 'Dm'], [30, 'Bb'], [32, 'Gm'], [34, 'A'], [36, 'Dm'], [38, 'Bb'],
  [40, 'F'], [42, 'C'], [44, 'Bb'], [46, 'C'], [48, 'Dm'],
];
const chordAt = (t) => {
  let c = BARS[0][1];
  for (const [bt, n] of BARS) if (bt <= t + 1e-9) c = n;
  return c;
};

// arp: indices into the 7-note ladder (16 sixteenths per bar). Pedal-tone pattern; B is the climbing answer.
const ARP_A = [0, 2, 3, 2, 4, 2, 3, 2, 0, 2, 3, 2, 5, 4, 3, 2];
const ARP_B = [0, 2, 3, 2, 4, 2, 5, 2, 3, 2, 4, 2, 6, 5, 4, 3];
const ARP_V = [1, 0.55, 0.8, 0.55, 0.95, 0.55, 0.8, 0.55, 1, 0.55, 0.8, 0.55, 0.95, 0.7, 0.8, 0.6];

// lead hook for the drop: [offset in seconds within the bar, midi, duration]
const HOOK = {
  Dm: [[0, 74, 0.45], [0.5, 74, 0.2], [0.75, 77, 0.2], [1, 81, 0.7], [1.75, 79, 0.2]],
  Bb: [[0, 77, 0.45], [0.5, 77, 0.2], [0.75, 74, 0.2], [1, 70, 0.7], [1.75, 72, 0.2]],
  F: [[0, 72, 0.45], [0.5, 72, 0.2], [0.75, 77, 0.2], [1, 81, 0.7], [1.75, 79, 0.2]],
  C: [[0, 76, 0.45], [0.5, 76, 0.2], [0.75, 79, 0.2], [1, 79, 0.45], [1.5, 76, 0.2], [1.75, 74, 0.2]],
};

// ---- automation -----------------------------------------------------------------------------------------------
/** Pad low-pass cutoff (Hz) over the whole piece: swell in, open up, breakdown wide open, build sweep, close on the tail. */
export const padCutoff = curve(
  [
    [0, 140], [1, 260], [2.5, 900], [3.95, 2600], [4.0, 3000], [8, 3000], [16, 3800], [24, 4400], [31.9, 5200],
    [32, 7500], [35.9, 9500], [36, 4200], [43.9, 5600], [44, 2200], [47.9, 9000], [48, 7000], [52, 2600], [55.8, 600],
  ],
  true,
);
const arpPeak = curve([[0, 6200], [36, 6200], [43.9, 6200], [44, 3000], [47.9, 8500]]);

export const PLACED = {
  impacts: [48],
  crashes: [4, 8, 16, 24, 36, 40, 48],
  risers: [{ t: 2, dur: 2 }, { t: 33, dur: 3 }, { t: 46, dur: 2 }],
  rolls: [{ t: 34, dur: 2 }],
};

/** Schedule the whole arrangement. B: { kick, snr, hat, cym, bass, pad, arp, lead, fx, fxw }. */
export function arrange(B, opts = {}) {
  const kicks = [];
  const K = (t, v = 1) => { kicks.push(t); kick(B.kick, t, v); };

  // ---------------------------------------------------------------- 1. intro 0–4
  padChord(B.pad, 0, 3.95, CHORDS.Dm.pad, { att: 3.8, attPow: 2.2, rel: 0.1, gain: 0.9 });
  subTone(B.bass, 0, 3.95, 38, { att: 3.2, attPow: 2, level: 0.1, rel: 0.1 });
  subTone(B.bass, 0, 3.95, 26, { att: 3.6, attPow: 2, level: 0.11, rel: 0.1 });
  riser(B.fxw, 2, 2, { from: 57, to: 81, level: 0.9 });
  revCymbal(B.fx, 4, 1.7, 0.85);

  // ---------------------------------------------------------------- 2. groove 4–32, 4. drop 36–44, 5. build 44–48
  const grooveBars = [];
  for (const [t, ch] of BARS) if ((t >= 4 && t < 32) || (t >= 36 && t < 44)) grooveBars.push([t, ch]);

  for (const [t, ch] of grooveBars) {
    const drop = t >= 36;
    const bi = (t - 4) / BAR;
    const hi = drop ? 1.15 : 1;
    // kick: every beat; clap/snare: beats 2 and 4
    for (let b = 0; b < 4; b++) K(t + b * BEAT);
    for (const b of [1, 3]) {
      clap(B.snr, t + b * BEAT, drop ? 1.05 : 0.95);
      if (drop) snare(B.snr, t + b * BEAT, 0.5, { tone: 200, len: 0.2 });
    }
    // hats on the 8th off-beats (closed), open hats in the drop; open hat on the "and" of 4 every other bar from 8 s
    for (let j = 0; j < 4; j++) {
      const th = t + BEAT * (j + 0.5);
      const alt = [0.8, 0.7, 0.8, 0.72][j];
      if (drop) hat(B.hat, th, alt * 1.05, { open: true, len: 0.22, pan: j % 2 ? 0.2 : -0.2 });
      else if (j === 3 && t >= 8 && bi % 2 === 1) hat(B.hat, th, 0.85, { open: true, len: 0.26 });
      else hat(B.hat, th, alt, { pan: j % 2 ? 0.15 : -0.15 });
    }
    // quiet 16th shaker/hat layer on the "e" and "a"
    if (t >= 6) {
      const ramp = t < 8 ? 0.55 : 1;
      for (let j = 1; j < 16; j += 2) {
        const sv = (j % 4 === 1 ? 0.45 : 0.72) * ramp * (drop ? 1.25 : 1);
        shaker(B.hat, t + j * BEAT * 0.25, sv, { pan: j % 4 === 1 ? -0.3 : 0.3 });
        if (drop && j % 4 === 3) hat(B.hat, t + j * BEAT * 0.25, 0.3, { len: 0.07, pan: 0.2 });
      }
    }
    // variation every 8 s: rim ticks from 16, congas from 24 (and both in the drop)
    if ((t >= 16 && t < 32) || drop) for (const j of [3, 11]) perc(B.hat, t + j * 0.125, 'rim', 0.8, { pan: 0.3 });
    if ((t >= 24 && t < 32) || drop) {
      perc(B.hat, t + 7 * 0.125, 'conga', 0.7, { f: 330, pan: -0.35 });
      perc(B.hat, t + 14 * 0.125, 'conga', 0.85, { f: 250, pan: -0.25 });
    }

    // bass: offbeat 8ths on the chord root, octave/fifth variation
    const root = CHORDS[ch].bass;
    const bp = drop ? ['R', 'O', 'R', 'O'] : t < 8 ? ['R', 'R', 'R', 'R'] : [['R', 'R', 'R', 'R'], ['R', 'R', 'O', 'R'], ['R', 'R', 'R', 'R'], ['R', 'O', 'R', 'F']][bi % 4];
    bp.forEach((s, j) => {
      const m = root + (s === 'O' ? 12 : s === 'F' ? 7 : 0);
      bassNote(B.bass, t + BEAT * (j + 0.5), m, 0.2, [1, 0.85, 0.95, 0.85][j] * hi, { cut: drop ? 420 : 330, mod: drop ? 2300 : 1700 });
    });

    // arp from 8.0 (octave up in the drop to leave the middle for the lead)
    if (t >= 8) arpBar(B.arp, t, ch, drop ? (t - 36) / BAR : (t - 8) / BAR, drop ? { shift: 12, vel: 0.8, peak: 5200 } : { vel: 1, peak: arpPeak(t) });

    // pad: ducked later by the kick; swells a little through each 8 s block
    const first = t === 4;
    padChord(B.pad, t, BAR, CHORDS[ch].pad, { att: first ? 0.03 : 0.12, rel: 0.35, gain: drop ? 0.95 : 1 });
  }

  // fills: last beat before 8, 16, 24 (and 40)
  fillSnare(B.snr, 7.5);
  fillToms(B.snr, 15.5);
  fillMixed(B.snr, 23.5);
  fillSnare(B.snr, 39.5);

  // crashes
  for (const [t, v] of [[4, 0.9], [8, 0.8], [16, 0.8], [24, 0.85], [36, 1], [40, 0.8]]) crash(B.cym, t, v);

  // lead hook, two bars at a time over Dm|Bb and F|C
  for (const [t, ch] of grooveBars) {
    if (t < 36) continue;
    for (const [off, m, d] of HOOK[ch]) {
      leadNote(B.lead, t + off, m, d, 1);
      leadNote(B.lead, t + off, m - 12, d, 0.5, { cut: 1800, octUp: 0 });
    }
  }

  // ---------------------------------------------------------------- 3. breakdown 32–36
  padChord(B.pad, 32, BAR, CHORDS.Gm.pad, { att: 0.5, rel: 0.5, gain: 1.15 });
  padChord(B.pad, 34, BAR, CHORDS.A.pad, { att: 0.5, rel: 0.3, gain: 1.2 });
  arpBar(B.arp, 32, 'Gm', 12, { vel: 0.62, peak: 3000, base: 900, tau: 0.14 });
  arpBar(B.arp, 34, 'A', 13, { vel: 0.7, peak: 3400, base: 900, tau: 0.14, force: ARP_B });
  riser(B.fxw, 33, 3, { from: 57, to: 81, level: 1.1 });
  snareRoll(B.snr, 34, 2, 1);

  // ---------------------------------------------------------------- 5. build 44–48 (kick on 1 and 3, soft hats)
  for (const t of [44, 45, 46, 47]) K(t, 0.95);
  for (const t of [44, 46]) {
    const ch = chordAt(t);
    const last = t === 46;
    padChord(B.pad, t, BAR, CHORDS[ch].pad, { att: 0.25, rel: 0.35, g0: last ? 0.9 : 0.55, g1: last ? 1.45 : 0.9 });
    arpBar(B.arp, t, ch, 18 + (t - 44) / BAR, { vel: 0.85, peak: arpPeak(t + 1), force: last ? ARP_B : ARP_A });
    for (let j = 0; j < 4; j++) hat(B.hat, t + BEAT * (j + 0.5), 0.34 + (last ? 0.3 : 0) + j * 0.04, { pan: j % 2 ? 0.15 : -0.15 });
    for (const [o, d] of [[0.25, 0.45], [1.25, 0.45]]) bassNote(B.bass, t + o, CHORDS[ch].bass, d, 0.9, { cut: 300, mod: 1200 });
  }
  riser(B.fxw, 46, 2, { from: 57, to: 86, level: 1.3 });

  // ---------------------------------------------------------------- 6. final 48
  const fin = Math.min(1.25, Math.max(0.8, (opts.finalAmp ?? 18) / 18)); // follows the timeline's impact amp
  boom(B.fx, 48, fin);
  rumble(B.fx, 48, 0.55 * fin);
  impactBurst(B.fxw, 48, 1.1 * fin);
  crash(B.cym, 48, fin, { len: 4.2, tau2: 1.3, seed: 31 });
  padChord(B.pad, 48, 7.35, DM_FINAL, { att: 0.03, rel: 0.45, tau: 2.1, hold: 0.35, gain: 1.35 });
  subTone(B.bass, 48, 7.0, 26, { att: 0.03, tau: 2.8, level: 0.5, rel: 0.6 });
  subTone(B.bass, 48, 7.0, 38, { att: 0.03, tau: 2.2, level: 0.28, rel: 0.6 });
  [62, 69, 74, 77, 81, 86].forEach((m, j) =>
    pluck(B.arp, 48 + j * 0.02, m, (1 - j * 0.08) * 0.5, { tau: 1.35, len: 5, cutBase: 1400, cutPeak: 5600, tauC: 0.5, pan: j % 2 ? 0.4 : -0.4, square: 0.2 }),
  );

  return { kicks };
}

/** One bar of 16th-note arp. o: { vel, peak, base, tau, shift (semitones), force (pattern) } */
function arpBar(bus, t, ch, barIndex, o = {}) {
  const ladder = CHORDS[ch].ladder;
  const pat = o.force ?? (barIndex % 4 === 3 ? ARP_B : ARP_A);
  for (let s = 0; s < 16; s++) {
    const midi = ladder[pat[s]] + (o.shift ?? 0);
    pluck(bus, t + s * BEAT * 0.25, midi, ARP_V[s] * (o.vel ?? 1), {
      pan: s % 2 ? 0.22 : -0.22,
      cutPeak: o.peak,
      cutBase: o.base,
      tau: o.tau,
    });
  }
}

// ---- fills ----------------------------------------------------------------------------------------------------
function fillSnare(bus, t0) {
  [[0.125, 0.55], [0.25, 0.7], [0.3125, 0.8], [0.375, 1], [0.4375, 0.9]].forEach(([o, v], k) => snare(bus, t0 + o, v, { tone: 190 + 14 * k, len: 0.22 }));
}
function fillToms(bus, t0) {
  [[0.125, 330, -0.3, 0.7], [0.25, 250, 0, 0.8], [0.375, 190, 0.3, 0.95]].forEach(([o, f, p, v]) => tom(bus, t0 + o, f, v, { pan: p, tauA: 0.16 }));
  snare(bus, t0 + 0.4375, 0.6, { len: 0.12 });
}
function fillMixed(bus, t0) {
  [[0.125, 0.6], [0.25, 0.75], [0.375, 1], [0.4375, 0.7]].forEach(([o, v], k) => snare(bus, t0 + o, v, { tone: 195 + 12 * k, len: 0.2 }));
  tom(bus, t0 + 0.3125, 220, 0.75, { tauA: 0.12 });
}

