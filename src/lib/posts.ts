import { getCollection, type CollectionEntry } from 'astro:content';
import { localePath, type Lang } from '../i18n/ui';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. Drafts are visible in dev only. */
export async function getPosts(lang?: Lang): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts
    .filter((post) => !lang || post.data.lang === lang)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** A post lives under the locale of the language it is written in. */
export function postHref(post: Post): string {
  return localePath(post.data.lang, `/blog/${post.id}/`);
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/g;

export function readingMinutes(body = ''): number {
  const text = body.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*]\([^)]*\)/g, ' ');
  const cjk = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO-style date in UTC, e.g. 2026-11-11. */
export function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Month and day only, for lists grouped by year. */
export function formatMonthDay(date: Date): string {
  return `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
