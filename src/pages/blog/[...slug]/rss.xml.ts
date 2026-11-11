import type { APIContext } from 'astro';
import { postFeed, postFeedPaths } from '../../../lib/post-feed';

export const getStaticPaths = () => postFeedPaths('zh');

export const GET = (context: APIContext) => postFeed(context);
