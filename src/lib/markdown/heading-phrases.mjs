// Chinese headings wrap between words: a <wbr> goes between the phrases BudouX
// finds (see src/lib/phrases.mjs), and the headings are set with
// `word-break: keep-all`, so those are the only places a line can break
// besides spaces. Inline code is left alone.

import { phrases } from '../phrases.mjs';

const wbr = () => ({ type: 'element', tagName: 'wbr', properties: {}, children: [] });

/** Returns new children, or null when nothing needed splitting. */
function split(children) {
  let changed = false;
  const out = [];
  for (const child of children) {
    if (child.type === 'text') {
      const parts = phrases(child.value);
      if (parts.length > 1) changed = true;
      parts.forEach((value, i) => {
        if (i > 0) out.push(wbr());
        out.push({ type: 'text', value });
      });
    } else if (child.type === 'element' && child.tagName !== 'code' && child.children?.length) {
      const inner = split(child.children);
      if (inner) changed = true;
      out.push(inner ? { ...child, children: inner } : child);
    } else out.push(child);
  }
  return changed ? out : null;
}

/** @type {import('satteri').HastPluginDefinition} */
export const headingPhrases = {
  name: 'heading-phrases',
  element: {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    visit(node, ctx) {
      const children = split(node.children ?? []);
      if (children) ctx.replaceNode(node, { ...node, children });
    },
  },
};
