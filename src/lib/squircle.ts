/**
 * Squircle fallback for browsers without CSS `corner-shape` (Safari, Firefox).
 *
 * Each `.sq` element gets a clip-path whose corners approximate an
 * exponent-4 superellipse — the same curve as `corner-shape: squircle`.
 * `.sq-line` elements also get a 1px ring path (outer minus inset shape,
 * even-odd) that base.css paints in place of the border, which the clip
 * would otherwise cut off at the corners.
 */

// Bezier handle length (fraction of the radius) for a superellipse with n = 4.
const HANDLE = 0.909;

export function squirclePath(width: number, height: number, radius: number, inset = 0): string {
  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const c = r * (1 - HANDLE);
  const n = (v: number) => Math.round(v * 100) / 100;

  return [
    `M${n(x0 + r)} ${n(y0)}`,
    `H${n(x1 - r)}`,
    `C${n(x1 - c)} ${n(y0)} ${n(x1)} ${n(y0 + c)} ${n(x1)} ${n(y0 + r)}`,
    `V${n(y1 - r)}`,
    `C${n(x1)} ${n(y1 - c)} ${n(x1 - c)} ${n(y1)} ${n(x1 - r)} ${n(y1)}`,
    `H${n(x0 + r)}`,
    `C${n(x0 + c)} ${n(y1)} ${n(x0)} ${n(y1 - c)} ${n(x0)} ${n(y1 - r)}`,
    `V${n(y0 + r)}`,
    `C${n(x0)} ${n(y0 + c)} ${n(x0 + c)} ${n(y0)} ${n(x0 + r)} ${n(y0)}`,
    'Z',
  ].join('');
}

function apply(el: HTMLElement, width: number, height: number) {
  if (width === 0 || height === 0) return;
  const radius = parseFloat(getComputedStyle(el).getPropertyValue('--sq-r')) || 0;
  const outer = squirclePath(width, height, radius);
  el.style.setProperty('--sq-path', `path('${outer}')`);
  if (el.classList.contains('sq-line')) {
    const inner = squirclePath(width, height, radius - 1, 1);
    el.style.setProperty('--sq-ring', `path(evenodd, '${outer}${inner}')`);
  }
  el.dataset.sq = '';
}

export function initSquircles() {
  if (typeof CSS !== 'undefined' && CSS.supports('corner-shape', 'squircle')) return;

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0];
      const el = entry.target as HTMLElement;
      if (box) apply(el, box.inlineSize, box.blockSize);
      else apply(el, el.offsetWidth, el.offsetHeight);
    }
  });

  const seen = new WeakSet<Element>();
  const scan = (root: ParentNode) => {
    root.querySelectorAll<HTMLElement>('.sq').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      observer.observe(el, { box: 'border-box' });
    });
  };

  scan(document);

  // Islands may render new `.sq` nodes after hydration.
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.classList.contains('sq')) scan(node.parentElement ?? document);
          else scan(node);
        }
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
