import rss from '@astrojs/rss';
import type { APIContext, ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import path from 'node:path';
import { site } from '../config/site';
import type { Lang } from '../i18n/ui';
import { listPosts, postHref, postSlug, type Post } from './posts';
import { withBase } from './url';

/** One feed per post and locale, next to the post: /blog/<slug>/rss.xml. */
export async function postFeedPaths(lang: Lang) {
  return (await listPosts(lang)).map(({ post }) => ({ params: { slug: postSlug(post) }, props: { post, lang } }));
}

// Every image a post can use, so the feed can point at its built copy.
const images = import.meta.glob<{ default: ImageMetadata }>('/posts/**/*.{png,jpg,jpeg,webp,gif,avif}', { eager: true });

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * The post's HTML made to stand alone in a feed reader: Markdown images (left as
 * placeholders until the page renders them) become built images, and site-relative links
 * become absolute.
 */
async function standalone(post: Post, origin: string) {
  let html = post.rendered?.html ?? '';
  const dir = `/${path.posix.dirname(post.filePath ?? '')}`;
  for (const [tag, json] of html.matchAll(/<img __ASTRO_IMAGE_="([^"]*)"\s*\/?>/g).map((m) => [m[0], m[1]] as const)) {
    const { src, alt = '' } = JSON.parse(unescape(json)) as { src: string; alt?: string };
    const file = images[path.posix.join(dir, src)]?.default;
    const url = file ? (await getImage({ src: file, width: 1200 })).src : src;
    html = html.replace(tag, `<img src="${escape(new URL(url, origin).href)}" alt="${escape(alt)}">`);
  }
  return html
    .replace(/<button[^>]*data-copy-code[^>]*>[\s\S]*?<\/button>/g, '') // copy buttons do nothing in a reader
    .replace(/(href|src)="(\/[^"]*)"/g, (_, attr, url) => `${attr}="${new URL(url, origin).href}"`);
}

/** A feed holding the post itself, with its full text, for following that one post. */
export async function postFeed(context: APIContext) {
  const { post, lang } = context.props as { post: Post; lang: Lang };
  const base = new URL(withBase('/'), context.site ?? 'https://example.com').href;
  const link = new URL(postHref(post, lang), base).href;
  return rss({
    title: `${post.data.title} · ${site.meta[lang].title}`,
    description: post.data.description ?? site.meta[lang].description,
    site: base,
    items: [
      {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.updated ?? post.data.date,
        link,
        categories: post.data.tags,
        content: await standalone(post, base),
      },
    ],
    customData: `<language>${post.data.lang === 'zh' ? 'zh-CN' : 'en'}</language>`,
  });
}
