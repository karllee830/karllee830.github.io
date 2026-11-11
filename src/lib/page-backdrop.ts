/**
 * Page background in the style of the hero's current render mode, shown
 * only in the margins outside the page frame: sparse dots of text (ASCII),
 * faint pixel blocks (Pixel), a halftone field (Dots), a dithered fade
 * toward the bottom of the screen (Dither), pairs of braille dots
 * (Braille), small plus signs (Cross) or short engraved strokes (Hatch).
 *
 * Each style is a small tile repeated as a canvas pattern. When the hero
 * switches modes it dispatches `avatar:mode` with a shared wave
 * (src/lib/mode-wave.ts); the new texture spreads with that wave,
 * continuing the ripple from the hero card. Quick switches overlap: each
 * wave keeps spreading, and where a newer one has passed it wins.
 *
 * Glitch: on the home page only, every GLITCH_MIN–GLITCH_MAX ms a short
 * run of tiles somewhere in one margin flickers to the accent colour, like
 * the occasional glitch inside the hero card (one at a time, never during
 * a wave or over the easter egg).
 *
 * Easter egg: the bottom-right corner of the right margin spells
 * "HELLO :)" in the same marks, a touch brighter than the texture around
 * it; it follows mode changes and the wave like everything else.
 *
 * Performance: everything is clipped to the margins (nothing is drawn when
 * there are none, as on phones); during a wave each frame repaints only
 * the ring that changed since the previous frame; otherwise nothing redraws.
 */

import { MODE_EVENT, WAVE_SPEED, WAVE_WIDTH, readStoredMode, type ModeWave, type RenderMode } from './mode-wave';
import { drawMark } from './mode-marks';

// 3×5 pixel font for the easter egg.
const EGG_FONT: Record<string, string[]> = {
  H: ['101', '101', '111', '101', '101'],
  E: ['111', '100', '110', '100', '111'],
  L: ['100', '100', '100', '100', '111'],
  O: ['111', '101', '101', '101', '111'],
  ':': ['0', '1', '0', '1', '0'],
  ')': ['10', '01', '01', '01', '10'],
  ' ': ['0', '0', '0', '0', '0'],
};
const EGG_INSET = 24;

const GLITCH_MIN = 12000;
const GLITCH_MAX = 24000;
const GLITCH_STEP = 70; // delay between neighbouring tiles
const GLITCH_FLASH = 200; // how long each tile flickers
const GLITCH_BLINK = 60; // on/off period of the flicker

/** Cell offsets (in cells) for a line of text in the 3×5 font, plus its width. */
function layoutLine(text: string, top: number) {
  const cells: [number, number][] = [];
  let x = 0;
  for (const ch of text) {
    const rows = EGG_FONT[ch] ?? EGG_FONT[' '];
    rows.forEach((row, y) => [...row].forEach((bit, dx) => bit === '1' && cells.push([x + dx, top + y])));
    x += rows[0].length + 1;
  }
  return { cells, width: x - 1 };
}

/** Spacing of the page texture; twice the hero's unit, so the margins stay quiet. */
const TILE = 24;
/** Pixel blocks are larger marks, so they get wider spacing. */
const PIXEL_TILE = 48;
const PIXEL_BLOCK = 12;
const DITHER_CELL = 3;
const DITHER_LEVELS = 8;

/** 8×8 Bayer matrix, thresholds in (0, 1). */
const BAYER8 = (() => {
  const base = [0, 2, 3, 1];
  const out: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v =
        16 * base[((y & 1) << 1) | (x & 1)] +
        4 * base[(((y >> 1) & 1) << 1) | ((x >> 1) & 1)] +
        base[(((y >> 2) & 1) << 1) | ((x >> 2) & 1)];
      out.push((v + 0.5) / 64);
    }
  }
  return out;
})();

