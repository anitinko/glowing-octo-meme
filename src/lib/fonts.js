import { GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
let registered = false;

export function registerFonts() {
  if (registered) return;
  registered = true;
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.ttf')) : [];
  if (!files.length) throw new Error('No fonts in assets/fonts — run `npm run fonts` first');
  for (const f of files) GlobalFonts.registerFromPath(path.join(dir, f), f.slice(0, -4));
}

// Each weight is registered as its own family alias, e.g. "Unbounded-900", "Playfair-700i".
export const F = {
  U: (w = 800) => `Unbounded-${w}`,
  M: (w = 400) => `JetBrainsMono-${w}`,
  S: (w = 500) => `Manrope-${w}`,
  P: (w = 400) => `Playfair-${w}`,
};
