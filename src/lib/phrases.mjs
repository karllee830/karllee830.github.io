// Splits Chinese text into phrases with BudouX, so headings set with
// `word-break: keep-all` can wrap between words instead of between any two
// characters. Joining the phrases gives back the original text.
//
// BudouX is trained on Chinese and sometimes cuts Latin words apart
// ("CN" + "AME"), so the result is adjusted: no break inside a run of Latin
// letters and digits, and always a break where such a run meets a Han
// character.

import { loadDefaultSimplifiedChineseParser } from 'budoux';
import { HAN, LATIN } from './cjk.mjs';

const parser = loadDefaultSimplifiedChineseParser();

/**
 * @param {string} text
 * @returns {string[]}
 */
export function phrases(text) {
  if (!HAN.test(text)) return [text];

  /** Offsets where a new phrase starts. */
  const cuts = new Set();
  let offset = 0;
  for (const chunk of parser.parse(text)) {
    if (offset > 0) cuts.add(offset);
    offset += chunk.length;
  }

  for (let i = 1; i < text.length; i++) {
    const before = text[i - 1];
    const after = text[i];
    if (LATIN.test(before) && LATIN.test(after)) cuts.delete(i);
    else if ((LATIN.test(before) && HAN.test(after)) || (HAN.test(before) && LATIN.test(after))) cuts.add(i);
  }

  const bounds = [0, ...[...cuts].sort((a, b) => a - b), text.length];
  /** @type {string[]} */
  const result = [];
  for (let i = 1; i < bounds.length; i++) {
    const piece = text.slice(bounds[i - 1], bounds[i]);
    const prev = result.at(-1);
    // A lone Han character is joined to the Han phrase after it ("定" + "时"),
    // which also keeps short headings ("文章") in one piece.
    if (prev && prev.length === 1 && HAN.test(prev) && HAN.test(piece[0])) result[result.length - 1] += piece;
    else result.push(piece);
  }
  return result;
}
