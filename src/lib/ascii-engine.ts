import { avatar } from '../data/avatar';
import { arrivalTime, WAVE_WIDTH, WAVE_SPEED, type ModeWave, type RenderMode } from './mode-wave';
import { buildAvatarModel } from './avatar-model';

/**
 * Canvas renderer for the hero avatar.
 *
 * The canvas is a grid of 12×12 "units"; each avatar pixel maps to one
 * unit, drawn as two monospace glyphs (ASCII), a block (Pixel), a
 * halftone dot (Dots), a 4×4 ordered-dither cell (Dither), a 2×4 braille
 * cell (Braille), a plus sign (Cross) or engraved diagonal strokes (Hatch). Units outside
 * the figure form a quiet background in the same style.
 *
 * The pointer carries a lens that eases after it: inside it the figure is
 * drawn in the same style but with each pixel's original colour, with a
 * pixel-dither dissolve at the rim.
 * Around it the current mode's accent effect glows and fades outward
 * (over empty background it fills the lens too), leaving a short trail.
 * Taps send out a ripple.
 *
 * Performance: the still picture of the current mode is cached in an
 * offscreen "base" canvas; a frame copies it and redraws only the units the
 * pointer, lens or ripples are touching (full redraws happen only during
 * mode transitions). Glyphs are rasterised once per character and colour
 * and then blitted. The loop only runs while something is moving.
 */

export type { RenderMode };

// Index = internal mode code used by the drawing functions below.
const MODES: RenderMode[] = ['ascii', 'pixel', 'dots', 'dither', 'braille', 'cross', 'hatch'];
const NONE = -1;

const UNIT = 12;
const HALF = UNIT / 2;
const RAMP = ' .:-=+*#%@';
const NOISE = '01<>/\\[]{}=+*#%@?!';
const SCRAMBLE_MS = 120;
// Pointer lens: original pixels inside LENS_RADIUS, dissolving over LENS_EDGE;
// the mode's accent effect fades out to RING_RADIUS.
const LENS_RADIUS = 56;
const LENS_EDGE = 24;
const RING_RADIUS = 148;
const LENS_FOLLOW = 0.72; // per-frame lag of the lens behind the pointer
const LENS_GROW = 0.8; // per-frame easing of the lens radius
const RIPPLE_SPEED = 0.4;
const RIPPLE_WIDTH = 24;
const RIPPLE_LIFE = 1400;

// Added to a mode code while a unit is inside the wavefront previewing it.
const TINT = 16;
// Older sweeps beyond this are settled at once.
const MAX_SWEEPS = 6;

/** One mode switch in flight: per unit, when its wavefront starts and when the new mode shows. */
interface Sweep {
  mode: number;
  tintAt: Float64Array;
  switchAt: Float64Array;
  end: number;
}

// Faint dark edge around marks drawn in original colours, so pale colours
// (the white cap, the light shirt) stay legible on a light background.
const TINT_OUTLINE = 'rgba(0, 0, 0, 0.16)';

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.trim().replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Text ink for an original colour on a light background: pale colours are
 * pulled toward black in proportion to their lightness, keeping their hue,
 * so thin glyphs stay readable without strokes or shadows.
 */
function deepen(hex: string) {
  const rgb = hexToRgb(hex);
  const amount = Math.min(1, Math.max(0, (relativeLuminance(rgb) - 0.35) / 0.65)) * 0.5;
  const [r, g, b] = rgb.map((c) => Math.round(c * (1 - amount)));
  return `rgb(${r} ${g} ${b})`;
}

// Ordered (Bayer 4×4) dithering: each unit splits into 4×4 sub-pixels of 3px.
const DITHER_CELLS = 4;
const DITHER_SIZE = UNIT / DITHER_CELLS;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// Braille: fill order of the 2×4 dot cell as [column, row], spread evenly.
const BRAILLE_ORDER: [number, number][] = [
  [0, 1], [1, 2], [1, 0], [0, 3], [0, 0], [1, 3], [1, 1], [0, 2],
];

export interface AsciiEngine {
  /** With a wave, the switch follows it (shared with the page backdrop). */
  setMode(mode: RenderMode, wave?: ModeWave): void;
  /** Keeps the background clear in this canvas-relative CSS px rect (e.g. under a button). */
  setReserved(rect: { x: number; y: number; width: number; height: number } | null): void;
  replay(): void;
  destroy(): void;
}

/**
 * `pointerArea` is the element whose hover drives the lens; pass a wrapper
 * when controls overlay the canvas so hovering them keeps the lens open.
 */
