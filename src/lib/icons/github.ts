import type { KubaiIconData } from 'kubai-icons';
import { at, f } from './kit';

/**
 * The GitHub mark on a round tile; on hover the Octocat tilts its head.
 *
 * Drawn to the Kubai Icons rules; `markup` is the rest pose as the Kubai Icons renderer
 * outputs it, and target/draw give the hover motion.
 */
const icon: KubaiIconData = {
  name: 'github',
  markup: "<defs><linearGradient id=\"loS-__K__\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 62.9%,#fff)\"/><stop offset=\"1\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 74.7%,#fff)\"/></linearGradient><linearGradient id=\"upS-__K__\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 29.6%,#fff)\"/><stop offset=\"1\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 47.9%,#fff)\"/></linearGradient><filter id=\"sh-__K__\" x=\"-40%\" y=\"-40%\" width=\"180%\" height=\"190%\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"2\"/><feOffset dy=\"2\" result=\"o\"/><feFlood style=\"flood-color:color-mix(in srgb,var(--ki-c,currentColor) 67.8%,#fff)\" flood-opacity=\"0.21\"/><feComposite in2=\"o\" operator=\"in\"/><feMerge><feMergeNode/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter><filter id=\"hi-__K__\" x=\"-10%\" y=\"-10%\" width=\"120%\" height=\"130%\" color-interpolation-filters=\"sRGB\"><feColorMatrix in=\"SourceAlpha\" type=\"matrix\" values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0\" result=\"a\"/><feOffset in=\"a\" dy=\"0.7\"/><feGaussianBlur stdDeviation=\"0.35\"/><feComposite in2=\"a\" operator=\"arithmetic\" k2=\"-1\" k3=\"1\"/><feColorMatrix type=\"matrix\" values=\"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0\"/><feBlend in2=\"SourceGraphic\" mode=\"overlay\"/></filter><mask id=\"ol-__K__-0\" maskUnits=\"userSpaceOnUse\" x=\"-40\" y=\"-40\" width=\"111\" height=\"109\"><rect x=\"-40\" y=\"-40\" width=\"111\" height=\"109\" fill=\"#fff\"/><path d=\"M4 12.5A11.5 11.5 0 1 0 27 12.5A11.5 11.5 0 1 0 4 12.5Z\" fill=\"#000\"/></mask></defs><path d=\"M4 12.5A11.5 11.5 0 1 0 27 12.5A11.5 11.5 0 1 0 4 12.5Z\" fill=\"none\" stroke-width=\"1\" data-under=\"0\" stroke=\"url(#loS-__K__)\"/><g filter=\"url(#sh-__K__)\"><g filter=\"url(#hi-__K__)\"><path d=\"M4 12.5A11.5 11.5 0 1 0 27 12.5A11.5 11.5 0 1 0 4 12.5Z\" fill=\"url(#loS-__K__)\" data-over=\"0\"/></g></g><path d=\"M4 12.5A11.5 11.5 0 1 0 27 12.5A11.5 11.5 0 1 0 4 12.5Z\" mask=\"url(#ol-__K__-0)\" fill=\"none\" stroke-width=\"2\" style=\"stroke:var(--ki-e,var(--ki-c,currentColor))\"/><clipPath id=\"gh-__K__\"><path d=\"M4 12.5A11.5 11.5 0 1 0 27 12.5A11.5 11.5 0 1 0 4 12.5Z\"/></clipPath><g clip-path=\"url(#gh-__K__)\"><g data-n=\"cat\" transform=\"rotate(0 15.5 14)\"><path transform=\"translate(4 0.715) scale(0.958)\" fill-rule=\"evenodd\" d=\"M-2 -2H26V26H-2ZM12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12\" style=\"fill:var(--ki-w,#fff)\"/></g></g>",
  target: (h) => ({ a: h ? -14 : 0 }),
  draw: (p, E) => {
    at(E.cat, { transform: `rotate(${f(p.a as number)} 15.5 14)` });
  },
  tap: false,
};

export default icon;
