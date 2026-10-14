import { createCanvas } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, FPS, DURATION, C } from './config.js';
import { registerFonts } from './lib/fonts.js';
import { scenes, themeAt, samplesAt } from './timeline.js';
import { drawHUD } from './hud.js';
import { shakeAt, flashAt, rgbAt } from './post.js';
import { txt } from './lib/text.js';
import { F } from './lib/fonts.js';

// Usage:
//   node src/render.js --still 4.2 [--still 6]          PNG stills → out/stills
//   node src/render.js --sheet 0:8:0.25 [--cols 4]      contact sheet → out/sheets
//   node src/render.js --video [--from 0 --to 56] [--scale 0.5] [--out out/video.mp4]

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const a = { still: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (k === 'still') a.still.push(Number(v));
    else a[k] = v;
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
registerFonts();

const scale = Number(args.scale || 1);
const CW = Math.round(W * scale);
const CH = Math.round(H * scale);
const canvas = createCanvas(CW, CH);
const ctx = canvas.getContext('2d');
const N = CW * CH * 4;
const acc = new Uint16Array(N);
const avg = Buffer.alloc(N);
const split = Buffer.alloc(N);

function drawFrame(t) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  const [sx, sy] = shakeAt(t);
  ctx.save();
  ctx.translate(sx, sy);
  for (const s of scenes) {
    if (t < s.start || t >= s.end) continue;
    ctx.save();
    s.draw(ctx, t - s.start, t);
    ctx.restore();
  }
  ctx.restore();
  drawHUD(ctx, t, themeAt(t));
  const f = flashAt(t);
  if (f > 0.002) {
    ctx.fillStyle = `rgba(255,251,244,${f})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function rgbSplit(src, shift) {
  const s = Math.round(shift * scale);
  if (s < 1) return src;
  const row = CW * 4;
  for (let y = 0; y < CH; y++) {
    const r0 = y * row;
    for (let x = 0; x < CW; x++) {
      const i = r0 + x * 4;
      split[i] = src[r0 + Math.min(CW - 1, x + s) * 4];
      split[i + 1] = src[i + 1];
      split[i + 2] = src[r0 + Math.max(0, x - s) * 4 + 2];
      split[i + 3] = 255;
    }
  }
  return split;
}

/** Renders frame at time t with temporal supersampling (180° shutter) where scenes ask for it. */
function renderFrame(t) {
  const n = samplesAt(t);
  let out;
  if (n <= 1) {
    drawFrame(t);
    out = canvas.data();
  } else {
    const shutter = 0.5 / FPS;
    acc.fill(0);
    for (let k = 0; k < n; k++) {
      drawFrame(t + (k / (n - 1)) * shutter); // leading shutter: never straddles a cut on a frame boundary
      const d = canvas.data();
      for (let j = 0; j < N; j++) acc[j] += d[j];
    }
    const half = n >> 1;
    for (let j = 0; j < N; j++) avg[j] = (acc[j] + half) / n;
    out = avg;
  }
  return rgbSplit(out, rgbAt(t));
}

function toPNG(buf, file) {
  const c = createCanvas(CW, CH);
  const x = c.getContext('2d');
  const img = x.createImageData(CW, CH);
  img.data.set(buf);
  x.putImageData(img, 0, 0);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, c.toBuffer('image/png'));
}

async function stills() {
  for (const t of args.still) {
    const file = path.join(ROOT, 'out/stills', `t${t.toFixed(3).padStart(7, '0')}.png`);
    toPNG(renderFrame(t), file);
    console.log(file);
  }
}

async function sheet() {
  const [a, b, step] = String(args.sheet).split(':').map(Number);
  const cols = Number(args.cols || 4);
  const times = [];
  for (let t = a; t <= b + 1e-9; t += step) times.push(+t.toFixed(4));
  const tw = Number(args.tw || 480);
  const th = Math.round((tw * H) / W);
  const pad = 6;
  const rows = Math.ceil(times.length / cols);
  const sc = createCanvas(cols * (tw + pad) + pad, rows * (th + pad) + pad);
  const sx = sc.getContext('2d');
  sx.fillStyle = '#333';
  sx.fillRect(0, 0, sc.width, sc.height);
  const tmp = createCanvas(CW, CH);
  const tctx = tmp.getContext('2d');
  const img = tctx.createImageData(CW, CH);
  for (let i = 0; i < times.length; i++) {
    img.data.set(renderFrame(times[i]));
    tctx.putImageData(img, 0, 0);
    const x = pad + (i % cols) * (tw + pad);
    const y = pad + Math.floor(i / cols) * (th + pad);
    sx.drawImage(tmp, 0, 0, CW, CH, x, y, tw, th);
    sx.fillStyle = 'rgba(0,0,0,0.7)';
    sx.fillRect(x, y, 70, 22);
    txt(sx, times[i].toFixed(2), x + 6, y + 16, { fam: F.M(700), size: 15, color: '#FFD000' });
  }
  const file = path.join(ROOT, 'out/sheets', String(args.name || `sheet_${a}-${b}`) + '.png');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sc.toBuffer('image/png'));
  console.log(file);
}

async function video() {
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? DURATION);
  const out = path.resolve(ROOT, args.out || 'out/video.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const crf = String(args.crf ?? 14);
  const preset = String(args.preset ?? 'slow');
  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-stats',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${CW}x${CH}`, '-r', String(FPS), '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-tune', 'animation',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  const f0 = Math.round(from * FPS);
  const f1 = Math.round(to * FPS);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = Buffer.from(renderFrame(f / FPS));
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 120 === 0) process.stderr.write(`\rframe ${f}/${f1}  ${((f - f0) / ((Date.now() - t0) / 1000 + 1e-9)).toFixed(1)} fps   `);
  }
  ff.stdin.end();
  await done;
  console.log(`\n${out}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

if (args.still.length) await stills();
if (args.sheet) await sheet();
if (args.video) await video();
