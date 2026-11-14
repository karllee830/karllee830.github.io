// Character classes shared by the Chinese typesetting helpers.

export const HAN = /[㐀-鿿豈-﫿]/;
export const LATIN = /[A-Za-z0-9]/;

/** The gap `text-autospace` puts between Han and Latin letters or digits. */
export const AUTOSPACE = '0.125em';

/**
 * Whether `text-autospace` would separate these two characters. Text split
 * into inline blocks loses that gap, so components add it themselves.
 * @param {string | undefined} before
 * @param {string | undefined} after
 */
export function autospaceBetween(before, after) {
  if (!before || !after) return false;
  return (HAN.test(before) && LATIN.test(after)) || (LATIN.test(before) && HAN.test(after));
}
