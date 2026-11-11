import type { KubaiIconData } from 'kubai-icons';
import { at, f } from './kit';

/**
 * The X mark on a square tile; on hover it turns half a turn, which lands it as it was.
 *
 * Drawn to the Kubai Icons rules; `markup` is the rest pose as the Kubai Icons renderer
 * outputs it, and target/draw give the hover motion.
 */
const icon: KubaiIconData = {
  name: 'x',
  markup: "<defs><linearGradient id=\"loS-__K__\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 62.9%,#fff)\"/><stop offset=\"1\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 74.7%,#fff)\"/></linearGradient><linearGradient id=\"upS-__K__\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 29.6%,#fff)\"/><stop offset=\"1\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 47.9%,#fff)\"/></linearGradient><filter id=\"sh-__K__\" x=\"-40%\" y=\"-40%\" width=\"180%\" height=\"190%\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"2\"/><feOffset dy=\"2\" result=\"o\"/><feFlood style=\"flood-color:color-mix(in srgb,var(--ki-c,currentColor) 67.8%,#fff)\" flood-opacity=\"0.21\"/><feComposite in2=\"o\" operator=\"in\"/><feMerge><feMergeNode/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter><filter id=\"hi-__K__\" x=\"-10%\" y=\"-10%\" width=\"120%\" height=\"130%\" color-interpolation-filters=\"sRGB\"><feColorMatrix in=\"SourceAlpha\" type=\"matrix\" values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0\" result=\"a\"/><feOffset in=\"a\" dy=\"0.7\"/><feGaussianBlur stdDeviation=\"0.35\"/><feComposite in2=\"a\" operator=\"arithmetic\" k2=\"-1\" k3=\"1\"/><feColorMatrix type=\"matrix\" values=\"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0\"/><feBlend in2=\"SourceGraphic\" mode=\"overlay\"/></filter><mask id=\"ol-__K__-0\" maskUnits=\"userSpaceOnUse\" x=\"-40\" y=\"-40\" width=\"111\" height=\"109\"><rect x=\"-40\" y=\"-40\" width=\"111\" height=\"109\" fill=\"#fff\"/><path d=\"M5.2 4.4Q5.2 2.2 7.4 2.2L23.6 2.2Q25.8 2.2 25.8 4.4L25.8 20.6Q25.8 22.8 23.6 22.8L7.4 22.8Q5.2 22.8 5.2 20.6Z\" fill=\"#000\"/></mask></defs><path d=\"M5.2 4.4Q5.2 2.2 7.4 2.2L23.6 2.2Q25.8 2.2 25.8 4.4L25.8 20.6Q25.8 22.8 23.6 22.8L7.4 22.8Q5.2 22.8 5.2 20.6Z\" fill=\"none\" stroke-width=\"1\" data-under=\"0\" stroke=\"url(#loS-__K__)\"/><g filter=\"url(#sh-__K__)\"><g filter=\"url(#hi-__K__)\"><path d=\"M5.2 4.4Q5.2 2.2 7.4 2.2L23.6 2.2Q25.8 2.2 25.8 4.4L25.8 20.6Q25.8 22.8 23.6 22.8L7.4 22.8Q5.2 22.8 5.2 20.6Z\" fill=\"url(#loS-__K__)\" data-over=\"0\"/></g></g><path d=\"M5.2 4.4Q5.2 2.2 7.4 2.2L23.6 2.2Q25.8 2.2 25.8 4.4L25.8 20.6Q25.8 22.8 23.6 22.8L7.4 22.8Q5.2 22.8 5.2 20.6Z\" mask=\"url(#ol-__K__-0)\" fill=\"none\" stroke-width=\"2\" style=\"stroke:var(--ki-e,var(--ki-c,currentColor))\"/><g data-n=\"m\" transform=\"rotate(0 15.5 12.5)\"><path transform=\"translate(9.5 6.5) scale(0.5)\" d=\"M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z\" style=\"fill:var(--ki-w,#fff)\"/></g>",
  target: (h) => ({ a: h ? 180 : 0 }),
  draw: (p, E) => {
    at(E.m, { transform: `rotate(${f(p.a as number)} 15.5 12.5)` });
  },
  tap: false,
};

export default icon;
