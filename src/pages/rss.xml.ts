import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../config/site';
import { listPosts, postHref } from '../lib/posts';
import { withBase } from '../lib/url';

export async function GET(context: APIContext) {
  // One item per post, in Chinese where a translation exists, linking to the Chinese pages.
  const posts = (await listPosts('zh')).map((entry) => entry.post);
  return rss({
    title: site.meta.zh.title,
    description: site.meta.zh.description,
    site: new URL(withBase('/'), context.site ?? 'https://example.com').href,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postHref(post, 'zh'),
      categories: post.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
