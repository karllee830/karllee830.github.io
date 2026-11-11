import type { Lang } from '../i18n/ui';
import { listPosts, postSlug } from './posts';

/**
 * Static paths for one locale: a page for every post, showing the version in that
 * language when there is one and the original otherwise, with neighbours for the pager.
 */
export async function postPaths(lang: Lang) {
  const entries = await listPosts(lang);
  return entries.map((entry, index) => ({
    params: { slug: postSlug(entry.post) },
    props: { entry, lang, prev: entries[index + 1]?.post, next: entries[index - 1]?.post },
  }));
}
