import { site } from '../config/site';
// Plain JS, shared with the moderation workflow.
import { isShown, reviews } from '../../scripts/comments/moderation.mjs';

export interface PostComment {
  id: number;
  author: string;
  authorUrl: string;
  avatar: string;
  url: string;
  /** Rendered and sanitised by GitHub. */
  html: string;
  createdAt: Date;
}

export interface Thread {
  issueUrl: string;
  comments: PostComment[];
}

interface ApiUser {
  login: string;
  type: string;
  html_url: string;
  avatar_url: string;
}

interface ApiComment {
  id: number;
  user: ApiUser | null;
  body?: string;
  body_html?: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface ApiIssue {
  number: number;
  title: string;
  html_url: string;
  pull_request?: unknown;
}

const API = 'https://api.github.com';

async function getAll<T>(route: string): Promise<T[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    // Both the Markdown source (for review notes) and GitHub's sanitised HTML.
    Accept: 'application/vnd.github.full+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GET ${route}: ${res.status}`);
    const batch = (await res.json()) as T[];
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function load(): Promise<Map<string, Thread>> {
  const threads = new Map<string, Thread>();
  if (!site.comments.enabled) return threads;
  const { repo, label } = site.comments;
  const owner = repo.split('/')[0];
  try {
    const issues = await getAll<ApiIssue>(`/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all`);
    await Promise.all(
      issues
        .filter((issue) => !issue.pull_request)
        .map(async (issue) => {
          const all = await getAll<ApiComment>(`/repos/${repo}/issues/${issue.number}/comments`);
          const decided = reviews(all);
          threads.set(issue.title, {
            issueUrl: issue.html_url,
            comments: all
              .filter((c) => isShown(c, decided, owner))
              .map((c) => ({
                id: c.id,
                author: c.user!.login,
                authorUrl: c.user!.html_url,
                avatar: c.user!.avatar_url,
                url: c.html_url,
                html: c.body_html ?? '',
                createdAt: new Date(c.created_at),
              })),
          });
        }),
    );
  } catch (error) {
    // No network, no repository yet or rate limited: pages build without comments.
    console.warn(`[comments] ${(error as Error).message}; building without comments.`);
  }
  return threads;
}

let cached: Promise<Map<string, Thread>> | undefined;

/** Approved comments of every post, by comment term; fetched once per build. */
export function getThreads() {
  cached ??= load();
  return cached;
}
