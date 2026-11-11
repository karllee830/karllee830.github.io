import type { AvatarMatrix } from '../data/avatar';

export interface AvatarCell {
  x: number;
  y: number;
  /** 0 (lightest) … 1 (densest), rank-equalised across the palette. */
  tone: number;
  /** Pixel belongs to the accent hue (the blue cap band and sleeves). */
  accent: boolean;
  /** Original colour of the pixel, as in the source artwork. */
  color: string;
}

export interface AvatarModel {
  width: number;
  height: number;
  cells: AvatarCell[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

function parseHex(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isBlue([r, g, b]: [number, number, number]): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = (max - min) / 255;
  // Chroma (not HSL saturation) so pale tints such as a light-blue shirt stay neutral.
  if (chroma < 0.2) return false;
  const delta = max - min;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 195 && hue <= 250;
}

/**
 * Maps a pixel-art matrix to monochrome tones plus an accent flag.
 * Tones are rank-based so that a mostly pale palette still spreads
 * across the full glyph ramp.
 */
export function buildAvatarModel(matrix: AvatarMatrix): AvatarModel {
  const colors = matrix.palette.map((hex) => {
    const rgb = parseHex(hex);
    return { lum: luminance(rgb), accent: isBlue(rgb) };
  });

  const used = new Set<number>();
  for (const row of matrix.rows) {
    for (const ch of row) if (ch !== '.') used.add(parseInt(ch, 36));
  }

  const rank = (accent: boolean) => {
    const group = [...used].filter((i) => colors[i].accent === accent);
    // Lightest first; equal luminance shares a rank.
    const levels = [...new Set(group.map((i) => colors[i].lum))].sort((a, b) => b - a);
    const map = new Map<number, number>();
    for (const i of group) {
      const level = levels.indexOf(colors[i].lum);
      map.set(i, levels.length > 1 ? level / (levels.length - 1) : 1);
    }
    return map;
  };

  const neutralRank = rank(false);
  const accentRank = rank(true);

  const cells: AvatarCell[] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  matrix.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const index = parseInt(ch, 36);
      const accent = colors[index].accent;
      const r = (accent ? accentRank : neutralRank).get(index) ?? 0;
      const tone = accent ? 0.7 + 0.3 * r : 0.18 + 0.82 * r;
      cells.push({ x, y, tone, accent, color: matrix.palette[index] });
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    });
  });

  return { width: matrix.width, height: matrix.height, cells, bounds: { x0, y0, x1, y1 } };
}
