import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Turns "posts/my-post/index.md" or "posts/my-post.md" into "my-post". */
function postId(entry: string, slug?: unknown): string {
  if (typeof slug === 'string' && slug.trim()) return slug.trim().replace(/^\/+|\/+$/g, '');
  return entry
    .replace(/\.md$/i, '')
    .replace(/(^|\/)index$/i, '')
    .split('/')
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, '-'))
    .join('/');
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
