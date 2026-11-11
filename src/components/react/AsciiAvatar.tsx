import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createAsciiEngine, type AsciiEngine } from '../../lib/ascii-engine';
import { MODE_EVENT, MODE_STORAGE_KEY, readStoredMode, type ModeWave, type RenderMode } from '../../lib/mode-wave';
import './ascii-avatar.css';

// Order of the mode buttons (independent of the engine's internal mode codes).
const MODES: RenderMode[] = ['ascii', 'dither', 'pixel', 'dots', 'cross', 'braille', 'hatch'];

interface Props {
  label: string;
  modesLabel: string;
  replayLabel: string;
  modeLabels: Record<RenderMode, string>;
}

export default function AsciiAvatar({ label, modesLabel, replayLabel, modeLabels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsciiEngine | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [mode, setMode] = useState<RenderMode>('ascii');
  const modesRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<CSSProperties | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    // Start in the last chosen mode; the page backdrop already shows it.
    const stored = readStoredMode();
    const engine = createAsciiEngine(canvasRef.current, stored);
    engineRef.current = engine;
    setMode(stored);
    // Let the thumb jump to the stored mode before its slide transition turns on.
    const timer = window.setTimeout(() => setSettled(true), 60);
    return () => {
      window.clearTimeout(timer);
      engine.destroy();
    };
  }, []);

  /**
   * User picks a mode: remember it, then start one wave from the avatar that
   * both this canvas and the page backdrop follow.
   */
  const choose = (next: RenderMode) => {
    if (next === mode) return;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const wave: ModeWave = {
      mode: next,
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      t0: performance.now(),
    };
    engineRef.current?.setMode(next, wave);
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: wave }));
    setMode(next);
  };

  useEffect(() => {
    engineRef.current?.setMode(mode);
  }, [mode]);

  // The active chip's background is one thumb that slides between options.
  useLayoutEffect(() => {
    const group = modesRef.current;
    if (!group) return;
    const place = () => {
      const chip = chipRefs.current[MODES.indexOf(mode)];
      if (!chip) return;
      setThumb({ width: chip.offsetWidth, transform: `translateX(${chip.offsetLeft}px)` });
      updateFades();
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => observer.disconnect();
  }, [mode]);

  // Keep the active chip inside the scrollable row.
  useEffect(() => {
    const group = modesRef.current;
    const chip = chipRefs.current[MODES.indexOf(mode)];
    if (!group || !chip) return;
    const left = chip.offsetLeft - 24;
    const right = chip.offsetLeft + chip.offsetWidth + 24 - group.clientWidth;
    const target = Math.min(Math.max(group.scrollLeft, right), left);
    if (target !== group.scrollLeft) {
      group.scrollTo({ left: target, behavior: settled ? 'smooth' : 'auto' });
    }
    // Smooth scrolling may not report every step; settle the edge fades after it.
    const timer = window.setTimeout(updateFades, 450);
    return () => window.clearTimeout(timer);
  }, [mode, settled]);

  /** Fade an edge only while more chips wait beyond it. */
  const updateFades = () => {
    const group = modesRef.current;
    if (!group) return;
    group.toggleAttribute('data-more-left', group.scrollLeft > 1);
    group.toggleAttribute('data-more-right', group.scrollLeft + group.clientWidth < group.scrollWidth - 1);
  };

  // Arrow keys move between options, as in a native radio group.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (MODES.indexOf(mode) + step + MODES.length) % MODES.length;
    choose(MODES[next]);
    chipRefs.current[next]?.focus();
  };

  return (
    <div className="ascii-hero sq sq-line">
      <div className="ascii-stage sq">
        <canvas ref={canvasRef} className="ascii-canvas" role="img" aria-label={label} />
      </div>
      <div className="ascii-bar">
        <div
          ref={modesRef}
          className="ascii-modes"
          role="radiogroup"
          aria-label={modesLabel}
          onKeyDown={onKeyDown}
          onScroll={updateFades}
          data-ready={thumb ? '' : undefined}
          data-settled={settled ? '' : undefined}
        >
          <span className="ascii-thumb sq" style={thumb ?? undefined} aria-hidden="true" />
          {MODES.map((m, index) => (
            <button
              key={m}
              ref={(el) => {
                chipRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={mode === m}
              tabIndex={mode === m ? 0 : -1}
              className="ascii-chip sq sq-line"
              onClick={() => choose(m)}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ascii-replay sq sq-line"
          aria-label={replayLabel}
          title={replayLabel}
          onClick={() => engineRef.current?.replay()}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
