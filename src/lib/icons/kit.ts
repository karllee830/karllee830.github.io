// Small helpers for the hand-drawn icons' draw functions.

/** Rounds to three decimals, as the icon markup does. */
export const f = (n: number) => +n.toFixed(3);

/** Sets attributes on an element; ignores a missing one. */
export const at = (el: Element | undefined, attrs: Record<string, string | number>) => {
  if (el) for (const key in attrs) el.setAttribute(key, String(attrs[key]));
};
