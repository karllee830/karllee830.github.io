import { avatar } from '../data/avatar';
import { buildAvatarModel } from './avatar-model';

/**
 * Canvas renderer for the hero avatar.
 *
 * The canvas is a grid of 12×12 "units"; each avatar pixel maps to one
 * unit, drawn as two monospace glyphs (ASCII), a block (Pixel), a
 * halftone dot (Dots) or a 4×4 ordered-dither cell (Dither). Units outside the figure form a quiet dot field
 * that lights up around the pointer and on tap ripples.
 *
 * The loop only runs while something is moving, so an idle hero costs
 * nothing.
 */

export type RenderMode = 'ascii' | 'pixel' | 'dots' | 'dither';

const MODES: RenderMode[] = ['ascii', 'pixel', 'dots', 'dither'];
const NONE = -1;

const UNIT = 12;
const HALF = UNIT / 2;
const RAMP = ' .:-=+*#%@';
const NOISE = '01<>/\\[]{}=+*#%@?!';
const SCRAMBLE_MS = 120;
const POINTER_RADIUS = 84;
const RIPPLE_SPEED = 0.4;
const RIPPLE_WIDTH = 24;
const RIPPLE_LIFE = 1400;

// Ordered (Bayer 4×4) dithering: each unit splits into 4×4 sub-pixels of 3px.
const DITHER_CELLS = 4;
const DITHER_SIZE = UNIT / DITHER_CELLS;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export interface AsciiEngine {
  setMode(mode: RenderMode): void;
  replay(): void;
  destroy(): void;
}

