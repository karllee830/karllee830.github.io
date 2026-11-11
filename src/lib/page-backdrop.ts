/**
 * Page background in the style of the hero's current render mode, shown
 * only in the margins outside the page frame: sparse dots of text (ASCII),
 * faint pixel blocks (Pixel), a halftone field (Dots) or a dithered fade
 * toward the bottom of the screen (Dither).
 *
 * Each style is a small tile repeated as a canvas pattern. When the hero
 * switches modes it dispatches `avatar:mode` with a shared wave
 * (src/lib/mode-wave.ts); the new texture spreads with that wave,
 * continuing the ripple from the hero card.
 *
 * Performance: everything is clipped to the margins (nothing is drawn when
 * there are none, as on phones); during a wave each frame repaints only
 * the ring that changed since the previous frame; otherwise nothing redraws.
 */

import { MODE_EVENT, WAVE_SPEED, WAVE_WIDTH, readStoredMode, type ModeWave, type RenderMode } from './mode-wave';

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

  let wave: (ModeWave & { from: RenderMode; reach: number; painted: number }) | null = null;
  let raf = 0;

  function readStyles() {
    const root = getComputedStyle(document.documentElement);
    colors = {
      subtle: root.getPropertyValue('--color-fg-subtle').trim() || colors.subtle,
      accent: root.getPropertyValue('--color-accent').trim() || colors.accent,
    };
    font = `500 ${10 * dpr}px ${getComputedStyle(canvas!).fontFamily || 'monospace'}`;
    patterns.clear();
  }

  /** One tile of a style, drawn in device pixels and repeated. */
  function tile(m: RenderMode, tint: boolean, level = 0): CanvasPattern {
    const key = `${m}:${tint}:${level}`;
    const cached = patterns.get(key);
    if (cached) return cached;

    const size = (m === 'pixel' ? PIXEL_TILE : TILE) * dpr;
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
    fillStyle(mode);
    c2d.restore();
  }

  /** Repaints only the ring between last frame's settled edge and the new front. */
  function paintWave(now: number) {
    if (!wave) return;
    const c2d = ctx!;
    const radius = Math.max(0, (now - wave.t0) * WAVE_SPEED);
    const inner = Math.max(0, radius - WAVE_WIDTH);
    const x = wave.x * dpr;
    const y = wave.y * dpr;

    if (margins.length) {
      c2d.save();
      clipToMargins();
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
      fillStyle(mode);
      c2d.restore();

      // Accent band at the front.
      c2d.beginPath();
      c2d.arc(x, y, radius * dpr, 0, Math.PI * 2);
      c2d.arc(x, y, inner * dpr, 0, Math.PI * 2);
      c2d.clip('evenodd');
      fillStyle(mode, true);
      c2d.restore();
    }

    wave.painted = inner;
    if (inner >= wave.reach) {
      wave = null;
      paintStill();
    }
  }

  function frame(now: number) {
    raf = 0;
    paintWave(now);
    if (wave) raf = requestAnimationFrame(frame);
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
    // No margins: keep the canvas tiny instead of a full-screen bitmap.
    canvas!.width = margins.length ? Math.round(width * dpr) : 1;
    canvas!.height = margins.length ? Math.round(height * dpr) : 1;
    readStyles();
    paintStill();
  }

  window.addEventListener(MODE_EVENT, (event) => {
    const detail = (event as CustomEvent<ModeWave>).detail;
    if (!detail || detail.mode === mode) return;
    const from = mode;
    mode = detail.mode;
    if (reducedMotion.matches || !margins.length) {
      wave = null;
      paintStill();
      return;
    }
    const reach = Math.max(
      Math.hypot(detail.x, detail.y),
      Math.hypot(width - detail.x, detail.y),
      Math.hypot(detail.x, height - detail.y),
      Math.hypot(width - detail.x, height - detail.y),
    );
    wave = { ...detail, from, reach, painted: 0 };
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
  // Glyph tiles need the mono font.
  document.fonts?.ready.then(() => {
    readStyles();
    paintStill();
  });
}
