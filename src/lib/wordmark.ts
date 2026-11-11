/**
 * Footer pixel wordmark on a canvas, drawn in the hero's current render
 * style (glyphs, blocks, dots, dither, crosses, braille or hatch).
 *
 * - Hovered cells light in the accent colour and fade over FADE_MS.
 * - A self-driving snake roams the visible rows, eating lit cells (BFS
 *   around its own body); the cells it leaves fade like a hover trail.
 * - On a mode change the shared wave (src/lib/mode-wave.ts) sweeps through:
 *   its accent band lights each cell as it passes (faintly on empty cells),
 *   and the cell takes the new style once the band has gone by, in step
 *   with the hero card and the page margins.
 *
 * Nothing redraws unless the snake moves, a trail is fading or a wave is
 * passing; everything pauses while the wordmark is off screen. Reduced
 * motion keeps the snake still and switches styles instantly.
 */

import {
  MODE_EVENT,
  WAVE_SPEED,
  WAVE_WIDTH,
  arrivalTime,
  readStoredMode,
  type ModeWave,
  type RenderMode,
} from './mode-wave';
import { drawMark } from './mode-marks';

const FADE_MS = 1600;
const TICK_MS = 90;
const MIN_LENGTH = 6;
const MAX_LENGTH = 18;

function start(root: HTMLElement) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  const cols = Number(root.dataset.cols);
  const rows = Number(root.dataset.rows);
  const snakeRows = Number(root.dataset.snakeRows);
  const pattern = root.dataset.lit ?? '';
  if (!canvas || !ctx || !cols || !rows) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lit = Uint8Array.from(pattern, (ch) => (ch === '1' ? 1 : 0));
  const glowAt = new Float64Array(cols * rows).fill(-Infinity);
  const glowPeak = new Float32Array(cols * rows);
  let mode = readStoredMode();
  // Waves still passing, oldest first, each with per-cell times for when its
  // accent band arrives and when it has passed. Quick switches overlap: the
  // newest wave that has reached a cell wins.
  let sweeps: { mode: RenderMode; bandAt: Float64Array; switchAt: Float64Array; end: number }[] = [];
  /** Style shown where no running wave has reached yet. */
  let settled = mode;
  let transitionEnd = 0;

  /** A cell's style now, and whether a wave's accent band is on it. */
  function styleAt(i: number, now: number): [RenderMode, boolean] {
    for (let k = sweeps.length - 1; k >= 0; k--) {
      const sweep = sweeps[k];
      if (now >= sweep.switchAt[i]) return [sweep.mode, false];
      if (now >= sweep.bandAt[i]) return [sweep.mode, true];
    }
    return [settled, false];
  }

  let cell = 0;
  let dpr = 1;
  let colors = { mark: '#eeeeee', accent: '#669fd0', soft: 'rgba(102,159,208,.16)', fg: '#0a0a0a' };
  let fontFamily = 'monospace';

  // Snake state
  const snakeEnabled = root.dataset.snake !== undefined && !reducedMotion;
  const food = { index: -1 };
  let body: number[] = [];
  const bodySet = new Set<number>();
  let length = MIN_LENGTH;
  let path: number[] = [];
  const litCells: number[] = [];
  for (let i = 0; i < lit.length; i++) if (lit[i] && Math.floor(i / cols) < snakeRows) litCells.push(i);

  let visible = false;
  let raf = 0;
  let tickTimer = 0;

  function readStyles() {
    const style = getComputedStyle(root);
    colors = {
      mark: style.getPropertyValue('--color-wordmark').trim() || colors.mark,
      accent: style.getPropertyValue('--color-accent').trim() || colors.accent,
      soft: style.getPropertyValue('--color-accent-soft').trim() || colors.soft,
      fg: style.getPropertyValue('--color-fg').trim() || colors.fg,
    };
    fontFamily = getComputedStyle(canvas!).fontFamily || 'monospace';
  }

  function resize() {
    const width = canvas!.getBoundingClientRect().width;
    if (!width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cell = width / cols;
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(cell * rows * dpr);
    canvas!.style.height = `${cell * rows}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const mark = (m: RenderMode, x: number, y: number, s: number) => drawMark(ctx!, m, x, y, s, fontFamily);

  function render(now: number) {
    const c = ctx!;
    const s = cell;
    c.clearRect(0, 0, cols * s, rows * s);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let animating = now < transitionEnd;

    for (let i = 0; i < lit.length; i++) {
      const x = (i % cols) * s;
      const y = Math.floor(i / cols) * s;
      const [m, inBand] = styleAt(i, now);
      const glow = glowPeak[i] * Math.max(0, 1 - (now - glowAt[i]) / FADE_MS);
      if (glow > 0) animating = true;

      // Inside the wave's band: preview the new style in the accent colour.
      if (inBand) {
        c.fillStyle = colors.accent;
        c.globalAlpha = lit[i] || bodySet.has(i) ? 0.9 : 0.3;
        mark(m, x, y, s);
        continue;
      }

      if (i === food.index) {
        c.fillStyle = colors.fg;
        c.globalAlpha = Math.floor(now / 320) % 2 ? 1 : 0.25;
        mark(m, x, y, s);
        continue;
      }
      if (bodySet.has(i)) {
        c.fillStyle = colors.accent;
        c.globalAlpha = i === body[0] ? 1 : 0.55;
        mark(m, x, y, s);
        continue;
      }
      if (lit[i]) {
        c.fillStyle = colors.mark;
        c.globalAlpha = 1;
        mark(m, x, y, s);
      }
      if (glow > 0) {
        c.fillStyle = lit[i] ? colors.accent : colors.soft;
        c.globalAlpha = lit[i] ? glow : Math.min(1, glow * 1.5);
        mark(m, x, y, s);
      }
    }
    c.globalAlpha = 1;
    return animating;
  }

  function frame(now: number) {
    raf = 0;
    if (render(now) && visible) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  // Snake

  const neighbours = (i: number) => {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < cols - 1) out.push(i + 1);
    if (y > 0) out.push(i - cols);
    if (y < snakeRows - 1) out.push(i + cols);
    return out;
  };

  const placeFood = () => {
    const free = litCells.filter((i) => !bodySet.has(i));
    food.index = free[Math.floor(Math.random() * free.length)] ?? -1;
  };

  // Shortest path from the head to the food, treating the body as walls.
  const findPath = () => {
    const head = body[0];
    const prev = new Map<number, number>([[head, -1]]);
    const queue = [head];
    while (queue.length) {
      const current = queue.shift()!;
      if (current === food.index) break;
      for (const next of neighbours(current)) {
        if (prev.has(next) || (bodySet.has(next) && next !== food.index)) continue;
        prev.set(next, current);
        queue.push(next);
      }
    }
    if (!prev.has(food.index)) return [];
    const steps: number[] = [];
    for (let at = food.index; at !== head; at = prev.get(at)!) steps.unshift(at);
    return steps;
  };

  const resetSnake = () => {
    const now = performance.now();
    for (const i of body) {
      glowAt[i] = now;
      glowPeak[i] = 0.55;
    }
    body = [litCells[Math.floor(Math.random() * litCells.length)] ?? 0];
    bodySet.clear();
    bodySet.add(body[0]);
    length = MIN_LENGTH;
    path = [];
  };

  const step = () => {
    if (food.index < 0) placeFood();
    if (!path.length) path = findPath();
    let next = path.shift();
    if (next === undefined) {
      // Boxed in or no route: wander to any free neighbour.
      const options = neighbours(body[0]).filter((n) => !bodySet.has(n));
      next = options[Math.floor(Math.random() * options.length)];
      if (next === undefined) {
        resetSnake();
        return;
      }
    }
    body.unshift(next);
    bodySet.add(next);
    if (next === food.index) {
      food.index = -1;
      path = [];
      length = length >= MAX_LENGTH ? MIN_LENGTH : length + 2;
    }
    const now = performance.now();
    while (body.length > length) {
      const tail = body.pop()!;
      bodySet.delete(tail);
      // The cell it leaves fades out like a hover trail.
      glowAt[tail] = now;
      glowPeak[tail] = 0.55;
    }
  };

  const tick = () => {
    window.clearTimeout(tickTimer);
    if (!visible || !snakeEnabled) return;
    step();
    kick();
    tickTimer = window.setTimeout(tick, TICK_MS);
  };

  // Events

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((event.clientX - rect.left) / cell);
    const cy = Math.floor((event.clientY - rect.top) / cell);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return;
    const i = cy * cols + cx;
    glowAt[i] = performance.now();
    glowPeak[i] = 1;
    kick();
  });

  window.addEventListener(MODE_EVENT, (event) => {
    const wave = (event as CustomEvent<ModeWave>).detail;
    if (!wave || wave.mode === mode) return;
    const now = performance.now();
    // Waves that have passed every cell are settled.
    while (sweeps.length && now >= sweeps[0].end) settled = sweeps.shift()!.mode;
    mode = wave.mode;
    if (reducedMotion) {
      sweeps = [];
      settled = mode;
      transitionEnd = 0;
    } else {
      // Same timing as the other layers: the band arrives, then the new style.
      const rect = canvas.getBoundingClientRect();
      const band = WAVE_WIDTH / WAVE_SPEED;
      const bandAt = new Float64Array(cols * rows);
      const switchAt = new Float64Array(cols * rows);
      let end = now;
      for (let i = 0; i < switchAt.length; i++) {
        const x = rect.left + ((i % cols) + 0.5) * cell;
        const y = rect.top + (Math.floor(i / cols) + 0.5) * cell;
        bandAt[i] = arrivalTime(wave, Math.hypot(x - wave.x, y - wave.y));
        switchAt[i] = bandAt[i] + band;
        end = Math.max(end, switchAt[i]);
      }
      sweeps.push({ mode: wave.mode, bandAt, switchAt, end });
      transitionEnd = Math.max(transitionEnd, end);
    }
    kick();
    if (!visible) render(now);
  });

  new ResizeObserver(() => {
    resize();
    render(performance.now());
  }).observe(root);

  new MutationObserver(() => {
    readStyles();
    render(performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const onVisibility = () => {
    const shown = visible && document.visibilityState === 'visible';
    if (shown) {
      kick();
      tick();
    } else window.clearTimeout(tickTimer);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    onVisibility();
  }).observe(root);
  document.addEventListener('visibilitychange', onVisibility);

  readStyles();
  resize();
  if (snakeEnabled && litCells.length) resetSnake();
  render(performance.now());
  document.fonts?.ready.then(() => {
    readStyles();
    render(performance.now());
  });
}

export function initWordmarks() {
  document.querySelectorAll<HTMLElement>('.wordmark[data-cols]').forEach(start);
}
