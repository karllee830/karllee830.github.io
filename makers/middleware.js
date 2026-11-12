// EdgeOne Makers middleware, copied into the deployed folder by the deploy workflow.
// Sends the bare domain to www (the apex resolves here too, see scripts/dns/flatten-apex.mjs)
// and keeps this file itself from being served as a static asset.
const APEX = 'leekarl.com';
const WWW = 'www.leekarl.com';

export function middleware({ request, redirect, next }) {
  const url = new URL(request.url);
  if (url.hostname === APEX) {
    url.protocol = 'https:';
    url.hostname = WWW;
    url.port = '';
    return redirect(url.toString(), 301);
  }
  if (url.pathname === '/middleware.js') {
    return new Response('Not Found', { status: 404 });
  }
  return next();
}
