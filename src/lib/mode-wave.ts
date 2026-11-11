/**
 * Shared description of a render-mode change. The hero canvas and the page
 * backdrop both follow the same wave: one circle that starts at the avatar
 * at time t0 and grows at WAVE_SPEED, with an accent band WAVE_WIDTH wide at
 * its front, so the two read as a single ripple.
 */

export type RenderMode = 'ascii' | 'pixel' | 'dots' | 'dither';

export interface ModeWave {
  mode: RenderMode;
  /** Viewport point the change spreads from (the avatar's centre). */
  x: number;
  y: number;
  /** performance.now() when the wave started. */
  t0: number;
}

export const WAVE_SPEED = 0.9; // px per ms
export const WAVE_WIDTH = 36; // px

export const MODE_STORAGE_KEY = 'avatar-mode';
export const MODE_EVENT = 'avatar:mode';

const MODES: RenderMode[] = ['ascii', 'pixel', 'dots', 'dither'];

export function readStoredMode(): RenderMode {
  try {
    const value = localStorage.getItem(MODE_STORAGE_KEY);
    if (value && (MODES as string[]).includes(value)) return value as RenderMode;
  } catch {
    /* storage unavailable */
  }
  return 'ascii';
}

/** When the wave's front reaches a point at `distance` px from the origin. */
export function arrivalTime(wave: ModeWave, distance: number) {
  return wave.t0 + distance / WAVE_SPEED;
}
