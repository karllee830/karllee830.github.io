import { avatar } from '../data/avatar';
import { buildAvatarModel, headCrop, markOpacity } from '../lib/avatar-model';
import { squirclePath } from '../lib/squircle';

// Same drawing as the header brand mark in the light theme: the monochrome
// head on a 24px squircle tile (radius 8), shifted down 4px so the shoulders
// run off the edge. The light colours are kept in every theme, since dark ink
// is what keeps the avatar's shading the right way round.
const TILE = 24;
const RADIUS = 8;
const MARK = 20;

export function GET() {
  const { left, top, span, cells } = headCrop(buildAvatarModel(avatar));
  const scale = MARK / span;
  const offsetX = (TILE - MARK) / 2;
  const offsetY = TILE - MARK;
  const tile = squirclePath(TILE, TILE, RADIUS);

  const rects = cells
    .map((c) => {
      const x = offsetX + (c.x - left) * scale;
      const y = offsetY + (c.y - top) * scale;
      const cls = c.accent ? ' class="a"' : '';
      return `<rect${cls} x="${x}" y="${y}" width="${scale}" height="${scale}" fill-opacity="${markOpacity(c).toFixed(2)}"/>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}" shape-rendering="crispEdges">
<style>.t{fill:#f4f4f4}.m{fill:#0a0a0a}.a{fill:#669fd0}</style>
<clipPath id="c"><path d="${tile}"/></clipPath>
<g clip-path="url(#c)"><path class="t" shape-rendering="geometricPrecision" d="${tile}"/><g class="m">${rects}</g></g>
</svg>`;

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
}
