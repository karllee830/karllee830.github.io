// Runs from .github/workflows/comments.yml (actions/github-script) on every comment in an
// issue labelled for post comments. See scripts/comments/moderation.mjs for the flow.
import { BOT_LOGIN, decision, readMarker, renderNote } from './moderation.mjs';

/** Writers decide; anyone else's edit to a note is ignored. */
const DECIDERS = ['admin', 'maintain', 'write'];

/**
 * @param {{ github: any, context: any, core: any }} args
 */
export default async function moderate({ github, context, core }) {
  const { owner, repo } = context.repo;
  const { action, comment, issue, sender, repository } = context.payload;
  const api = github.rest;

  const redeploy = async () => {
    await api.actions.createWorkflowDispatch({ owner, repo, workflow_id: 'deploy.yml', ref: repository.default_branch });
    core.info('Started a deploy.');
  };

  /** The review note for a visitor comment, if there is one. */
  const findNote = async (id) => {
    const comments = await github.paginate(api.issues.listComments, { owner, repo, issue_number: issue.number, per_page: 100 });
    return comments.find((c) => c.user?.login === BOT_LOGIN && readMarker(c.body)?.id === id);
  };

  // A review note: someone ticked a box.
  if (comment.user?.login === BOT_LOGIN) {
    const marker = readMarker(comment.body);
    if (action !== 'edited' || !marker || sender.login === BOT_LOGIN) return;

    const { data } = await api.repos.getCollaboratorPermissionLevel({ owner, repo, username: sender.login });
    if (!DECIDERS.includes(data.permission)) {
      core.info(`${sender.login} cannot review comments.`);
      return;
    }

    const choice = decision(comment.body, marker.state);
    if (!choice) return;

    let target = null;
    try {
      ({ data: target } = await api.issues.getComment({ owner, repo, comment_id: marker.id }));
    } catch {
      // Deleted meanwhile.
    }
    const state = !target ? 'deleted' : choice === 'approve' ? 'approved' : choice === 'reject' ? 'rejected' : 'pending';
    const body = renderNote({
      id: marker.id,
      state,
      at: new Date().toISOString(),
      by: sender.login,
      author: target?.user.login ?? 'ghost',
      url: target?.html_url ?? issue.html_url,
      body: target?.body ?? '',
    });
    await api.issues.updateComment({ owner, repo, comment_id: comment.id, body });
    core.info(`Comment ${marker.id}: ${marker.state} → ${state}.`);
    // The site changes when a comment appears or disappears.
    if (state === 'approved' || marker.state === 'approved') await redeploy();
    return;
  }

  // The owner's comments are shown without review; other bots are never shown.
  if (comment.user?.type === 'Bot' || comment.user?.login.toLowerCase() === owner.toLowerCase()) return;

  const note = action === 'created' ? null : await findNote(comment.id);
  const was = note ? readMarker(note.body)?.state : undefined;
  const body = renderNote({
    id: comment.id,
    state: action === 'deleted' ? 'deleted' : 'pending',
    author: comment.user.login,
    url: comment.html_url,
    body: comment.body,
  });

  if (note) await api.issues.updateComment({ owner, repo, comment_id: note.id, body });
  else if (action !== 'deleted') await api.issues.createComment({ owner, repo, issue_number: issue.number, body });
  core.info(`Comment ${comment.id} ${action}; review is ${action === 'deleted' ? 'closed' : 'pending'}.`);

  // An approved comment that changes or goes away has to leave the site.
  if (was === 'approved') await redeploy();
}