export function createAsciiEngine(
  canvas: HTMLCanvasElement,
  initialMode: RenderMode = 'ascii',
  pointerArea: HTMLElement = canvas,
): AsciiEngine {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setMode() {}, setReserved() {}, replay() {}, destroy() {} };

  const model = buildAvatarModel(avatar);

  // Drawing helpers paint into `g`: the visible canvas or the cached base.
  let g: CanvasRenderingContext2D = ctx;
  const base = document.createElement('canvas');
  const baseCtx = base.getContext('2d')!;
  let baseDirty = true;
  let dpr = 1;
  const glyphs = new Map<string, HTMLCanvasElement>();
  const stamps = new Map<string, HTMLCanvasElement>();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let originX = 0;
  let originY = 0;
  let figureRowMin = 0;
  let figureRowMax = 0;

  let tone = new Float32Array(0);
  let accent = new Uint8Array(0);
  let halo = new Uint8Array(0);
  // Units kept clear for overlaid controls.
  let reserved = new Uint8Array(0);
  let reservedRect: { x: number; y: number; width: number; height: number } | null = null;
  let seed = new Uint16Array(0);
  let heat = new Float32Array(0);
  let reveal = new Float32Array(0);
  let colorIndex = new Int16Array(0);
  const palette: string[] = [];
  // Mode each unit shows before the oldest running sweep.
  let from = new Int8Array(0);
  // Mode switches still travelling across the grid, oldest first. Several can
  // overlap when styles change quickly; each keeps going on its own.
  let sweeps: Sweep[] = [];

  let mode = MODES.indexOf(initialMode);
  let colors = { fg: '#000', subtle: '#999', accent: '#669fd0' };
  let font = '500 10px monospace';
  let lightTheme = true;

  const pointer = { x: 0, y: 0, inside: false };
  const lens = { x: 0, y: 0, r: 0 };
  let ripples: { x: number; y: number; t0: number }[] = [];
  let transitionEnd = 0;

  let raf = 0;
  let idleTimer = 0;
  let lastFrame = 0;
  let glitchTimer = 0;
  let visible = true;
  let started = false;
  let destroyed = false;

  function readStyles() {
    const style = getComputedStyle(canvas);
    colors = {
      fg: style.getPropertyValue('--color-fg').trim() || colors.fg,
      subtle: style.getPropertyValue('--color-fg-subtle').trim() || colors.subtle,
      accent: style.getPropertyValue('--color-accent').trim() || colors.accent,
    };
    font = `500 10px ${style.fontFamily || 'monospace'}`;
    lightTheme = relativeLuminance(hexToRgb(colors.fg)) < 0.5;
    deepened.clear();
    glyphs.clear();
    stamps.clear();
    baseDirty = true;
  }

  /** A glyph rasterised once per character and colour, blitted afterwards. */
  function glyphAt(ch: string, left: number, top: number, color: string) {
    g.drawImage(glyph(ch, color), left, top, HALF, UNIT);
  }

  function glyph(ch: string, color: string) {
    const key = `${ch}|${color}`;
    let image = glyphs.get(key);
    if (!image) {
      image = document.createElement('canvas');
      image.width = Math.ceil(HALF * dpr);
      image.height = Math.ceil(UNIT * dpr);
      const c = image.getContext('2d')!;
      c.scale(dpr, dpr);
      c.font = font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = color;
      c.fillText(ch, HALF / 2, HALF);
      glyphs.set(key, image);
    }
    return image;
  }

  const deepened = new Map<string, string>();
  const deepenCached = (hex: string) => {
    let value = deepened.get(hex);
    if (!value) deepened.set(hex, (value = deepen(hex)));
    return value;
  };

  function layout() {
    const rect = canvas.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    if (!width || !height) return false;

    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    if (nextDpr !== dpr) {
      glyphs.clear();
      stamps.clear();
    }
    dpr = nextDpr;
    canvas.width = base.width = Math.round(width * dpr);
    canvas.height = base.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseDirty = true;

    cols = Math.floor(width / UNIT);
    rows = Math.floor(height / UNIT);
    // Centre the grid both ways so the leftover space is split evenly; the
    // figure still stands on the last row.
    originX = (width - cols * UNIT) / 2;
    originY = (height - rows * UNIT) / 2;

    const size = cols * rows;
    tone = new Float32Array(size).fill(-1);
    accent = new Uint8Array(size);
    halo = new Uint8Array(size);
    reserved = new Uint8Array(size);
    seed = new Uint16Array(size);
    heat = new Float32Array(size);
    reveal = new Float32Array(size);
    colorIndex = new Int16Array(size).fill(-1);
    sweeps = [];
    from = new Int8Array(size).fill(mode);
    for (let i = 0; i < size; i++) seed[i] = (Math.random() * 65535) | 0;

    const { x0, x1 } = model.bounds;
    const offsetX = Math.round(cols / 2 - (x0 + x1 + 1) / 2);
    const offsetY = rows - model.height;
    figureRowMin = Infinity;
    figureRowMax = -Infinity;
    for (const cell of model.cells) {
      const c = cell.x + offsetX;
      const r = cell.y + offsetY;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const i = r * cols + c;
      tone[i] = cell.tone;
      accent[i] = cell.accent ? 1 : 0;
      let k = palette.indexOf(cell.color);
      if (k === -1) k = palette.push(cell.color) - 1;
      colorIndex[i] = k;
      figureRowMin = Math.min(figureRowMin, r);
      figureRowMax = Math.max(figureRowMax, r);
    }

    // Keep a one-unit gap of empty field around the silhouette.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (tone[i] >= 0) continue;
        for (let dr = -1; dr <= 1 && !halo[i]; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && tone[rr * cols + cc] >= 0) {
              halo[i] = 1;
              break;
            }
          }
        }
      }
    }
    markReserved();
    return true;
  }

  /** Marks the units that the reserved rect actually overlaps (touching edges don't count). */
  function markReserved() {
    reserved.fill(0);
    if (!reservedRect) return;
    const { x, y, width: w, height: h } = reservedRect;
    for (let r = 0; r < rows; r++) {
      const top = originY + r * UNIT;
      if (top >= y + h || top + UNIT <= y) continue;
      for (let c = 0; c < cols; c++) {
        const left = originX + c * UNIT;
        if (left < x + w && left + UNIT > x) reserved[r * cols + c] = 1;
      }
    }
  }

  const noiseGlyph = (i: number, now: number) => NOISE[(seed[i] + ((now / 70) | 0)) % NOISE.length];

  /**
   * Fills the sub-pixels of the unit at column c, row r whose Bayer
   * threshold is below `density`. The matrix is indexed by absolute
   * sub-pixel position, so neighbouring units form one continuous pattern.
   */
  function ditherUnit(c: number, r: number, density: number, grow = 0) {
    // The 4×4 matrix repeats every unit, so each density level is one stamp.
    const level = Math.min(16, Math.max(0, Math.ceil(density * 16 - 0.5)));
    if (!level) return;
    const color = g.fillStyle as string;
    const key = `${level}|${color}|${grow}`;
    let stamp = stamps.get(key);
    if (!stamp) {
      stamp = document.createElement('canvas');
      const pad = Math.ceil(grow * dpr);
      stamp.width = stamp.height = Math.round(UNIT * dpr) + pad * 2;
      const s2 = stamp.getContext('2d')!;
      s2.fillStyle = color;
      const cell = DITHER_SIZE * dpr;
      const size = cell + grow * 2 * dpr;
      for (let sy = 0; sy < DITHER_CELLS; sy++) {
        for (let sx = 0; sx < DITHER_CELLS; sx++) {
          if (level > BAYER[sy * DITHER_CELLS + sx] * 16 - 0.5) {
            s2.fillRect(pad + sx * cell - grow * dpr, pad + sy * cell - grow * dpr, size, size);
          }
        }
      }
      stamps.set(key, stamp);
    }
    const pad = Math.ceil(grow * dpr) / dpr;
    g.drawImage(stamp, originX + c * UNIT - pad, originY + r * UNIT - pad, UNIT + pad * 2, UNIT + pad * 2);
  }

  /**
   * Braille cell: up to eight dots in a 2×4 grid, lit in a fixed order that
   * spreads them evenly, so `count` reads as density.
   */
  function braille(cx: number, cy: number, count: number, radius = 1.15) {
    for (let k = 0; k < Math.min(8, count); k++) {
      const [col, row] = BRAILLE_ORDER[k];
      g.beginPath();
      g.arc(cx + (col ? 2.5 : -2.5), cy - 4.5 + row * 3, radius, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** Plus sign centred in a unit (Cross): arm half-length `arm`, stroke `stroke`. */
  function plus(cx: number, cy: number, arm: number, stroke: number) {
    g.fillRect(cx - arm, cy - stroke / 2, arm * 2, stroke);
    g.fillRect(cx - stroke / 2, cy - arm, stroke, arm * 2);
  }

  /**
   * Hatch: diagonal strokes clipped to the unit. Lines lie on u + v = k in
   * unit space, so neighbouring units join into continuous engraving lines.
   * Levels: 1 = centre stroke, 2 = two strokes, 3 = two plus a cross stroke.
   */
  function hatch(x: number, y: number, level: number, width = 1) {
    g.lineWidth = width;
    g.beginPath();
    const slash = (k: number) => {
      g.moveTo(x + Math.max(0, k - UNIT), y + Math.min(UNIT, k));
      g.lineTo(x + Math.min(UNIT, k), y + Math.max(0, k - UNIT));
    };
    if (level === 1) slash(UNIT);
    if (level >= 2) {
      slash(UNIT - 3);
      slash(UNIT + 3);
    }
    if (level >= 3) {
      g.moveTo(x, y);
      g.lineTo(x + UNIT, y + UNIT);
    }
    g.stroke();
  }

  /**
   * Quiet background for a unit outside the figure, matched to the mode:
   * ASCII gets faint dots of text, Pixel faint empty pixel slots, Dots a
   * halftone field, Dither a dithered fade toward the floor.
   */
  function drawBackdrop(m: number, i: number, cx: number, cy: number, tint = false) {
    if (halo[i] || reserved[i]) return;
    const c2d = g;
    c2d.fillStyle = tint ? colors.accent : colors.subtle;
    if (m === 1) {
      c2d.globalAlpha = tint ? 0.5 : 0.1;
      c2d.fillRect(cx - HALF + 1, cy - HALF + 1, UNIT - 2, UNIT - 2);
    } else if (m === 0) {
      c2d.globalAlpha = 0.5;
      glyphAt('.', cx - HALF, cy - HALF, c2d.fillStyle as string);
      glyphAt('.', cx, cy - HALF, c2d.fillStyle as string);
    } else if (m === 2) {
      c2d.globalAlpha = 0.9;
      c2d.beginPath();
      c2d.arc(cx, cy, 0.9, 0, Math.PI * 2);
      c2d.fill();
    } else if (m === 4) {
      c2d.globalAlpha = tint ? 0.9 : 0.5;
      braille(cx, cy, tint ? 2 : 1, 0.8);
    } else if (m === 5) {
      c2d.globalAlpha = tint ? 0.9 : 0.4;
      plus(cx, cy, tint ? 2.5 : 1.5, 1);
    } else if (m === 6) {
      c2d.globalAlpha = tint ? 0.9 : 0.3;
      c2d.strokeStyle = c2d.fillStyle;
      c2d.lineWidth = 1;
      c2d.beginPath();
      c2d.moveTo(cx - 2, cy + 2);
      c2d.lineTo(cx + 2, cy - 2);
      c2d.stroke();
    } else {
      const r = (i / cols) | 0;
      const depth = rows > 1 ? r / (rows - 1) : 0;
      c2d.globalAlpha = 0.7;
      ditherUnit(i % cols, r, 0.03 + 0.3 * depth * depth);
    }
  }

  /**
   * Mode a unit currently shows (NONE before the intro reaches it), plus TINT
   * while a wavefront previewing that mode covers it. The newest sweep that
   * has reached the unit wins.
   */
  function shownMode(i: number, now: number) {
    for (let k = sweeps.length - 1; k >= 0; k--) {
      const sweep = sweeps[k];
      if (now >= sweep.switchAt[i]) return sweep.mode;
      if (now >= sweep.tintAt[i]) return sweep.mode + TINT;
    }
    return from[i];
  }

  /** Folds finished sweeps (and any beyond the limit) into `from`. */
  function settle(now: number) {
    while (sweeps.length && (now >= sweeps[0].end || sweeps.length > MAX_SWEEPS)) {
      const sweep = sweeps.shift()!;
      for (let i = 0; i < from.length; i++) if (now >= sweep.switchAt[i]) from[i] = sweep.mode;
    }
  }

  function drawField(i: number, cx: number, cy: number, now: number) {
    if (reserved[i]) return;
    const h = heat[i];
    if (h < 0.04) {
      const m = shownMode(i, now);
      // The wavefront previews the incoming background in the accent colour.
      if (m >= TINT) drawBackdrop(m - TINT, i, cx, cy, true);
      else if (m !== NONE) drawBackdrop(m, i, cx, cy);
      return;
    }
    g.fillStyle = colors.accent;
    g.globalAlpha = Math.min(1, h * 1.1);
    if (mode === 0) {
      glyphAt(noiseGlyph(i, now), cx - HALF / 2, cy - HALF, colors.accent);
    } else if (mode === 1) {
      const s = 2 + h * (UNIT - 4);
      g.fillRect(cx - s / 2, cy - s / 2, s, s);
    } else if (mode === 3) {
      g.globalAlpha = 1;
      ditherUnit(i % cols, (i / cols) | 0, h * 0.9);
    } else if (mode === 4) {
      braille(cx, cy, Math.ceil(h * 8));
    } else if (mode === 5) {
      plus(cx, cy, 1.5 + h * 3.5, 1 + h * 1.5);
    } else if (mode === 6) {
      g.strokeStyle = colors.accent;
      hatch(cx - HALF, cy - HALF, Math.min(3, 1 + Math.floor(h * 3)));
    } else {
      g.beginPath();
      g.arc(cx, cy, 0.8 + h * 4, 0, Math.PI * 2);
      g.fill();
    }
  }

  /**
   * Draws a figure unit in mode `m`. With `tint` (the pixel's original
   * colour, used inside the lens) the same marks are drawn in that colour
   * at full strength, and the accent effect is left out.
   */
  function drawFigure(m: number, i: number, x: number, y: number, now: number, tint?: string, still = false) {
    const t = tone[i];
    const isAccent = accent[i] === 1;
    const h = tint || still ? 0 : heat[i];
    const ink = tint ?? (isAccent ? colors.accent : colors.fg);
    const cx = x + HALF;
    const cy = y + HALF;

    if (m === 0) {
      let left: string;
      let right: string;
      if (h > 0.3) {
        left = noiseGlyph(i, now);
        right = noiseGlyph(i + 7, now);
        g.fillStyle = colors.accent;
        g.globalAlpha = 1;
      } else {
        // Inside the lens, denser glyphs let the colour read.
        const level = tint ? 6 + Math.round(t * 3) : 1 + Math.round(t * 8);
        const jitter = (seed[i] % 3) - 1;
        left = RAMP[level];
        right = RAMP[Math.min(9, Math.max(1, level + jitter))];
        g.fillStyle = ink;
        g.globalAlpha = tint ? 1 : 0.55 + 0.45 * t;
      }
      if (tint && lightTheme) g.fillStyle = deepenCached(tint);
      const color = g.fillStyle as string;
      glyphAt(left, x, cy - HALF, color);
      glyphAt(right, x + HALF, cy - HALF, color);
      return;
    }

    if (m === 1) {
      g.fillStyle = ink;
      g.globalAlpha = tint ? 1 : isAccent ? t : 0.12 + 0.88 * t;
      g.fillRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
      if (tint) {
        g.strokeStyle = TINT_OUTLINE;
        g.lineWidth = 1;
        g.strokeRect(x + 1.5, y + 1.5, UNIT - 3, UNIT - 3);
      }
      if (h > 0.02) {
        g.fillStyle = colors.accent;
        g.globalAlpha = h * 0.85;
        g.fillRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
      }
      return;
    }

    if (m === 3) {
      // 1-bit look: full-strength colour, tone carried by sub-pixel density.
      const c = i % cols;
      const r = (i / cols) | 0;
      g.globalAlpha = 1;
      const density = isAccent ? 0.35 + 0.65 * t : t;
      if (tint) {
        g.fillStyle = TINT_OUTLINE;
        ditherUnit(c, r, density, 0.5);
      }
      g.fillStyle = ink;
      ditherUnit(c, r, density);
      if (h > 0.02) {
        g.fillStyle = colors.accent;
        ditherUnit(c, r, h);
      }
      return;
    }

    if (m === 4) {
      // Darker pixels light more of the eight dots.
      const count = Math.max(1, Math.round(t * 8));
      g.fillStyle = tint && lightTheme ? deepenCached(tint) : ink;
      g.globalAlpha = tint ? 1 : isAccent ? 0.6 + 0.4 * t : 0.5 + 0.5 * t;
      braille(cx, cy, count);
      if (h > 0.02) {
        g.fillStyle = colors.accent;
        g.globalAlpha = h;
        braille(cx, cy, Math.ceil(h * 8));
      }
      return;
    }

    if (m === 5) {
      // Darker pixels get larger, heavier crosses.
      g.fillStyle = tint && lightTheme ? deepenCached(tint) : ink;
      g.globalAlpha = tint ? 1 : isAccent ? t : 0.35 + 0.65 * t;
      plus(cx, cy, 2 + t * 3.5, 1 + t * 2);
      if (h > 0.02) {
        g.fillStyle = colors.accent;
        g.globalAlpha = h;
        plus(cx, cy, 2 + h * 3.5, 1 + h * 2);
      }
      return;
    }

    if (m === 6) {
      // Light pixels: one stroke; mid: two; dark: two plus a cross stroke.
      const level = t < 0.4 ? 1 : t < 0.75 ? 2 : 3;
      g.strokeStyle = tint && lightTheme ? deepenCached(tint) : ink;
      g.globalAlpha = tint ? 1 : isAccent ? 0.6 + 0.4 * t : 0.45 + 0.55 * t;
      hatch(x, y, level, tint ? 1.4 : 1);
      if (h > 0.02) {
        g.strokeStyle = colors.accent;
        g.globalAlpha = h;
        hatch(x, y, Math.min(3, 1 + Math.floor(h * 3)), 1.2);
      }
      return;
    }

    const radius = Math.min(HALF - 0.5, 1.4 + t * 4.2 + h * 1.5);
    g.fillStyle = tint ?? (isAccent || h > 0.3 ? colors.accent : colors.fg);
    g.globalAlpha = tint ? 1 : isAccent ? t : 0.3 + 0.7 * t;
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.fill();
    if (tint) {
      g.strokeStyle = TINT_OUTLINE;
      g.lineWidth = 1;
      g.stroke();
    }
  }

  /** Unit-level ordered dither: the lens rim dissolves pixel by pixel. */
  function revealed(i: number, c: number, r: number) {
    return reveal[i] > 0 && reveal[i] > BAYER[(r & 3) * DITHER_CELLS + (c & 3)];
  }

  /** Paints every unit into `g`; `still` leaves out pointer and ripple effects. */
  function drawAll(now: number, still: boolean) {
    for (let r = 0; r < rows; r++) {
      const y = originY + r * UNIT;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = originX + c * UNIT;
        if (tone[i] < 0) {
          if (still) drawBackdrop(mode, i, x + HALF, y + HALF);
          else drawField(i, x + HALF, y + HALF, now);
          continue;
        }
        if (still) {
          drawFigure(mode, i, x, y, now, undefined, true);
          continue;
        }
        if (revealed(i, c, r)) {
          drawFigure(mode, i, x, y, now, palette[colorIndex[i]]);
          continue;
        }
        const m = shownMode(i, now);
        if (m >= TINT) {
          g.globalAlpha = 1;
          glyphAt(noiseGlyph(i, now), x, y, colors.accent);
          glyphAt(noiseGlyph(i + 3, now), x + HALF, y, colors.accent);
        } else if (m !== NONE) {
          drawFigure(m, i, x, y, now);
        }
      }
    }
    g.globalAlpha = 1;
  }

  /** Caches the still picture of the current mode. */
  function buildBase(now: number) {
    g = baseCtx;
    baseCtx.clearRect(0, 0, width, height);
    drawAll(now, true);
    g = ctx!;
    baseDirty = false;
    // Warm the glyphs the pointer effects use, so the first hover does not stutter.
    for (const ch of NOISE) glyph(ch, colors.accent);
  }

  function draw(now: number) {
    const c2d = ctx!;
    g = c2d;

    // Mode changes and glitches touch many units: draw everything.
    if (now < transitionEnd) {
      c2d.clearRect(0, 0, width, height);
      drawAll(now, false);
      baseDirty = true;
      return;
    }

    if (baseDirty) buildBase(now);
    c2d.save();
    c2d.setTransform(1, 0, 0, 1, 0, 0);
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    c2d.drawImage(base, 0, 0);
    c2d.restore();

    // Redraw only the units the pointer, lens or ripples are affecting.
    for (let r = 0; r < rows; r++) {
      const y = originY + r * UNIT;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const h = heat[i];
        const isField = tone[i] < 0;
        if (isField ? h < 0.04 : h <= 0.02 && reveal[i] === 0) continue;
        const x = originX + c * UNIT;
        c2d.clearRect(x, y, UNIT, UNIT);
        if (isField) drawField(i, x + HALF, y + HALF, now);
        else if (revealed(i, c, r)) drawFigure(mode, i, x, y, now, palette[colorIndex[i]]);
        else drawFigure(mode, i, x, y, now);
      }
    }
    c2d.globalAlpha = 1;
  }

  function addHeat(px: number, py: number, radius: number, strength: (d: number) => number) {
    addTo(heat, px, py, radius, strength);
  }

  /** Raises `target` around (px, py) to strength(distance), never lowering it. */
  function addTo(target: Float32Array, px: number, py: number, radius: number, strength: (d: number) => number) {
    const c0 = Math.max(0, Math.floor((px - radius - originX) / UNIT));
    const c1 = Math.min(cols - 1, Math.ceil((px + radius - originX) / UNIT));
    const r0 = Math.max(0, Math.floor((py - radius - originY) / UNIT));
    const r1 = Math.min(rows - 1, Math.ceil((py + radius - originY) / UNIT));
    for (let r = r0; r <= r1; r++) {
      const cy = originY + r * UNIT + HALF;
      for (let c = c0; c <= c1; c++) {
        const cx = originX + c * UNIT + HALF;
        const v = strength(Math.hypot(cx - px, cy - py));
        if (v > 0) {
          const i = r * cols + c;
          if (v > target[i]) target[i] = v;
        }
      }
    }
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(64, now - lastFrame || 16);
    lastFrame = now;
    settle(now);

    let active = now < transitionEnd;
    let heatBefore = 0;
    const decay = Math.pow(0.88, dt / 16.67);
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] === 0) continue;
      heatBefore += heat[i];
      heat[i] *= decay;
      if (heat[i] < 0.01) heat[i] = 0;
      else active = true;
    }
    const lensBefore = lens.x + lens.y + lens.r;

    // The lens eases after the pointer, opens on enter and closes on leave.
    const follow = 1 - Math.pow(LENS_FOLLOW, dt / 16.67);
    const grow = 1 - Math.pow(LENS_GROW, dt / 16.67);
    const targetR = pointer.inside ? LENS_RADIUS : 0;
    if (pointer.inside) {
      if (lens.r < 1) {
        lens.x = pointer.x;
        lens.y = pointer.y;
      }
      lens.x += (pointer.x - lens.x) * follow;
      lens.y += (pointer.y - lens.y) * follow;
    }
    lens.r += (targetR - lens.r) * grow;
    if (Math.abs(targetR - lens.r) < 0.3) lens.r = targetR;

    reveal.fill(0);
    if (lens.r > 0.5) {
      active = true;
      // 1 inside the rim, falling to 0 across LENS_EDGE (dithered when drawn).
      addTo(reveal, lens.x, lens.y, lens.r + LENS_EDGE / 2, (d) =>
        Math.min(1, Math.max(0, (lens.r + LENS_EDGE / 2 - d) / LENS_EDGE)),
      );
      // Accent effect: strongest at the centre (shows over empty background),
      // fading outward; scaled by how open the lens is.
      const strength = lens.r / LENS_RADIUS;
      addHeat(lens.x, lens.y, RING_RADIUS, (d) => (d < RING_RADIUS ? strength * (1 - d / RING_RADIUS) ** 1.4 : 0));
    }

    ripples = ripples.filter((ripple) => now - ripple.t0 < RIPPLE_LIFE);
    for (const ripple of ripples) {
      active = true;
      const age = now - ripple.t0;
      const ring = age * RIPPLE_SPEED;
      const fade = 1 - age / RIPPLE_LIFE;
      addHeat(ripple.x, ripple.y, ring + RIPPLE_WIDTH, (d) => {
        const off = Math.abs(d - ring);
        return off < RIPPLE_WIDTH ? (1 - off / RIPPLE_WIDTH) * fade : 0;
      });
    }

    draw(now);
    if (!active) return;

    // A resting pointer reaches a steady state: stop repainting every frame.
    let heatAfter = 0;
    for (let i = 0; i < heat.length; i++) heatAfter += heat[i];
    const settled =
      now >= transitionEnd &&
      ripples.length === 0 &&
      Math.abs(lens.x + lens.y + lens.r - lensBefore) < 0.05 &&
      Math.abs(heatAfter - heatBefore) < 0.05;
    if (!settled) kick();
    // ASCII noise glyphs still flicker, at their own 70ms rate.
    else if (mode === 0) idleTimer = window.setTimeout(kick, 70);
  }

  function kick() {
    window.clearTimeout(idleTimer);
    if (raf || !visible || destroyed) return;
    raf = requestAnimationFrame(frame);
  }

  function transition(next: number, kind: 'intro' | 'switch', wave?: ModeWave) {
    const now = performance.now();
    settle(now);

    if (reducedMotion.matches) {
      sweeps = [];
      from.fill(next);
      mode = next;
      draw(now);
      return;
    }

    if (kind === 'intro') {
      // The figure assembles from nothing; the background is already there.
      sweeps = [];
      for (let i = 0; i < tone.length; i++) from[i] = tone[i] < 0 ? next : NONE;
    }

    // Distances to the wave origin are measured in viewport pixels, so this
    // canvas and the page backdrop switch along the same circle.
    const rect = canvas.getBoundingClientRect();
    const origin = wave ?? {
      x: rect.left + width / 2,
      y: rect.top + originY + ((figureRowMin + figureRowMax) / 2) * UNIT,
      t0: now,
    };
    const distance = (i: number) =>
      Math.hypot(
        rect.left + originX + (i % cols) * UNIT + HALF - origin.x,
        rect.top + originY + ((i / cols) | 0) * UNIT + HALF - origin.y,
      );
    const waveOf = { mode: MODES[next], ...origin } as ModeWave;
    const band = WAVE_WIDTH / WAVE_SPEED;
    const sweep: Sweep = {
      mode: next,
      tintAt: new Float64Array(tone.length),
      switchAt: new Float64Array(tone.length),
      end: now,
    };

    for (let i = 0; i < tone.length; i++) {
      if (tone[i] < 0) {
        // Background units: the accent band passes, then the new style.
        if (kind === 'intro') continue;
        sweep.tintAt[i] = arrivalTime(waveOf, distance(i));
        sweep.switchAt[i] = sweep.tintAt[i] + band;
      } else {
        if (kind === 'intro') {
          const r = (i / cols) | 0;
          sweep.switchAt[i] = now + SCRAMBLE_MS + (r - figureRowMin) * 18 + Math.random() * 320;
        } else {
          // Figure units scramble as the same front reaches them.
          sweep.switchAt[i] = arrivalTime(waveOf, distance(i)) + SCRAMBLE_MS + Math.random() * 60;
        }
        sweep.tintAt[i] = sweep.switchAt[i] - SCRAMBLE_MS;
      }
      sweep.end = Math.max(sweep.end, sweep.switchAt[i]);
    }
    sweeps.push(sweep);
    mode = next;
    transitionEnd = Math.max(transitionEnd, sweep.end);
    kick();
  }

  function glitch() {
    window.clearTimeout(glitchTimer);
    if (destroyed) return;
    glitchTimer = window.setTimeout(glitch, 2400 + Math.random() * 3200);
    const now = performance.now();
    if (!visible || reducedMotion.matches || now < transitionEnd || !Number.isFinite(figureRowMin)) return;

    // A short scramble back into the same mode, as a sweep over two rows.
    const sweep: Sweep = { mode, tintAt: new Float64Array(tone.length), switchAt: new Float64Array(tone.length), end: now };
    const row = figureRowMin + Math.floor(Math.random() * (figureRowMax - figureRowMin + 1));
    for (let r = row; r <= Math.min(figureRowMax, row + 1); r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (tone[i] < 0) continue;
        sweep.switchAt[i] = now + SCRAMBLE_MS + c * 8 + Math.random() * 60;
        sweep.tintAt[i] = sweep.switchAt[i] - SCRAMBLE_MS;
        sweep.end = Math.max(sweep.end, sweep.switchAt[i]);
      }
    }
    sweeps.push(sweep);
    transitionEnd = Math.max(transitionEnd, sweep.end);
    kick();
  }

  // Events
  const toLocal = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onMove = (event: PointerEvent) => {
    const p = toLocal(event);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.inside = true;
    kick();
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  const onDown = (event: PointerEvent) => {
    const p = toLocal(event);
    ripples.push({ ...p, t0: performance.now() });
    if (ripples.length > 4) ripples.shift();
    kick();
  };

  pointerArea.addEventListener('pointermove', onMove);
  pointerArea.addEventListener('pointerleave', onLeave);
  pointerArea.addEventListener('pointercancel', onLeave);
  canvas.addEventListener('pointerdown', onDown);

  const resizeObserver = new ResizeObserver(() => {
    if (!layout()) return;
    if (!started) return;
    draw(performance.now());
  });
  resizeObserver.observe(canvas);

  const themeObserver = new MutationObserver(() => {
    readStyles();
    draw(performance.now());
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && document.visibilityState === 'visible';
    if (visible) kick();
  });
  visibilityObserver.observe(canvas);

  const onVisibility = () => {
    visible = document.visibilityState === 'visible';
    if (visible) kick();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Start once the mono font is ready so the first frame has real glyphs.
  readStyles();
  const fontReady = document.fonts?.load(font).catch(() => undefined) ?? Promise.resolve();
  Promise.race([fontReady, new Promise((resolve) => setTimeout(resolve, 800))]).then(() => {
    if (destroyed) return;
    readStyles();
    layout();
    started = true;
    transition(mode, 'intro');
    glitchTimer = window.setTimeout(glitch, 3000);
  });

  return {
    setMode(next, wave) {
      const index = MODES.indexOf(next);
      if (index === -1 || index === mode) return;
      transition(index, 'switch', wave);
    },
    setReserved(rect) {
      reservedRect = rect;
      markReserved();
      baseDirty = true;
      if (started) draw(performance.now());
    },
    replay() {
      transition(mode, 'intro');
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(glitchTimer);
      window.clearTimeout(idleTimer);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      pointerArea.removeEventListener('pointermove', onMove);
      pointerArea.removeEventListener('pointerleave', onLeave);
      pointerArea.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
    },
  };
}
