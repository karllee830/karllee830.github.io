import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createAsciiEngine, type AsciiEngine, type RenderMode } from '../../lib/ascii-engine';
import './ascii-avatar.css';

const MODES: RenderMode[] = ['ascii', 'pixel', 'dots'];

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

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createAsciiEngine(canvasRef.current, 'ascii');
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

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
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => observer.disconnect();
  }, [mode]);

  // Arrow keys move between options, as in a native radio group.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (MODES.indexOf(mode) + step + MODES.length) % MODES.length;
    setMode(MODES[next]);
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
          data-ready={thumb ? '' : undefined}
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
              onClick={() => setMode(m)}
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
