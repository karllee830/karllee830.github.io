import type { APIContext } from 'astro';
import { postFeed, postFeedPaths } from '../../../../lib/post-feed';

export const getStaticPaths = () => postFeedPaths('en');

export const GET = (context: APIContext) => postFeed(context);
