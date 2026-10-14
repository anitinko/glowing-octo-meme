// Verification report for the rendered score:  node src/audio/analyze.js [out/music.wav] [--stems out/stems]
// Duration/format (ffprobe), loudness + true peak + LRA (ffmpeg ebur128), DC/peak (astats), NaN scan,
// per-section RMS/LUFS table, pre-drop gap silence, and kick-onset deviation from the 0.5 s grid.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SR, Biquad, readWav, todb, loudnessMeter, GAP_START, GAP_END } from './dsp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const file = path.resolve(ROOT, args.find((a) => !a.startsWith('--')) || 'out/music.wav');
const stemDir = path.resolve(ROOT, args.includes('--stems') ? args[args.indexOf('--stems') + 1] : path.join(path.dirname(path.relative(ROOT, file)), 'stems'));

const run = (cmd, a) => spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 26 });

// ---- format -------------------------------------------------------------------------------------------------------
const pr = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,duration,bits_per_sample:format=duration', '-of', 'default=nw=1', file]);
console.log('== ffprobe ==\n' + pr.stdout.trim());

// ---- ebur128 / astats ---------------------------------------------------------------------------------------------
const eb = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
const sum = eb.slice(eb.lastIndexOf('Summary:'));
const pick = (re) => (sum.match(re) || [])[1];
console.log(`== ebur128 ==\nintegrated ${pick(/I:\s+(-?[\d.]+) LUFS/)} LUFS   LRA ${pick(/LRA:\s+([\d.]+) LU/)} LU   true peak ${pick(/Peak:\s+(-?[\d.]+) dBFS/)} dBTP`);
const as = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'astats=metadata=0:reset=0', '-f', 'null', '-']).stderr;
const overall = as.slice(as.indexOf('Overall'));
const grab = (name) => (overall.match(new RegExp(name + ':\\s+(-?[\\d.e+-]+|-?inf)')) || [])[1];
console.log(`== astats (overall) ==\nDC offset ${grab('DC offset')}   peak level ${grab('Peak level dB')} dB   RMS level ${grab('RMS level dB')} dB   flat factor ${grab('Flat factor')}`);

// ---- own scan -----------------------------------------------------------------------------------------------------
const { chans } = readWav(file);
const [L, R] = chans;
let bad = 0;
let pk = 0;
for (let i = 0; i < L.length; i++) {
  if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) bad++;
  pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
}
console.log(`== scan ==\nsamples ${L.length} (${(L.length / SR).toFixed(6)} s)   NaN/Inf ${bad}   sample peak ${todb(pk).toFixed(2)} dBFS`);

const rms = (a, b) => {
  let s = 0;
  const i0 = Math.round(a * SR);
  const i1 = Math.min(L.length, Math.round(b * SR));
  for (let i = i0; i < i1; i++) s += L[i] * L[i] + R[i] * R[i];
  return todb(Math.sqrt(s / (2 * (i1 - i0))));
};
const meter = loudnessMeter(L, R);
console.log('== per-section level ==\nsection      RMS dBFS   loudness LUFS');
for (const [a, b] of [[0, 4], [4, 8], [8, 32], [32, 36], [36, 44], [44, 48], [48, 56]]) {
  console.log(`${String(a).padStart(2)}-${String(b).padEnd(2)}  ${rms(a, b).toFixed(1).padStart(14)}   ${meter.range(a, b).toFixed(1).padStart(10)}`);
}
console.log('tail decay (RMS dBFS per second after 48):', [48, 49, 50, 51, 52, 53, 54, 55].map((t) => rms(t, t + 1).toFixed(1)).join('  '));
const gi0 = Math.round(GAP_START * SR);
const gi1 = Math.round(GAP_END * SR);
let gpk = 0;
for (let i = gi0; i < gi1; i++) gpk = Math.max(gpk, Math.abs(L[i]), Math.abs(R[i]));
console.log(`gap ${GAP_START}-${GAP_END}: peak ${gpk === 0 ? '-inf (digital silence)' : todb(gpk).toFixed(1) + ' dBFS'}   RMS 0.100 s before gap ${rms(GAP_START - 0.1, GAP_START).toFixed(1)} dBFS, 0.100 s after ${rms(GAP_END, GAP_END + 0.1).toFixed(1)} dBFS`);
let last = 0;
for (let i = L.length - 1; i >= 0; i--) if (Math.abs(L[i]) > 1e-5 || Math.abs(R[i]) > 1e-5) { last = i; break; }
console.log(`last sample above -100 dBFS at ${(last / SR).toFixed(3)} s`);

// ---- kick onsets --------------------------------------------------------------------------------------------------
const dr = fs.existsSync(path.join(stemDir, 'kick.wav')) ? path.join(stemDir, 'kick.wav') : path.join(stemDir, 'drums.wav');
if (fs.existsSync(dr)) {
  const d = readWav(dr).chans;
  // zero-phase low-pass (forward + backward, 4 poles total) so the filter adds no group delay to the onset times
  const x = new Float32Array(d[0].length);
  for (let i = 0; i < x.length; i++) x[i] = (d[0][i] + d[1][i]) * 0.5;
  for (let pass = 0; pass < 2; pass++) {
    const f = new Biquad('lp', 250, 0.707);
    f.run(x);
    x.reverse();
  }
  // onset = start of the rise: find the steepest slope of the 3 ms-smoothed rectified signal (60% of max slope,
  // 200 ms refractory), then walk back to where the envelope is still below 10% of that hit's peak
  const w = Math.round(0.003 * SR);
  const e = new Float32Array(x.length);
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += Math.abs(x[i]);
    if (i >= w) acc -= Math.abs(x[i - w]);
    e[i] = acc / w;
  }
  const slope = (i) => e[i + 1] - e[i - 1];
  let ms = 0;
  for (let i = 1; i < e.length - 1; i++) ms = Math.max(ms, slope(i));
  const on = [];
  let lastOn = -1e9;
  for (let i = 1; i < e.length - 1; i++) {
    if (slope(i) > 0.6 * ms && i - lastOn > 0.2 * SR) {
      let pk = 0;
      for (let j = i; j < i + 0.04 * SR && j < e.length; j++) pk = Math.max(pk, e[j]);
      let j = i;
      while (j > 0 && e[j - 1] > pk * 0.1) j--;
      on.push((j - w / 2) / SR);
      lastOn = i;
    }
  }
  const grid = (t) => t - Math.round(t / 0.5) * 0.5;
  const inRange = on.filter((t) => t >= 3.9 && t < 32);
  const devs = inRange.map(grid);
  const mean = devs.reduce((a, b) => a + b, 0) / devs.length;
  console.log(`== kick onsets (${path.basename(dr)} stem, zero-phase low-pass 250 Hz) ==\nonsets found 4-32 s: ${inRange.length} (expect 56 kicks at 0.5 s spacing, 4.0 … 31.5)`);
  console.log(`max |deviation| from 0.5 s grid: ${(Math.max(...devs.map(Math.abs)) * 1000).toFixed(3)} ms   mean offset ${(mean * 1000).toFixed(3)} ms   jitter (max |dev - mean|) ${(Math.max(...devs.map((v) => Math.abs(v - mean))) * 1000).toFixed(3)} ms`);
} else {
  console.log(`(no ${path.relative(ROOT, dr)}: run synth with --stems for the kick-onset check)`);
}
