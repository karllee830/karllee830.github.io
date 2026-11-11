import type { Lang } from '../i18n/ui';
import { getPosts } from './posts';

/** Static paths for posts written in `lang`, with neighbours for the pager. */
export async function postPaths(lang: Lang) {
  const posts = await getPosts(lang);
  return posts.map((post, index) => ({
    params: { slug: post.id },
    props: { post, prev: posts[index + 1], next: posts[index - 1] },
  }));
}
