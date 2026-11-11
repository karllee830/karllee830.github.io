import { useEffect, useRef, useState } from 'react';

interface Props {
  words: string[];
  /** Milliseconds each word stays on screen. */
  interval?: number;
}

const LATIN_NOISE = '!<>-_\\/[]{}=+*^?#%@01';
const BLOCK_NOISE = '░▒▓▚▞▖▗▘▝';
const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;
const DURATION = 640;

const pick = (pool: string) => pool[(Math.random() * pool.length) | 0];

/**
 * Cycles through words with a decode effect. The box eases to the width of
 * the incoming word, so the rest of the sentence slides instead of jumping.
 */
export default function ScrambleText({ words, interval = 2800 }: Props) {
  const [text, setText] = useState(words[0] ?? '');
  const [width, setWidth] = useState<number | undefined>(undefined);
  const sizers = useRef<(HTMLSpanElement | null)[]>([]);
  const frame = useRef(0);

  useEffect(() => {
    const measure = (i: number) => sizers.current[i]?.getBoundingClientRect().width;
    setWidth(measure(0));
    if (words.length < 2) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;

    const scrambleTo = (target: string) => {
      if (reduced) {
        setText(target);
        return;
      }
      const chars = [...target];
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION);
        const out = chars
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            const settleAt = 0.35 + (0.65 * (i + 1)) / chars.length;
            if (progress >= settleAt) return ch;
            return pick(CJK.test(ch) ? BLOCK_NOISE : LATIN_NOISE);
          })
          .join('');
        setText(out);
        if (progress < 1) frame.current = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      index = (index + 1) % words.length;
      setWidth(measure(index));
      scrambleTo(words[index]);
    }, interval);

    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [words, interval]);

  return (
    <span className="scramble" style={width ? { width } : undefined}>
      <span className="sr-only">{words.join(' / ')}</span>
      {words.map((word, i) => (
        <span
          key={word}
          ref={(el) => {
            sizers.current[i] = el;
          }}
          className="scramble-sizer"
          aria-hidden="true"
        >
          {word}
        </span>
      ))}
      <span className="scramble-live" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
