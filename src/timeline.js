import s01 from './scenes/s01-code.js';
import s02 from './scenes/s02-title.js';
import s03 from './scenes/s03-grid.js';
import s04 from './scenes/s04-pen.js';
import s05 from './scenes/s05-type.js';
import s06 from './scenes/s06-color.js';
import s07 from './scenes/s07-motion.js';
import s08 from './scenes/s08-system.js';
import s09 from './scenes/s09-breath.js';
import s10 from './scenes/s10-montage.js';
import s11 from './scenes/s11-mark.js';
import s12 from './scenes/s12-finale.js';

// Single source of truth for picture and sound: scene windows, impacts, chapters and audio cues.

export const scenes = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12].sort((a, b) => a.start - b.start);

export const impacts = [
  { t: 4.0, amp: 18, flash: 0.75, rgb: 16 },
  { t: 8.0, amp: 5, rgb: 6 },
  { t: 35.0, amp: 5, rgb: 4 },
  { t: 35.25, amp: 6, rgb: 5 },
  { t: 35.5, amp: 8, rgb: 6 },
  { t: 35.75, amp: 10, rgb: 8 },
  { t: 36.0, amp: 20, flash: 0.8, rgb: 18 },
  { t: 48.0, amp: 22, flash: 0.85, rgb: 20 },
];

export const chapters = [
  { t: 0, n: '00', title: 'ИНТРО' },
  { t: 8, n: '01', title: 'СЕТКА' },
  { t: 12, n: '02', title: 'ВЕКТОР' },
  { t: 16, n: '03', title: 'ШРИФТ' },
  { t: 20, n: '04', title: 'ЦВЕТ' },
  { t: 24, n: '05', title: 'ДВИЖЕНИЕ' },
  { t: 28, n: '06', title: 'СИСТЕМА' },
  { t: 32, n: '07', title: 'ВДОХ' },
  { t: 36, n: '08', title: 'ВСЁ СРАЗУ' },
  { t: 44, n: '09', title: 'ЗНАК' },
  { t: 48, n: '10', title: 'ФИНАЛ' },
];

export function themeAt(t) {
  let th = 'dark';
  for (const s of scenes) {
    if (t < s.start || t >= s.end || !s.theme) continue;
    th = typeof s.theme === 'function' ? s.theme(t - s.start, t) : s.theme;
  }
  return th;
}

export function samplesAt(t) {
  let n = 1;
  for (const s of scenes) if (t >= s.start && t < s.end && s.blur) n = Math.max(n, s.blur(t - s.start, t));
  for (const c of impacts) if (t >= c.t && t < c.t + 0.35) n = Math.max(n, 4);
  return n;
}

export function allCues() {
  const list = scenes.flatMap((s) => s.cues || []);
  for (const c of impacts) list.push({ t: c.t, type: 'impact', amp: c.amp });
  return list.sort((a, b) => a.t - b.t);
}