export function createAsciiEngine(canvas: HTMLCanvasElement, initialMode: RenderMode = 'ascii'): AsciiEngine {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setMode() {}, replay() {}, destroy() {} };

  const model = buildAvatarModel(avatar);
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
  let seed = new Uint16Array(0);
  let heat = new Float32Array(0);
  let switchAt = new Float64Array(0);
  let from = new Int8Array(0);

  let mode = MODES.indexOf(initialMode);
  let colors = { fg: '#000', subtle: '#999', accent: '#669fd0' };
  let font = '500 10px monospace';

  const pointer = { x: 0, y: 0, inside: false };
  let ripples: { x: number; y: number; t0: number }[] = [];
  let transitionEnd = 0;

  let raf = 0;
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
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    if (!width || !height) return false;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.floor(width / UNIT);
    rows = Math.floor(height / UNIT);
    originX = (width - cols * UNIT) / 2;
    // Bottom-aligned so the figure stands on the lower edge.
    originY = height - rows * UNIT;

    const size = cols * rows;
    tone = new Float32Array(size).fill(-1);
    accent = new Uint8Array(size);
    halo = new Uint8Array(size);
    seed = new Uint16Array(size);
    heat = new Float32Array(size);
    switchAt = new Float64Array(size);
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
    return true;
  }

  const noiseGlyph = (i: number, now: number) => NOISE[(seed[i] + ((now / 70) | 0)) % NOISE.length];

  /**
   * Fills the sub-pixels of the unit at column c, row r whose Bayer
   * threshold is below `density`. The matrix is indexed by absolute
   * sub-pixel position, so neighbouring units form one continuous pattern.
   */
  function ditherUnit(c: number, r: number, density: number) {
    const x = originX + c * UNIT;
    const y = originY + r * UNIT;
    for (let sy = 0; sy < DITHER_CELLS; sy++) {
      for (let sx = 0; sx < DITHER_CELLS; sx++) {
        if (density > BAYER[sy * DITHER_CELLS + sx]) {
          ctx!.fillRect(x + sx * DITHER_SIZE, y + sy * DITHER_SIZE, DITHER_SIZE, DITHER_SIZE);
        }
      }
    }
  }

  function drawField(i: number, cx: number, cy: number, now: number) {
    const h = heat[i];
    if (h < 0.04) {
      if (halo[i]) return;
      ctx!.globalAlpha = 0.9;
      ctx!.fillStyle = colors.subtle;
      ctx!.fillRect(cx - 0.75, cy - 0.75, 1.5, 1.5);
      return;
    }
    ctx!.fillStyle = colors.accent;
    ctx!.globalAlpha = Math.min(1, h * 1.1);
    if (mode === 0) {
      ctx!.fillText(noiseGlyph(i, now), cx, cy);
    } else if (mode === 1) {
      const s = 2 + h * (UNIT - 4);
      ctx!.fillRect(cx - s / 2, cy - s / 2, s, s);
    } else if (mode === 3) {
      ctx!.globalAlpha = 1;
      ditherUnit(i % cols, (i / cols) | 0, h * 0.9);
    } else {
      ctx!.beginPath();
      ctx!.arc(cx, cy, 0.8 + h * 4, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function drawFigure(m: number, i: number, x: number, y: number, now: number) {
    const t = tone[i];
    const isAccent = accent[i] === 1;
    const h = heat[i];
    const cx = x + HALF;
    const cy = y + HALF;

    if (m === 0) {
      let left: string;
      let right: string;
      if (h > 0.3) {
        left = noiseGlyph(i, now);
        right = noiseGlyph(i + 7, now);
        ctx!.fillStyle = colors.accent;
        ctx!.globalAlpha = 1;
      } else {
        const g = 1 + Math.round(t * 8);
        const jitter = (seed[i] % 3) - 1;
        left = RAMP[g];
        right = RAMP[Math.min(9, Math.max(1, g + jitter))];
        ctx!.fillStyle = isAccent ? colors.accent : colors.fg;
        ctx!.globalAlpha = 0.55 + 0.45 * t;
      }
      ctx!.fillText(left, x + 3, cy);
      ctx!.fillText(right, x + 9, cy);
      return;
    }

    if (m === 1) {
      ctx!.fillStyle = isAccent ? colors.accent : colors.fg;
      ctx!.globalAlpha = isAccent ? t : 0.12 + 0.88 * t;
      ctx!.fillRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
      if (h > 0.02) {
        ctx!.fillStyle = colors.accent;
        ctx!.globalAlpha = h * 0.85;
        ctx!.fillRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
      }
      return;
    }

    if (m === 3) {
      // 1-bit look: full-strength colour, tone carried by sub-pixel density.
      const c = i % cols;
      const r = (i / cols) | 0;
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = isAccent ? colors.accent : colors.fg;
      ditherUnit(c, r, isAccent ? 0.35 + 0.65 * t : t);
      if (h > 0.02) {
        ctx!.fillStyle = colors.accent;
        ditherUnit(c, r, h);
      }
      return;
    }

    const radius = Math.min(HALF - 0.5, 1.4 + t * 4.2 + h * 1.5);
    ctx!.fillStyle = isAccent || h > 0.3 ? colors.accent : colors.fg;
    ctx!.globalAlpha = isAccent ? t : 0.3 + 0.7 * t;
    ctx!.beginPath();
    ctx!.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx!.fill();
  }

  function draw(now: number) {
    const c2d = ctx!;
    c2d.clearRect(0, 0, width, height);
    c2d.font = font;
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';

    for (let r = 0; r < rows; r++) {
      const y = originY + r * UNIT;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = originX + c * UNIT;
        if (tone[i] < 0) {
          drawField(i, x + HALF, y + HALF, now);
          continue;
        }
        const at = switchAt[i];
        if (now < at - SCRAMBLE_MS) {
          if (from[i] !== NONE) drawFigure(from[i], i, x, y, now);
        } else if (now < at) {
          c2d.fillStyle = colors.accent;
          c2d.globalAlpha = 1;
          c2d.fillText(noiseGlyph(i, now), x + 3, y + HALF);
          c2d.fillText(noiseGlyph(i + 3, now), x + 9, y + HALF);
        } else {
          drawFigure(mode, i, x, y, now);
        }
      }
    }
    c2d.globalAlpha = 1;
  }

  function addHeat(px: number, py: number, radius: number, strength: (d: number) => number) {
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
          if (v > heat[i]) heat[i] = v;
        }
      }
    }
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(64, now - lastFrame || 16);
    lastFrame = now;

    let active = now < transitionEnd;
    const decay = Math.pow(0.88, dt / 16.67);
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] === 0) continue;
      heat[i] *= decay;
      if (heat[i] < 0.01) heat[i] = 0;
      else active = true;
    }

    if (pointer.inside) {
      active = true;
      addHeat(pointer.x, pointer.y, POINTER_RADIUS, (d) =>
        d < POINTER_RADIUS ? (1 - d / POINTER_RADIUS) ** 1.6 : 0,
      );
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
    if (active) kick();
  }

  function kick() {
    if (raf || !visible || destroyed) return;
    raf = requestAnimationFrame(frame);
  }

  function transition(next: number, kind: 'intro' | 'switch') {
    const now = performance.now();
    const instant = reducedMotion.matches;
    let end = now;
    for (let i = 0; i < tone.length; i++) {
      if (tone[i] < 0) continue;
      const shown = now >= switchAt[i] ? mode : from[i];
      from[i] = kind === 'intro' ? NONE : shown;
      if (instant) {
        switchAt[i] = 0;
        continue;
      }
      const r = (i / cols) | 0;
      const c = i % cols;
      const delay =
        kind === 'intro'
          ? (r - figureRowMin) * 18 + Math.random() * 320
          : c * 4 + (r - figureRowMin) * 6 + Math.random() * 140;
      switchAt[i] = now + SCRAMBLE_MS + delay;
      end = Math.max(end, switchAt[i]);
    }
    mode = next;
    transitionEnd = end;
    if (instant) draw(now);
    kick();
  }

  function glitch() {
    window.clearTimeout(glitchTimer);
    if (destroyed) return;
    glitchTimer = window.setTimeout(glitch, 2400 + Math.random() * 3200);
    const now = performance.now();
    if (!visible || reducedMotion.matches || now < transitionEnd || !Number.isFinite(figureRowMin)) return;

    const row = figureRowMin + Math.floor(Math.random() * (figureRowMax - figureRowMin + 1));
    for (let r = row; r <= Math.min(figureRowMax, row + 1); r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (tone[i] < 0) continue;
        from[i] = mode;
        switchAt[i] = now + SCRAMBLE_MS + c * 8 + Math.random() * 60;
        transitionEnd = Math.max(transitionEnd, switchAt[i]);
      }
    }
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

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave);
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
    setMode(next) {
      const index = MODES.indexOf(next);
      if (index === -1 || index === mode) return;
      transition(index, 'switch');
    },
    replay() {
      transition(mode, 'intro');
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(glitchTimer);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
    },
  };
}
