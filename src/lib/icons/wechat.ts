import type { KubaiIconData } from 'kubai-icons';
import { at, f } from './kit';

/**
 * Two round chat bubbles with eyes; on hover the one behind leans back and the one in front looks up.
 *
 * Drawn to the Kubai Icons rules; `markup` is the rest pose as the Kubai Icons renderer
 * outputs it, and target/draw give the hover motion.
 */
const icon: KubaiIconData = {
  name: 'wechat',
  markup: "<defs><linearGradient id=\"loS-__K__\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 62.9%,#fff)\"/><stop offset=\"1\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 74.7%,#fff)\"/></linearGradient><linearGradient id=\"upS-__K__\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 29.6%,#fff)\"/><stop offset=\"1\" style=\"stop-color:color-mix(in srgb,var(--ki-c,currentColor) 47.9%,#fff)\"/></linearGradient><filter id=\"sh-__K__\" x=\"-40%\" y=\"-40%\" width=\"180%\" height=\"190%\" color-interpolation-filters=\"sRGB\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"2\"/><feOffset dy=\"2\" result=\"o\"/><feFlood style=\"flood-color:color-mix(in srgb,var(--ki-c,currentColor) 67.8%,#fff)\" flood-opacity=\"0.21\"/><feComposite in2=\"o\" operator=\"in\"/><feMerge><feMergeNode/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter><filter id=\"hi-__K__\" x=\"-10%\" y=\"-10%\" width=\"120%\" height=\"130%\" color-interpolation-filters=\"sRGB\"><feColorMatrix in=\"SourceAlpha\" type=\"matrix\" values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0\" result=\"a\"/><feOffset in=\"a\" dy=\"0.7\"/><feGaussianBlur stdDeviation=\"0.35\"/><feComposite in2=\"a\" operator=\"arithmetic\" k2=\"-1\" k3=\"1\"/><feColorMatrix type=\"matrix\" values=\"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0\"/><feBlend in2=\"SourceGraphic\" mode=\"overlay\"/></filter><mask id=\"ol-__K__-0\" maskUnits=\"userSpaceOnUse\" x=\"-40\" y=\"-40\" width=\"111\" height=\"109\"><rect x=\"-40\" y=\"-40\" width=\"111\" height=\"109\" fill=\"#fff\"/><path d=\"M5.125 13.2A8.4 6.8 0 1 1 9.253 16.105L6.75 18.479Q6.2 19 6.007 17.956Z\" fill=\"#000\"/></mask><mask id=\"ol-__K__-1\" maskUnits=\"userSpaceOnUse\" x=\"-40\" y=\"-40\" width=\"111\" height=\"109\"><rect x=\"-40\" y=\"-40\" width=\"111\" height=\"109\" fill=\"#fff\"/><path d=\"M22.163 20.526A7 5.6 0 1 1 25.362 18.8L25.885 21.752Q26 22.4 25.309 22.063Z\" fill=\"#000\"/></mask></defs><g data-n=\"b\" transform=\"translate(0 0)\"><path d=\"M5.125 13.2A8.4 6.8 0 1 1 9.253 16.105L6.75 18.479Q6.2 19 6.007 17.956Z\" fill=\"none\" stroke-width=\"1\" data-under=\"0\" stroke=\"url(#loS-__K__)\"/><g filter=\"url(#sh-__K__)\"><g filter=\"url(#hi-__K__)\"><path d=\"M5.125 13.2A8.4 6.8 0 1 1 9.253 16.105L6.75 18.479Q6.2 19 6.007 17.956Z\" fill=\"url(#loS-__K__)\" data-over=\"0\"/></g></g><path d=\"M5.125 13.2A8.4 6.8 0 1 1 9.253 16.105L6.75 18.479Q6.2 19 6.007 17.956Z\" mask=\"url(#ol-__K__-0)\" fill=\"none\" stroke-width=\"2\" style=\"stroke:var(--ki-e,var(--ki-c,currentColor))\"/><circle cx=\"9.4\" cy=\"8.6\" r=\"1.3\" style=\"fill:var(--ki-w,#fff)\"/><circle cx=\"15.4\" cy=\"8.6\" r=\"1.3\" style=\"fill:var(--ki-w,#fff)\"/></g><path d=\"M22.163 20.526A7 5.6 0 1 1 25.362 18.8L25.885 21.752Q26 22.4 25.309 22.063Z\" fill=\"none\" stroke-width=\"1\" data-under=\"1\" stroke=\"url(#upS-__K__)\"/><g filter=\"url(#sh-__K__)\"><g filter=\"url(#hi-__K__)\"><path d=\"M22.163 20.526A7 5.6 0 1 1 25.362 18.8L25.885 21.752Q26 22.4 25.309 22.063Z\" fill=\"url(#upS-__K__)\" data-over=\"1\"/></g></g><path d=\"M22.163 20.526A7 5.6 0 1 1 25.362 18.8L25.885 21.752Q26 22.4 25.309 22.063Z\" mask=\"url(#ol-__K__-1)\" fill=\"none\" stroke-width=\"2\" style=\"stroke:var(--ki-e,var(--ki-c,currentColor))\"/><circle data-n=\"e1\" cx=\"17.4\" r=\"1.2\" cy=\"14.6\" style=\"fill:color-mix(in srgb,var(--ki-e,var(--ki-c,currentColor)) 72.9%,#000)\"/><circle data-n=\"e2\" cx=\"22.6\" r=\"1.2\" cy=\"14.6\" style=\"fill:color-mix(in srgb,var(--ki-e,var(--ki-c,currentColor)) 72.9%,#000)\"/>",
  target: (h) => ({ b: h ? -0.8 : 0, y: h ? -1 : 0 }),
  draw: (p, E) => {
    const b = f(p.b as number);
    const y = f(14.6 + (p.y as number));
    at(E.b, { transform: `translate(${b} ${b})` });
    at(E.e1, { cy: y });
    at(E.e2, { cy: y });
  },
  tap: false,
};

export default icon;