export function initPageBackdrop() {
  const canvas = document.querySelector<HTMLCanvasElement>('.page-backdrop');
  const ctx = canvas?.getContext('2d');
  const shell = document.querySelector<HTMLElement>('.shell');
  if (!canvas || !ctx || !shell) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let mode = readStoredMode();
  let dpr = 1;
  let width = 0;
  let height = 0;
  /** Margin rectangles in device pixels; empty when the frame fills the screen. */
  let margins: [number, number, number, number][] = [];
  let colors = { subtle: '#a3a3a3', accent: '#669fd0' };
  let font = '10px monospace';
  const patterns = new Map<string, CanvasPattern>();

  /** Waves still spreading, oldest first. */
  let waves: (ModeWave & { reach: number; painted: number })[] = [];
  /** Style shown where no running wave has reached yet. */
  let settled = mode;
  /** Easter egg layout in CSS px; null when the right margin is too narrow. */
  let egg: { cell: number; cells: [number, number][]; box: [number, number, number, number] } | null = null;
  let fontFamily = 'monospace';
  let raf = 0;
  /** The running margin glitch, in device px: tile rects and start time. */
  let glitch: { tiles: [number, number, number, number][]; t0: number } | null = null;
  let glitchTimer = 0;
  let glitchRaf = 0;
  // Only the home page (which has the hero avatar) glitches.
  const glitchEnabled = !!document.querySelector('.ascii-stage') && !reducedMotion.matches;

  function readStyles() {
    const root = getComputedStyle(document.documentElement);
    colors = {
      subtle: root.getPropertyValue('--color-fg-subtle').trim() || colors.subtle,
      accent: root.getPropertyValue('--color-accent').trim() || colors.accent,
    };
    fontFamily = getComputedStyle(canvas!).fontFamily || 'monospace';
    font = `500 ${10 * dpr}px ${fontFamily}`;
    patterns.clear();
  }

  /** One tile of a style, drawn in device pixels and repeated. */
  function tile(m: RenderMode, tint: boolean, level = 0): CanvasPattern {
    const key = `${m}:${tint}:${level}`;
    const cached = patterns.get(key);
    if (cached) return cached;

    // Larger marks (blocks, strokes) get the wider spacing.
    const size = (m === 'pixel' || m === 'hatch' ? PIXEL_TILE : TILE) * dpr;
    const t = document.createElement('canvas');
    t.width = size;
    t.height = size;
    const c = t.getContext('2d')!;
    c.fillStyle = tint ? colors.accent : colors.subtle;

    if (m === 'ascii') {
      c.globalAlpha = tint ? 0.9 : 0.45;
      c.font = font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('.', size / 2, size / 2);
    } else if (m === 'pixel') {
      // One faint block, the size of a hero pixel, per wide tile.
      c.globalAlpha = tint ? 0.5 : 0.05;
      const block = PIXEL_BLOCK * dpr;
      const offset = (size - block) / 2;
      c.fillRect(offset, offset, block, block);
    } else if (m === 'braille') {
      // A pair of braille dots per tile.
      c.globalAlpha = tint ? 0.9 : 0.45;
      for (const dy of [-1.5, 1.5]) {
        c.beginPath();
        c.arc(size / 2, size / 2 + dy * dpr, 0.8 * dpr, 0, Math.PI * 2);
        c.fill();
      }
    } else if (m === 'cross') {
      c.globalAlpha = tint ? 0.9 : 0.35;
      const arm = (tint ? 3 : 2) * dpr;
      c.fillRect(size / 2 - arm, size / 2 - dpr / 2, arm * 2, dpr);
      c.fillRect(size / 2 - dpr / 2, size / 2 - arm, dpr, arm * 2);
    } else if (m === 'hatch') {
      // One short engraved stroke per wide tile.
      c.globalAlpha = tint ? 0.9 : 0.22;
      c.strokeStyle = c.fillStyle;
      c.lineWidth = dpr;
      const half = (tint ? 4 : 3) * dpr;
      c.beginPath();
      c.moveTo(size / 2 - half, size / 2 + half);
      c.lineTo(size / 2 + half, size / 2 - half);
      c.stroke();
    } else if (m === 'dots') {
      c.globalAlpha = tint ? 0.9 : 0.6;
      c.beginPath();
      c.arc(size / 2, size / 2, (tint ? 1.4 : 0.9) * dpr, 0, Math.PI * 2);
      c.fill();
    } else {
      c.globalAlpha = tint ? 0.9 : 0.18;
      // From one dot per tile at the top to a light sprinkle at the bottom.
      // The wave band matches the other styles: one mark per tile.
      const density = tint ? 0.016 : 0.008 + (0.022 * level) / (DITHER_LEVELS - 1);
      const cell = DITHER_CELL * dpr;
      const cells = TILE / DITHER_CELL;
      for (let sy = 0; sy < cells; sy++) {
        for (let sx = 0; sx < cells; sx++) {
          if (density > BAYER8[(sy % 8) * 8 + (sx % 8)]) c.fillRect(sx * cell, sy * cell, cell, cell);
        }
      }
    }

    const pattern = ctx!.createPattern(t, 'repeat')!;
    patterns.set(key, pattern);
    return pattern;
  }

  /** Fills the current clip with a style. Dither darkens toward the bottom in bands. */
  function fillStyle(m: RenderMode, tint = false) {
    const c2d = ctx!;
    if (m !== 'dither' || tint) {
      c2d.fillStyle = tile(m, tint);
      c2d.fillRect(0, 0, canvas!.width, canvas!.height);
      return;
    }
    const band = TILE * dpr;
    const rows = Math.ceil(canvas!.height / band);
    for (let r = 0; r < rows; r++) {
      const depth = rows > 1 ? r / (rows - 1) : 0;
      c2d.fillStyle = tile('dither', false, Math.round(depth ** 3 * (DITHER_LEVELS - 1)));
      c2d.fillRect(0, r * band, canvas!.width, band);
    }
  }

  function clipToMargins() {
    const c2d = ctx!;
    c2d.beginPath();
    for (const [x, y, w, h] of margins) c2d.rect(x, y, w, h);
    c2d.clip();
  }

  function paintStill() {
    const c2d = ctx!;
    c2d.clearRect(0, 0, canvas!.width, canvas!.height);
    if (!margins.length) return;
    c2d.save();
    clipToMargins();
    // Mid-wave (a resize or theme change), lay down the settled style and
    // let the running waves repaint their discs on the next frame.
    fillStyle(waves.length ? settled : mode);
    c2d.restore();
    for (const wave of waves) wave.painted = 0;
    paintEgg();
  }

  /** Lays out "HELLO :)" in the bottom-right corner, on one line or two. */
  function layoutEgg(rightMargin: number) {
    egg = null;
    const room = rightMargin - EGG_INSET * 2;
    const one = layoutLine('HELLO :)', 0);
    const first = layoutLine('HELLO', 0);
    const second = layoutLine(':)', 6);
    for (const cell of [7, 6, 5]) {
      let cells: [number, number][];
      let cols: number;
      let rows: number;
      if (one.width * cell <= room) {
        cells = one.cells;
        cols = one.width;
        rows = 5;
      } else if (first.width * cell <= room) {
        // Second line right-aligned under the first.
        const shift = first.width - second.width;
        cells = [...first.cells, ...second.cells.map(([x, y]) => [x + shift, y] as [number, number])];
        cols = first.width;
        rows = 11;
      } else continue;
      const w = cols * cell;
      const h = rows * cell;
      const x = width - EGG_INSET - w;
      const y = height - EGG_INSET - h;
      egg = { cell, cells: cells.map(([cx, cy]) => [x + cx * cell, y + cy * cell]), box: [x, y, w, h] };
      return;
    }
  }

  /**
   * Draws the easter egg over a cleared box. During waves each letter cell
   * takes the newest wave that has reached it (its accent band or its new
   * style), or the settled style. `fronts` are the waves' current radii.
   */
  function paintEgg(fronts: number[] = []) {
    if (!egg) return;
    const c2d = ctx!;
    const [bx, by, bw, bh] = egg.box;
    const pad = egg.cell;
    c2d.save();
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2d.clearRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    for (const [x, y] of egg.cells) {
      let style = settled;
      let tint = false;
      for (let k = waves.length - 1; k >= 0; k--) {
        const wave = waves[k];
        const d = Math.hypot(x + egg.cell / 2 - wave.x, y + egg.cell / 2 - wave.y);
        const front = fronts[k] ?? 0;
        if (d >= front) continue;
        style = wave.mode;
        tint = d >= front - WAVE_WIDTH;
        break;
      }
      c2d.fillStyle = tint ? colors.accent : colors.subtle;
      c2d.globalAlpha = tint ? 0.9 : 0.35;
      drawMark(c2d, style, x, y, egg.cell, fontFamily);
    }
    c2d.restore();
  }

  /**
   * Repaints, for each wave, only the ring between last frame's settled edge
   * and its new front, leaving out whatever a newer wave already covers.
   */
  function paintWaves(now: number) {
    if (!waves.length) return;
    const c2d = ctx!;
    const fronts = waves.map((wave) => Math.max(0, (now - wave.t0) * WAVE_SPEED));

    if (margins.length) {
      waves.forEach((wave, k) => {
        const radius = fronts[k];
        const inner = Math.max(0, radius - WAVE_WIDTH);
        const x = wave.x * dpr;
        const y = wave.y * dpr;
        c2d.save();
        clipToMargins();
        for (let n = k + 1; n < waves.length; n++) {
          c2d.beginPath();
          c2d.rect(0, 0, canvas!.width, canvas!.height);
          c2d.arc(waves[n].x * dpr, waves[n].y * dpr, fronts[n] * dpr, 0, Math.PI * 2);
          c2d.clip('evenodd');
        }
        c2d.beginPath();
        c2d.arc(x, y, radius * dpr, 0, Math.PI * 2);
        if (wave.painted > 0) c2d.arc(x, y, wave.painted * dpr, 0, Math.PI * 2);
        c2d.clip('evenodd');
        c2d.clearRect(0, 0, canvas!.width, canvas!.height);

        // New style where the wave has passed.
        c2d.save();
        c2d.beginPath();
        c2d.arc(x, y, inner * dpr, 0, Math.PI * 2);
        c2d.clip();
        fillStyle(wave.mode);
        c2d.restore();

        // Accent band at the front.
        c2d.beginPath();
        c2d.arc(x, y, radius * dpr, 0, Math.PI * 2);
        c2d.arc(x, y, inner * dpr, 0, Math.PI * 2);
        c2d.clip('evenodd');
        fillStyle(wave.mode, true);
        c2d.restore();
        wave.painted = inner;
      });
    }

    paintEgg(fronts);

    // Once a wave has covered the screen, it and every older one are done.
    let done = -1;
    waves.forEach((wave, k) => {
      if (fronts[k] - WAVE_WIDTH >= wave.reach) done = k;
    });
    if (done >= 0) {
      settled = waves[done].mode;
      waves = waves.slice(done + 1);
      if (!waves.length) paintStill();
    }
  }

  function frame(now: number) {
    raf = 0;
    paintWaves(now);
    if (waves.length) raf = requestAnimationFrame(frame);
  }

  const tileSize = () => (mode === 'pixel' || mode === 'hatch' ? PIXEL_TILE : TILE) * dpr;

  /** Picks a run of 3–6 tiles on a random row of a random margin, away from the egg. */
  function startGlitch() {
    window.clearTimeout(glitchTimer);
    glitchTimer = window.setTimeout(startGlitch, GLITCH_MIN + Math.random() * (GLITCH_MAX - GLITCH_MIN));
    if (glitch || waves.length || !margins.length || document.visibilityState !== 'visible') return;

    const size = tileSize();
    const [mx, my, mw, mh] = margins[Math.floor(Math.random() * margins.length)];
    const first = Math.ceil(mx / size);
    const last = Math.floor((mx + mw) / size) - 1;
    const count = Math.min(last - first + 1, 3 + Math.floor(Math.random() * 4));
    if (count < 1) return;
    const col = first + Math.floor(Math.random() * (last - first + 2 - count));
    const row = Math.floor(Math.random() * Math.floor((my + mh) / size));
    const tiles: [number, number, number, number][] = [];
    for (let k = 0; k < count; k++) tiles.push([(col + k) * size, row * size, size, size]);

    if (egg) {
      const [ex, ey, ew, eh] = egg.box.map((v) => v * dpr);
      const pad = egg.cell * dpr;
      const hit = tiles.some(([x, y, w, h]) => x < ex + ew + pad && x + w > ex - pad && y < ey + eh + pad && y + h > ey - pad);
      if (hit) return;
    }
    glitch = { tiles, t0: performance.now() };
    if (!glitchRaf) glitchRaf = requestAnimationFrame(glitchFrame);
  }

  function glitchFrame(now: number) {
    glitchRaf = 0;
    if (!glitch) return;
    const c2d = ctx!;
    let running = false;
    glitch.tiles.forEach(([x, y, w, h], k) => {
      const t = now - glitch!.t0 - k * GLITCH_STEP;
      const flashing = t >= 0 && t < GLITCH_FLASH;
      if (t < GLITCH_FLASH) running = true;
      if (t < 0) return;
      c2d.save();
      c2d.beginPath();
      c2d.rect(x, y, w, h);
      c2d.clip();
      c2d.clearRect(x, y, w, h);
      fillStyle(mode, flashing && Math.floor(t / GLITCH_BLINK) % 2 === 0);
      c2d.restore();
    });
    if (running && !waves.length) glitchRaf = requestAnimationFrame(glitchFrame);
    else glitch = null;
  }

  function measure() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    const rect = shell!.getBoundingClientRect();
    const left = Math.max(0, Math.floor(rect.left));
    const right = Math.max(0, Math.ceil(width - rect.right));
    margins = [];
    if (left > 0) margins.push([0, 0, left * dpr, height * dpr]);
    if (right > 0) margins.push([(width - right) * dpr, 0, right * dpr, height * dpr]);
    layoutEgg(right);
    // No margins: keep the canvas tiny instead of a full-screen bitmap.
    canvas!.width = margins.length ? Math.round(width * dpr) : 1;
    canvas!.height = margins.length ? Math.round(height * dpr) : 1;
    readStyles();
    paintStill();
  }

  window.addEventListener(MODE_EVENT, (event) => {
    const detail = (event as CustomEvent<ModeWave>).detail;
    if (!detail || detail.mode === mode) return;
    mode = detail.mode;
    if (reducedMotion.matches || !margins.length) {
      waves = [];
      settled = mode;
      paintStill();
      return;
    }
    const reach = Math.max(
      Math.hypot(detail.x, detail.y),
      Math.hypot(width - detail.x, detail.y),
      Math.hypot(detail.x, height - detail.y),
      Math.hypot(width - detail.x, height - detail.y),
    );
    waves.push({ ...detail, reach, painted: 0 });
    if (!raf) raf = requestAnimationFrame(frame);
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measure, 120);
  });

  new MutationObserver(() => {
    readStyles();
    paintStill();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  measure();
  if (glitchEnabled) glitchTimer = window.setTimeout(startGlitch, GLITCH_MIN + Math.random() * (GLITCH_MAX - GLITCH_MIN));
  // Glyph tiles need the mono font.
  document.fonts?.ready.then(() => {
    readStyles();
    paintStill();
  });
}
