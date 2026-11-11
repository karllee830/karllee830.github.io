import { useCallback, useEffect, useRef, useState } from 'react';
import { createAsciiEngine, type AsciiEngine } from '../../lib/ascii-engine';
import { MODE_EVENT, MODE_STORAGE_KEY, readStoredMode, type ModeWave, type RenderMode } from '../../lib/mode-wave';
import './ascii-avatar.css';

// Order the styles cycle in (independent of the engine's internal mode codes).
const MODES: RenderMode[] = ['ascii', 'dither', 'pixel', 'dots', 'cross', 'braille', 'hatch'];

/** First switch comes soon after the intro; later ones at a steady, slower pace. */
const FIRST_DELAY = 10000;
const INTERVAL = 30000;
/** While paused (hovered, off screen, hidden tab), check again this often. */
const RETRY = 1000;
/** Grid unit of the canvas (see ascii-engine) and rows shown per breakpoint. */
const UNIT = 12;
const ROWS_WIDE = 31;
const ROWS_NARROW = 29;

interface Props {
  label: string;
  stylesLabel: string;
  styleLabels: Record<RenderMode, string>;
}

/**
 * Hero avatar canvas that cycles through the render styles on its own, with
 * a small picker in the top-right corner (revealed on hover or focus, or by
 * a tap) to choose one directly. Each switch starts one wave from the avatar
 * that the canvas, the page margins and the footer all follow.
 *
 * Cycling pauses while the pointer is on the avatar or the picker, while it
 * is off screen or the tab is hidden, and is off for reduced motion. Picking
 * a style restarts the cycle from there. The current style is remembered;
 * other pages (which have no avatar) show it without cycling.
 */
export default function AsciiAvatar({ label, stylesLabel, styleLabels }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<AsciiEngine | null>(null);
  const modeRef = useRef<RenderMode>('ascii');
  const restartRef = useRef<(delay: number) => void>(() => {});
  const [mode, setMode] = useState<RenderMode>('ascii');
  const [open, setOpen] = useState(false);

  /** Switch style with one shared wave from the avatar, and remember it. */
  const apply = useCallback((next: RenderMode) => {
    const canvas = canvasRef.current;
    if (!canvas || next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    const rect = canvas.getBoundingClientRect();
    const wave: ModeWave = {
      mode: next,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      t0: performance.now(),
    };
    engineRef.current?.setMode(next, wave);
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: wave }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    // Height = whole rows plus the same leftover the width has, so the grid
    // sits with equal margins on all four sides.
    const fit = () => {
      const width = Math.round(root.getBoundingClientRect().width);
      const rows = window.matchMedia('(max-width: 767px)').matches ? ROWS_NARROW : ROWS_WIDE;
      const height = `${rows * UNIT + (width % UNIT)}px`;
      if (root.style.height !== height) root.style.height = height;
    };
    fit();
    const sizer = new ResizeObserver(fit);
    sizer.observe(root);

    const stored = readStoredMode();
    modeRef.current = stored;
    setMode(stored);
    engineRef.current = createAsciiEngine(canvas, stored, root);

    // The style button sits on the top-right 2×2 block of the canvas grid:
    // those units are kept clear and the button is centred on them, so the
    // icon lines up with the pattern at any width.
    const reserve = () => {
      const picker = root.querySelector<HTMLElement>('.style-picker');
      const toggle = toggleRef.current;
      if (!picker || !toggle) return;
      const width = Math.round(canvas.getBoundingClientRect().width);
      const height = Math.round(canvas.getBoundingClientRect().height);
      const cols = Math.floor(width / UNIT);
      const rows = Math.floor(height / UNIT);
      const left = (width - cols * UNIT) / 2 + (cols - 2) * UNIT;
      const top = (height - rows * UNIT) / 2;
      const block = UNIT * 2;
      const size = toggle.offsetWidth;
      picker.style.top = `${top + (block - size) / 2}px`;
      picker.style.right = `${width - (left + block) + (block - size) / 2}px`;
      engineRef.current?.setReserved({ x: left, y: top, width: block, height: block });
    };
    reserve();
    const reserver = new ResizeObserver(reserve);
    reserver.observe(canvas);

    let hovering = false;
    let onScreen = true;
    const onEnter = () => (hovering = true);
    const onLeave = () => (hovering = false);
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    const observer = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    observer.observe(root);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    const tick = () => {
      if (hovering || !onScreen || document.visibilityState !== 'visible') {
        timer = window.setTimeout(tick, RETRY);
        return;
      }
      apply(MODES[(MODES.indexOf(modeRef.current) + 1) % MODES.length]);
      timer = window.setTimeout(tick, INTERVAL);
    };
    restartRef.current = (delay) => {
      window.clearTimeout(timer);
      if (!reduced) timer = window.setTimeout(tick, delay);
    };
    restartRef.current(FIRST_DELAY);

    return () => {
      window.clearTimeout(timer);
      sizer.disconnect();
      reserver.disconnect();
      observer.disconnect();
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
      engineRef.current?.destroy();
    };
  }, [apply]);

  // A tap opens the menu on touch screens; tapping elsewhere closes it.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.style-picker')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const pick = (next: RenderMode) => {
    apply(next);
    setOpen(false);
    restartRef.current(INTERVAL);
    // Drop focus so the menu and button fade away once the pointer leaves.
    (document.activeElement as HTMLElement | null)?.blur();
  };

  // Mouse users get the menu on hover; only touch and pen taps pin it open.
  const lastPointer = useRef('mouse');

  return (
    <div ref={rootRef} className="ascii-stage">
      <canvas ref={canvasRef} className="ascii-canvas" role="img" aria-label={label} />
      <div className="style-picker" data-open={open ? '' : undefined}>
        <button
          ref={toggleRef}
          type="button"
          className="style-toggle sq sq-line"
          aria-label={stylesLabel}
          aria-expanded={open}
          title={stylesLabel}
          onPointerDown={(event) => (lastPointer.current = event.pointerType)}
          onClick={() => {
            if (lastPointer.current !== 'mouse') setOpen((value) => !value);
            lastPointer.current = 'mouse';
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <rect x="2" y="2" width="5" height="5" />
            <rect x="9" y="2" width="5" height="5" />
            <rect x="2" y="9" width="5" height="5" />
            <rect x="9" y="9" width="5" height="5" />
          </svg>
        </button>
        <ul className="style-menu sq sq-line" aria-label={stylesLabel}>
          {MODES.map((m) => (
            <li key={m}>
              <button type="button" className="style-option sq" aria-pressed={mode === m} onClick={() => pick(m)}>
                {styleLabels[m]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
