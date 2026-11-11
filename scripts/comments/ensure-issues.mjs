// Opens a comment issue for every published post that has none yet, so the site can link
// visitors straight to it. Run by the deploy workflow before the build.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo SITE_URL=https://… node scripts/comments/ensure-issues.mjs
//
// An issue's title is the post's comment term, "blog/<slug>" (see src/views/PostView.astro).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const LABEL = process.env.COMMENT_LABEL ?? 'comment';
const POSTS = path.resolve('posts');
const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, SITE_URL: site = '', BASE_PATH: base = '' } = process.env;

if (!token || !repo) {
  console.log('GITHUB_TOKEN or GITHUB_REPOSITORY missing; skipping comment issues.');
  process.exit(0);
}

const api = async (route, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${route}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
  });
  if (!res.ok && res.status !== 404) throw new Error(`${init.method ?? 'GET'} ${route}: ${res.status} ${await res.text()}`);
  return res;
};

/** Post slugs, as src/content.config.ts derives them; translations share one. */
async function slugs() {
  const found = new Set();
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.md') && entry.name !== 'README.md' && !entry.name.startsWith('_')) {
        const text = await readFile(file, 'utf8');
        const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
        if (/^draft:\s*true\s*$/m.test(front)) continue;
        const slug = /^slug:\s*["']?(.+?)["']?\s*$/m.exec(front)?.[1];
        const id = slug
          ? slug.replace(/^\/+|\/+$/g, '')
          : path
              .relative(POSTS, file)
              .replace(/\.md$/i, '')
              .replace(/\.(zh|en)$/i, '')
              .replace(/(^|\/)index$/i, '')
              .split('/')
              .map((part) => part.trim().toLowerCase().replace(/\s+/g, '-'))
              .join('/');
        found.add(id);
      }
    }
  };
  await walk(POSTS);
  return found;
}

const existing = new Set();
for (let page = 1; ; page++) {
  const issues = await (await api(`/issues?labels=${encodeURIComponent(LABEL)}&state=all&per_page=100&page=${page}`)).json();
  for (const issue of issues) if (!issue.pull_request) existing.add(issue.title);
  if (issues.length < 100) break;
}

if ((await api(`/labels/${encodeURIComponent(LABEL)}`)).status === 404) {
  await api('/labels', { method: 'POST', body: JSON.stringify({ name: LABEL, color: '669fd0', description: 'Comments on a blog post' }) });
}

for (const slug of await slugs()) {
  const term = `blog/${slug}`;
  if (existing.has(term)) continue;
  const url = site ? `${site.replace(/\/$/, '')}${base.replace(/\/$/, '')}/blog/${slug}/` : '';
  const body = [
    `${url ? `[${url}](${url})\n\n` : ''}在下方留言即可，审核通过后会显示在文章页。`,
    'Leave a comment below; it appears on the post once approved.',
  ].join('\n\n');
  await api('/issues', { method: 'POST', body: JSON.stringify({ title: term, body, labels: [LABEL] }) });
  console.log(`Opened ${term}`);
}
