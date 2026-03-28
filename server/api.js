import { handleProjects } from './routes/projects.js';
import { handleGit } from './routes/git.js';
import { handleState } from './routes/state.js';
import { handleSkills } from './routes/skills.js';
import { handleQuality } from './routes/quality.js';
import { handleRelease } from './routes/release.js';
import { handleAttachments } from './routes/attachments.js';
import { handleBackups } from './routes/backups.js';
import { handleLaunch } from './routes/launch.js';
import { jsonResponse } from './middleware.js';

const handlers = [
  handleProjects,
  handleGit,
  handleState,
  handleSkills,
  handleQuality,
  handleRelease,
  handleAttachments,
  handleBackups,
  handleLaunch,
];

export async function handleApi(req, res) {
  const { getActiveProject, getProjects, switchProject } = await import('./index.js');
  const projectPath = getActiveProject();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  if (!pathname.startsWith('/api/')) return false;

  try {
    const ctx = { projectPath, getProjects, switchProject };
    for (const handler of handlers) {
      const handled = await handler(method, pathname, req, res, url, ctx);
      if (handled) return true;
    }
    jsonResponse(res, 404, { error: 'API route not found' });
    return true;
  } catch (err) {
    console.error(`API error [${method} ${pathname}]:`, err);
    const status = err.statusCode || 500;
    jsonResponse(res, status, { error: err.message || 'Internal server error' });
    return true;
  }
}
