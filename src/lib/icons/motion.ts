import { animate, bindTrigger } from 'kubai-icons/runtime';
import { ICONS, type IconName } from './index';

/**
 * Adds the hover motion to icons rendered by Icon.astro. Nothing loads up front: the
 * first time the pointer (or keyboard focus) reaches the link or button around an icon,
 * that icon's module is fetched and bound, and from then on the icon library's own
 * trigger handles hover, focus and taps.
 */
export function initIconMotion(root: ParentNode = document) {
  for (const svg of root.querySelectorAll<SVGSVGElement>('svg[data-icon]:not([data-bound])')) {
    const load = ICONS[svg.dataset.icon as IconName];
    if (!load) continue;
    svg.dataset.bound = '';
    const trigger = svg.closest<HTMLElement>('a, button') ?? svg.parentElement;
    if (!trigger) continue;

    let inside = false;
    const track = (event: Event) => (inside = event.type !== 'pointerleave' && event.type !== 'focusout');
    const start = (event: Event) => {
      track(event);
      trigger.removeEventListener('pointerenter', start);
      trigger.removeEventListener('focusin', start);
      trigger.addEventListener('pointerleave', track);
      trigger.addEventListener('focusout', track);
      load().then(({ default: icon }) => {
        trigger.removeEventListener('pointerleave', track);
        trigger.removeEventListener('focusout', track);
        const controller = animate(svg, icon);
        bindTrigger(trigger, controller, icon);
        // The trigger missed the first enter; play it if the pointer is still there.
        if (inside) controller.hover(true);
      });
    };
    trigger.addEventListener('pointerenter', start);
    trigger.addEventListener('focusin', start);
  }
}
