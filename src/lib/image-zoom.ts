/**
 * Image viewer for post images. A click (or Enter) opens the image over a blurred
 * backdrop, grown from where it sits; inside the viewer:
 *
 * - zoom with the wheel or a trackpad pinch (around the pointer), a two-finger pinch on
 *   touch screens, a click or tap on the image (fit ↔ 2.5×), the toolbar or + / − / 0;
 * - drag to look around a zoomed image (kept within its edges), or use the arrow keys;
 * - close with Escape, the close button, a click on the backdrop, or by dragging an
 *   unzoomed image down on touch screens.
 *
 * The page does not scroll while the viewer is open. Reduced motion skips the movement.
 */

const GAP = 24; // space around the fitted image, in px
const DURATION = 320;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const STEP = 1.5; // zoom factor per button or key press
const TAP = 6; // pointer movement (px) still counted as a click
const DISMISS = 120; // downward drag (px) that closes an unzoomed image

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

const LABELS = {
  zh: { zoomIn: '放大', zoomOut: '缩小', reset: '适应屏幕', close: '关闭' },
  en: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Fit to screen', close: 'Close' },
};

const ICONS = {
  zoomOut: '<path d="M5 12h14"/>',
  zoomIn: '<path d="M5 12h14M12 5v14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${paths}</svg>`;

/** The transform that maps box `to` onto box `from` (transform-origin: center). */
function between(from: DOMRect, to: DOMRect) {
  const scale = from.width / to.width;
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function open(img: HTMLImageElement) {
  const labels = document.documentElement.lang.startsWith('zh') ? LABELS.zh : LABELS.en;
  const caption = img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '';
  const start = img.getBoundingClientRect();
  const animate = !reduced.matches;

  // Markup: backdrop, the stage holding the image, then caption and toolbar.
  const overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', img.alt || caption);
  overlay.tabIndex = -1;

  const backdrop = document.createElement('div');
  backdrop.className = 'zoom-backdrop';

  const stage = document.createElement('div');
  stage.className = 'zoom-stage';
  const big = document.createElement('img');
  big.className = 'zoom-image';
  big.src = img.currentSrc || img.src;
  big.alt = img.alt;
  big.draggable = false;
  stage.append(big);

  const bottom = document.createElement('div');
  bottom.className = 'zoom-bottom';
  if (caption) {
    const text = document.createElement('p');
    text.className = 'zoom-caption';
    text.textContent = caption;
    bottom.append(text);
  }
  const bar = document.createElement('div');
  bar.className = 'zoom-bar sq sq-line';
  const button = (label: string, svg: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zoom-button sq';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = icon(svg);
    return b;
  };
  const out = button(labels.zoomOut, ICONS.zoomOut);
  const level = document.createElement('button');
  level.type = 'button';
  level.className = 'zoom-level mono sq';
  level.title = labels.reset;
  level.setAttribute('aria-label', labels.reset);
  const inn = button(labels.zoomIn, ICONS.zoomIn);
  const shut = button(labels.close, ICONS.close);
  bar.append(out, level, inn, shut);
  bottom.append(bar);

  overlay.append(backdrop, stage, bottom);

  // Geometry: the image is laid out at its fitted size; zoom and pan are a transform on top.
  const natural = { w: img.naturalWidth || start.width, h: img.naturalHeight || start.height };
  let fit = { w: 0, h: 0 };
  let maxZoom = 3;
  let z = 1;
  let x = 0;
  let y = 0;

  const layout = () => {
    // The caption and toolbar take the bottom; the image fits in what is left.
    const reserved = bottom.offsetHeight;
    overlay.style.setProperty('--zoom-bottom', `${reserved}px`);
    const scale = Math.min(1, (window.innerWidth - GAP * 2) / natural.w, (window.innerHeight - GAP - reserved) / natural.h);
    fit = { w: Math.round(natural.w * scale), h: Math.round(natural.h * scale) };
    big.style.width = `${fit.w}px`;
    big.style.height = `${fit.h}px`;
    // Allow at least 3×, and twice the file's own size for large images.
    maxZoom = Math.max(3, (natural.w / fit.w) * 2);
  };

  /** Keeps a zoomed image covering what it can of the stage; centred when smaller. */
  const bound = () => {
    const rect = stage.getBoundingClientRect();
    const spareX = Math.max(0, (fit.w * z - rect.width) / 2);
    const spareY = Math.max(0, (fit.h * z - rect.height) / 2);
    x = clamp(x, -spareX, spareX);
    y = clamp(y, -spareY, spareY);
  };

  const render = (smooth = false) => {
    big.style.transition = smooth && animate ? `transform ${DURATION}ms ${EASE}` : 'none';
    big.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    big.classList.toggle('is-zoomed', z > 1.001);
    level.textContent = `${Math.round(((fit.w * z) / natural.w) * 100)}%`;
    out.disabled = z <= 1.001;
    inn.disabled = z >= maxZoom - 0.001;
  };

  /** Zooms to `next`, keeping the point (cx, cy) on screen where it was. */
  const zoomAt = (next: number, cx: number, cy: number, smooth = false) => {
    next = clamp(next, 1, maxZoom);
    const rect = stage.getBoundingClientRect();
    const px = cx - (rect.left + rect.width / 2);
    const py = cy - (rect.top + rect.height / 2);
    x = px - ((px - x) * next) / z;
    y = py - ((py - y) * next) / z;
    z = next;
    bound();
    render(smooth);
  };

  const centre = () => {
    const rect = stage.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2] as const;
  };

  const reset = () => {
    z = 1;
    x = 0;
    y = 0;
    render(true);
  };

  // Open: lock the page, place the image, grow it out of the original.
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.paddingRight = scrollbar ? `${scrollbar}px` : '';
  document.body.append(overlay);
  layout();
  render();
  img.style.visibility = 'hidden';
  overlay.focus({ preventScroll: true });
  if (animate) {
    big.animate([{ transform: between(start, big.getBoundingClientRect()) }, { transform: 'none' }], { duration: DURATION, easing: EASE });
    for (const el of [backdrop, bottom]) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: EASE });
  }

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlay.remove();
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';
      img.style.visibility = '';
      img.focus({ preventScroll: true });
    };
    if (!animate) return finish();
    // Shrink from the current view back into the original image.
    const current = getComputedStyle(big).transform;
    const base = new DOMRect(big.offsetLeft + stage.offsetLeft, big.offsetTop + stage.offsetTop, fit.w, fit.h);
    big.style.transition = 'none';
    big.animate([{ transform: current === 'none' ? 'none' : current }, { transform: between(img.getBoundingClientRect(), base) }], {
      duration: DURATION,
      easing: EASE,
      fill: 'forwards',
    });
    const fade = { duration: DURATION, easing: EASE, fill: 'forwards' } as const;
    backdrop.animate([{ opacity: getComputedStyle(backdrop).opacity }, { opacity: 0 }], fade);
    bottom.animate([{ opacity: 1 }, { opacity: 0 }], { ...fade, duration: DURATION / 2 });
    window.setTimeout(finish, DURATION);
  };

  // Toolbar.
  out.addEventListener('click', () => zoomAt(z / STEP, ...centre(), true));
  inn.addEventListener('click', () => zoomAt(z * STEP, ...centre(), true));
  level.addEventListener('click', reset);
  shut.addEventListener('click', close);

  // Keyboard.
  const onKey = (event: KeyboardEvent) => {
    const pan = 80;
    if (event.key === 'Escape') close();
    else if (event.key === '+' || event.key === '=') zoomAt(z * STEP, ...centre(), true);
    else if (event.key === '-' || event.key === '_') zoomAt(z / STEP, ...centre(), true);
    else if (event.key === '0') reset();
    else if (event.key.startsWith('Arrow') && z > 1) {
      x += event.key === 'ArrowLeft' ? pan : event.key === 'ArrowRight' ? -pan : 0;
      y += event.key === 'ArrowUp' ? pan : event.key === 'ArrowDown' ? -pan : 0;
      bound();
      render(true);
    } else return;
    event.preventDefault();
  };
  document.addEventListener('keydown', onKey);

  const onResize = () => {
    layout();
    bound();
    render();
  };
  window.addEventListener('resize', onResize);

  // Wheel and trackpad: zoom around the pointer (a pinch arrives as a wheel with ctrlKey).
  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const speed = event.ctrlKey ? 0.01 : 0.002;
      zoomAt(z * Math.exp(-event.deltaY * speed), event.clientX, event.clientY);
    },
    { passive: false },
  );

  // Pointers: drag to pan, pinch to zoom, tap to toggle zoom or close.
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { x: number; y: number; px: number; py: number; z: number; dist: number; moved: boolean; onImage: boolean } | null = null;

  const midpoint = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const begin = () => {
    const pts = [...pointers.values()];
    const centreOf = pts.length > 1 ? midpoint() : { ...pts[0], dist: 0 };
    gesture = { x, y, px: centreOf.x, py: centreOf.y, z, dist: centreOf.dist, moved: gesture?.moved ?? false, onImage: gesture?.onImage ?? false };
  };

  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) gesture = null;
    begin();
    if (gesture && pointers.size === 1) gesture.onImage = event.target === big;
    big.style.transition = 'none';
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size > 1) {
      const m = midpoint();
      gesture.moved = true;
      // Zoom about where the fingers started, then follow their midpoint.
      x = gesture.x;
      y = gesture.y;
      z = gesture.z;
      zoomAt(gesture.z * (m.dist / (gesture.dist || 1)), gesture.px, gesture.py);
      x += m.x - gesture.px;
      y += m.y - gesture.py;
      bound();
      render();
      return;
    }

    const dx = event.clientX - gesture.px;
    const dy = event.clientY - gesture.py;
    if (!gesture.moved && Math.hypot(dx, dy) < TAP) return;
    gesture.moved = true;
    if (z > 1.001) {
      x = gesture.x + dx;
      y = gesture.y + dy;
      bound();
      render();
    } else if (event.pointerType !== 'mouse') {
      // Unzoomed on a touch screen: the image follows the finger down, the backdrop fades.
      y = Math.max(0, dy);
      x = 0;
      render();
      backdrop.style.opacity = String(1 - Math.min(0.7, y / (DISMISS * 2.5)));
    }
    big.classList.add('is-dragging');
  });

  const end = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId) || !gesture) return;
    big.classList.remove('is-dragging');
    if (pointers.size > 0) {
      // One finger lifted from a pinch: carry on panning with the other.
      begin();
      return;
    }
    const g = gesture;
    gesture = null;
    if (g.moved) {
      if (z <= 1.001 && y > DISMISS) return close();
      if (z <= 1.001) {
        backdrop.style.opacity = '';
        reset();
      }
      return;
    }
    if (event.type === 'pointercancel') return;
    // A click or tap: on the image it toggles zoom, anywhere else it closes.
    if (g.onImage) {
      if (z > 1.001) reset();
      else zoomAt(2.5, event.clientX, event.clientY, true);
    } else close();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  // Clicks on the backdrop around the toolbar close too.
  bottom.addEventListener('click', (event) => {
    if (event.target === bottom) close();
  });
}

export function initImageZoom(root: ParentNode = document) {
  for (const img of root.querySelectorAll<HTMLImageElement>('.prose img')) {
    // Images inside links keep doing what the link says.
    if (img.closest('a')) continue;
    img.classList.add('zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(img);
      }
    });
  }
}
