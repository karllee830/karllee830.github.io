// Markdown image captions: an image on its own line with a title becomes a figure, and
// the title its caption. Links written as [text](url) in the title become real links.
//
//   ![A cat on a sofa](./cat.jpg "Photo: Jane Doe / [Unsplash](https://unsplash.com)")
//
// Images without a title, or sharing a line with text, are left as they are. The image
// itself is still optimised by Astro, which picks it up after this plugin runs.

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Caption text as hast nodes, with Markdown-style links turned into anchors. */
function caption(title) {
  const nodes = [];
  let last = 0;
  for (const match of title.matchAll(LINK)) {
    if (match.index > last) nodes.push({ type: 'text', value: title.slice(last, match.index) });
    nodes.push({
      type: 'element',
      tagName: 'a',
      properties: { href: match[2], rel: ['noopener'] },
      children: [{ type: 'text', value: match[1] }],
    });
    last = match.index + match[0].length;
  }
  if (last < title.length) nodes.push({ type: 'text', value: title.slice(last) });
  return nodes;
}

/** @type {import('satteri').HastPluginDefinition} */
export const figureCaptions = {
  name: 'figure-captions',
  element: {
    filter: ['p'],
    visit(node, ctx) {
      // Only a paragraph holding a single image (whitespace aside) qualifies.
      const children = (node.children ?? []).filter((c) => !(c.type === 'text' && !c.value.trim()));
      const [img] = children;
      if (children.length !== 1 || img.type !== 'element' || img.tagName !== 'img') return;
      const title = typeof img.properties?.title === 'string' ? img.properties.title.trim() : '';
      if (!title) return;

      const { title: _, ...properties } = img.properties;
      ctx.replaceNode(node, {
        type: 'element',
        tagName: 'figure',
        properties: {},
        children: [
          { type: 'element', tagName: 'img', properties, children: [] },
          { type: 'element', tagName: 'figcaption', properties: {}, children: caption(title) },
        ],
      });
    },
  },
};
