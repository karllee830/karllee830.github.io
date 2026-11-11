import { getCollection, type CollectionEntry } from 'astro:content';
import { langs, localePath, type Lang } from '../i18n/ui';

export type Post = CollectionEntry<'blog'>;

const LANG_SUFFIX = /\.(zh|en)$/;

/** The URL name of a post, shared by its translations ("my-post.en" → "my-post"). */
export const postSlug = (post: Post) => post.id.replace(LANG_SUFFIX, '');

/**
 * Published posts (every language version), newest first. Drafts are visible in dev only.
 * A translation file ("index.en.md") is in the language its name says.
 */
export async function getPosts(lang?: Lang): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  for (const post of posts) {
    const suffix = LANG_SUFFIX.exec(post.id)?.[1] as Lang | undefined;
    if (suffix) post.data.lang = suffix;
  }
  return posts
    .filter((post) => !lang || post.data.lang === lang)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/**
 * Every post has a page in each locale; the interface follows the locale and the text
 * stays in the language it was written in. Defaults to the post's own locale.
 */
export function postHref(post: Post, lang: Lang = post.data.lang): string {
  return localePath(lang, `/blog/${postSlug(post)}/`);
}

/** One row of a post list: the version to show, and every language the post is in. */
export interface PostEntry {
  post: Post;
  langs: Lang[];
}

/**
 * One entry per post, newest first: the version in `lang` when there is one, otherwise
 * the version that exists, together with the languages it is written in.
 */
export async function listPosts(lang: Lang): Promise<PostEntry[]> {
  const groups = new Map<string, Post[]>();
  for (const post of await getPosts()) {
    const slug = postSlug(post);
    groups.set(slug, [...(groups.get(slug) ?? []), post]);
  }
  return [...groups.values()]
    .map((versions) => ({
      post: versions.find((v) => v.data.lang === lang) ?? versions[0],
      langs: langs.filter((l) => versions.some((v) => v.data.lang === l)),
    }))
    .sort((a, b) => b.post.data.date.valueOf() - a.post.data.date.valueOf());
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
