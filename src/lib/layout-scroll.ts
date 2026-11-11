/**
 * Page chrome that reacts to scrolling:
 * - the narrow-screen header scrolls away with the page and returns as a
 *   floating bar once the page's opening has left the screen;
 * - outline links and the dock label follow the section being read;
 * - scrollable lists fade their edges and show arrows while more is hidden;
 * - bottom sheets (the dock's menus) open and close.
 */

const NARROW = '(max-width: 1023px)';
const READING_LINE = 0.2;
const EXIT_MS = 120;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calls `fn` at most once per animation frame. */
function perFrame(fn: () => void) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

function initFloatingHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;
  const opening = document.querySelector<HTMLElement>('[data-page-opening]') ?? header;
  const narrow = window.matchMedia(NARROW);

  let state: 'static' | 'floating' | 'leaving' = 'static';
  let exitTimer = 0;

  const set = (next: typeof state) => {
    state = next;
    if (next === 'static') delete header.dataset.float;
    else header.dataset.float = next;
  };

  const update = () => {
    const shouldFloat = narrow.matches && opening.getBoundingClientRect().bottom <= 0;
    if (shouldFloat) {
      // Scrolling down again during the exit cancels it.
      window.clearTimeout(exitTimer);
      if (state !== 'floating') set('floating');
      return;
    }
    if (state === 'floating') {
      if (reducedMotion() || !narrow.matches) {
        set('static');
        return;
      }
      set('leaving');
      exitTimer = window.setTimeout(() => set('static'), EXIT_MS);
    }
  };

  const onScroll = perFrame(update);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  narrow.addEventListener('change', update);
  update();
}

function initOutlineTracking() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-outline-link]')];
  if (!links.length) return;

  const ids = [...new Set(links.map((link) => link.dataset.outlineLink!))];
  const headings = ids
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  const labels = document.querySelectorAll<HTMLElement>('[data-outline-label]');
  let current = '';

  const update = () => {
    const line = window.innerHeight * READING_LINE;
    let active = headings[0];
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= line) active = heading;
      else break;
    }
    // At the very bottom the last section is the one being read.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = headings[headings.length - 1];
    }
    if (!active || active.id === current) return;
    current = active.id;

    for (const link of links) {
      if (link.dataset.outlineLink === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    const text = links.find((link) => link.dataset.outlineLink === current)?.textContent?.trim() ?? '';
    labels.forEach((label) => (label.textContent = text));

    // Keep the active entry visible inside the sidebar list.
    document.querySelectorAll<HTMLElement>('[data-scroll-fade]').forEach((list) => {
      const link = list.querySelector<HTMLElement>('[aria-current="location"]');
      if (link) revealInList(list, link);
    });
  };

  const onScroll = perFrame(update);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/** Scrolls `list` (not the page) so that `item` is inside its visible band. */
function revealInList(list: HTMLElement, item: HTMLElement) {
  const margin = 48;
  const top = item.offsetTop - list.offsetTop;
  const bottom = top + item.offsetHeight;
  if (top < list.scrollTop + margin) list.scrollTop = Math.max(0, top - margin);
  else if (bottom > list.scrollTop + list.clientHeight - margin) {
    list.scrollTop = bottom - list.clientHeight + margin;
  }
}

function initScrollFades() {
  document.querySelectorAll<HTMLElement>('[data-scroll-fade]').forEach((list) => {
    const container = list.parentElement!;
    const sync = () => {
      const above = list.scrollTop > 1;
      const below = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
      container.toggleAttribute('data-more-above', above);
      container.toggleAttribute('data-more-below', below);
    };

    container.querySelectorAll<HTMLElement>('[data-scroll-arrow]').forEach((arrow) => {
      arrow.addEventListener('click', () => {
        const direction = arrow.dataset.scrollArrow === 'up' ? -1 : 1;
        list.scrollBy({
          top: direction * list.clientHeight * 0.6,
          behavior: reducedMotion() ? 'auto' : 'smooth',
        });
      });
    });

    list.addEventListener('scroll', perFrame(sync), { passive: true });
    new ResizeObserver(sync).observe(list);
    sync();
  });
}

function initSheets() {
  const closeSheet = (sheet: HTMLDialogElement) => {
    if (!sheet.open || sheet.dataset.closing !== undefined) return;
    if (reducedMotion()) {
      sheet.close();
      return;
    }
    sheet.dataset.closing = '';
    window.setTimeout(() => {
      delete sheet.dataset.closing;
      sheet.close();
    }, EXIT_MS);
  };

  document.querySelectorAll<HTMLElement>('[data-open-sheet]').forEach((trigger) => {
    const sheet = document.getElementById(trigger.dataset.openSheet!) as HTMLDialogElement | null;
    if (!sheet) return;
    trigger.addEventListener('click', () => {
      sheet.showModal();
      const current = sheet.querySelector<HTMLElement>('[aria-current]');
      current?.scrollIntoView({ block: 'center' });
    });
  });

  document.querySelectorAll<HTMLDialogElement>('dialog[data-sheet]').forEach((sheet) => {
    sheet.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      // Backdrop clicks land on the dialog itself; entries and the close button close too.
      if (target === sheet || target.closest('a, [data-close-sheet]')) closeSheet(sheet);
    });
    sheet.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeSheet(sheet);
    });
  });
}

export function initLayoutScroll() {
  initFloatingHeader();
  initScrollFades();
  initOutlineTracking();
  initSheets();
}
