// Comment moderation shared by the GitHub workflow (scripts/comments/moderate.mjs) and the
// site build (src/lib/comments.ts).
//
// Visitors comment on a post's issue. For each comment the bot posts a review note in the
// same issue, with task-list checkboxes; ticking one edits the note, which runs the
// workflow again. The decision lives in a hidden marker at the top of the note, and the
// build shows a visitor's comment only when its note says it was approved after the
// comment's last edit.

/** Login of the bot that writes review notes (the workflow's GITHUB_TOKEN). */
export const BOT_LOGIN = 'github-actions[bot]';

const MARKER = /^<!--\s*comment-moderation\s+(\{[^\n]*?\})\s*-->/;

/** Checkbox labels, matched by their first word. */
export const ACTIONS = {
  approve: '通过 Approve',
  reject: '拒绝 Reject',
  reopen: '撤销，重新审核 Undo',
};

/**
 * @typedef {'pending' | 'approved' | 'rejected' | 'deleted'} ReviewState
 * @typedef {{ id: number, state: ReviewState, at?: string, by?: string }} Marker
 */

/** Reads the marker of a review note, or null for any other comment. */
export function readMarker(body = '') {
  const match = MARKER.exec(body);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    return typeof data.id === 'number' && typeof data.state === 'string' ? /** @type {Marker} */ (data) : null;
  } catch {
    return null;
  }
}

/** A fenced block that the comment's own backticks cannot close. */
function fence(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const ticks = '`'.repeat(longest + 1);
  return `${ticks}text\n${text}\n${ticks}`;
}

/** Comment text for the note: trimmed, and shown verbatim so it cannot add checkboxes or mentions. */
function excerpt(body = '', limit = 800) {
  const text = body.replace(/\r\n/g, '\n').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

const checkbox = (label) => `- [ ] ${label}`;

/**
 * The body of a review note.
 * @param {Marker & { author: string, url: string, body?: string }} note
 */
export function renderNote({ id, state, at, by, author, url, body }) {
  const marker = `<!-- comment-moderation ${JSON.stringify({ id, state, ...(at ? { at } : {}), ...(by ? { by } : {}) })} -->`;
  // A link rather than an @mention, so edits to the note do not notify the author again.
  const who = `[${author}](https://github.com/${author})`;
  const link = `[comment](${url})`;
  const quote = body ? `\n\n${fence(excerpt(body))}` : '';
  const lines = {
    pending: [`**待审核 Pending review** · ${who} · ${link}${quote}`, '', checkbox(ACTIONS.approve), checkbox(ACTIONS.reject)],
    approved: [`**已通过 Approved** · ${who} · ${link}`, `将在网站下次部署后显示。Shown on the site after the next deploy.`, '', checkbox(ACTIONS.reopen)],
    rejected: [`**已拒绝 Rejected** · ${who} · ${link}`, '不会显示在网站上。Not shown on the site.', '', checkbox(ACTIONS.reopen)],
    deleted: [`**已删除 Deleted** · ${who}`, '留言已被删除。The comment was deleted.'],
  }[state];
  return [marker, ...lines].join('\n');
}

/**
 * What a ticked box asks for, given the note's current state. Only top-level task-list
 * lines count, so anything quoted inside the note is ignored.
 * @param {string} body
 * @param {ReviewState} state
 * @returns {'approve' | 'reject' | 'reopen' | null}
 */
export function decision(body, state) {
  // The quoted comment is the visitor's text; drop it so it cannot tick anything.
  const own = body.replace(/^(`{3,})text\n[\s\S]*?\n\1$/m, '');
  const ticked = (label) => new RegExp(`^- \\[[xX]\\] ${label.split(' ')[0]}`, 'm').test(own);
  if (state === 'pending') {
    const approve = ticked(ACTIONS.approve);
    const reject = ticked(ACTIONS.reject);
    if (approve !== reject) return approve ? 'approve' : 'reject';
    return null;
  }
  if (state === 'approved' || state === 'rejected') return ticked(ACTIONS.reopen) ? 'reopen' : null;
  return null;
}

/**
 * Review decisions in an issue, by comment id: the latest note for each comment.
 * @param {{ user: { login: string } | null, body?: string | null }[]} comments
 */
export function reviews(comments) {
  /** @type {Map<number, Marker>} */
  const found = new Map();
  for (const comment of comments) {
    if (comment.user?.login !== BOT_LOGIN) continue;
    const marker = readMarker(comment.body ?? '');
    if (marker) found.set(marker.id, marker);
  }
  return found;
}

/**
 * Whether the site shows a comment: the repository owner's comments always, a visitor's
 * once approved and not edited since. Review notes and other bots never.
 * @param {{ id: number, user: { login: string, type?: string } | null, updated_at: string }} comment
 * @param {Map<number, Marker>} decided
 * @param {string} owner
 */
export function isShown(comment, decided, owner) {
  const user = comment.user;
  if (!user || user.type === 'Bot' || user.login === BOT_LOGIN) return false;
  if (user.login.toLowerCase() === owner.toLowerCase()) return true;
  const review = decided.get(comment.id);
  if (review?.state !== 'approved' || !review.at) return false;
  // Allow a second of clock skew between the edit time and the approval.
  return Date.parse(comment.updated_at) <= Date.parse(review.at) + 1000;
}
