import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// A translation sits next to the original as "index.en.md" (or "index.zh.md").
const LANG_SUFFIX = /\.(zh|en)$/i;

/**
 * Turns "posts/my-post/index.md" or "posts/my-post.md" into "my-post", and the translation
 * "posts/my-post/index.en.md" into "my-post.en", so both versions share the slug "my-post".
 */
function postId(entry: string, slug?: unknown): string {
  const path = entry.replace(/\.md$/i, '');
  const suffix = LANG_SUFFIX.exec(path)?.[1].toLowerCase();
  const id =
    typeof slug === 'string' && slug.trim()
      ? slug.trim().replace(/^\/+|\/+$/g, '')
      : path
          .replace(LANG_SUFFIX, '')
          .replace(/(^|\/)index$/i, '')
          .split('/')
          .map((part) => part.trim().toLowerCase().replace(/\s+/g, '-'))
          .join('/');
  return suffix ? `${id}.${suffix}` : id;
}

const blog = defineCollection({
  loader: glob({
    base: './posts',
    pattern: ['**/*.md', '!**/README.md', '!**/_*.md'],
    generateId: ({ entry, data }) => postId(entry, data.slug),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      lang: z.enum(['zh', 'en']).default('zh'),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      slug: z.string().optional(),
    }),
});

export const collections = { blog };
