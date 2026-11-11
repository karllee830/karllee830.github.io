import type { RenderMode } from './mode-wave';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const BRAILLE: [number, number][] = [
  [0, 1], [1, 2], [1, 0], [0, 3], [0, 0], [1, 3], [1, 1], [0, 2],
];

/**
 * One solid cell of a render style, for small pixel lettering (the footer
 * wordmark, the margin easter egg). `s` is the cell size; marks use ~90%.
 * The caller sets fillStyle, globalAlpha and centred text alignment.
 */
export function drawMark(
  c: CanvasRenderingContext2D,
  m: RenderMode,
  x: number,
  y: number,
  s: number,
  fontFamily: string,
) {
  const q = s * 0.9;
  const cx = x + s / 2;
  const cy = y + s / 2;
  switch (m) {
    case 'ascii':
      c.font = `600 ${s * 1.05}px ${fontFamily}`;
      c.fillText('#', cx, cy + s * 0.04);
      break;
    case 'dots':
      c.beginPath();
      c.arc(cx, cy, q * 0.42, 0, Math.PI * 2);
      c.fill();
      break;
    case 'dither': {
      const sub = q / 4;
      const ox = cx - q / 2;
      const oy = cy - q / 2;
      for (let k = 0; k < 16; k++) if (BAYER[k] < 0.62) c.fillRect(ox + (k % 4) * sub, oy + Math.floor(k / 4) * sub, sub, sub);
      break;
    }
    case 'cross': {
      const arm = q * 0.46;
      const stroke = q * 0.24;
      c.fillRect(cx - arm, cy - stroke / 2, arm * 2, stroke);
      c.fillRect(cx - stroke / 2, cy - arm, stroke, arm * 2);
      break;
    }
    case 'braille':
      for (const [col, row] of BRAILLE) {
        c.beginPath();
        c.arc(cx + (col ? q * 0.22 : -q * 0.22), cy - q * 0.36 + row * q * 0.24, q * 0.12, 0, Math.PI * 2);
        c.fill();
      }
      break;
    case 'hatch': {
      c.strokeStyle = c.fillStyle;
      c.lineWidth = Math.max(1, s * 0.1);
      c.beginPath();
      for (const k of [-0.25, 0.25]) {
        c.moveTo(x + Math.max(0, k * s), y + s + Math.min(0, k * s));
        c.lineTo(x + s + Math.min(0, k * s), y + Math.max(0, k * s));
      }
      c.moveTo(x, y);
      c.lineTo(x + s, y + s);
      c.stroke();
      break;
    }
    default:
      c.fillRect(cx - q / 2, cy - q / 2, q, q);
  }
}
