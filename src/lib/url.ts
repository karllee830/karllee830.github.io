/** Prefixes an internal path with the configured base (e.g. a GitHub Pages project path). */
export function withBase(path: string): string {
  if (/^([a-z]+:|#|\/\/)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Removes the base prefix from a pathname, returning a path that starts with "/". */
export function stripBase(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && pathname.startsWith(base)) return pathname.slice(base.length) || '/';
  return pathname;
}
