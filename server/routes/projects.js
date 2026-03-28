import { stat, readdir } from 'node:fs/promises';
import { join, basename, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { openNativeFolderDialog } from '../dialogs.js';
import { jsonResponse, parseJsonBody } from '../middleware.js';

export async function handleProjects(method, pathname, req, res, url, ctx) {
  const { projectPath, getProjects, switchProject } = ctx;

  // GET /api/projects — list all registered projects
  if (method === 'GET' && pathname === '/api/projects') {
    jsonResponse(res, 200, getProjects());
    return true;
  }

  // POST /api/browse/native — open native OS folder dialog
  if (method === 'POST' && pathname === '/api/browse/native') {
    try {
      const selectedPath = await openNativeFolderDialog();
      if (selectedPath) {
        jsonResponse(res, 200, { path: selectedPath });
      } else {
        jsonResponse(res, 200, { path: null, cancelled: true });
      }
    } catch (err) {
      jsonResponse(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/browse?path=... — list directories for folder picker
  if (method === 'GET' && pathname === '/api/browse') {
    let browsePath = url.searchParams.get('path') || '';

    // Default to home directory
    if (!browsePath) {
      browsePath = homedir();
    }

    const resolved = resolve(browsePath);

    const home = homedir();
    if (!resolved.startsWith(home)) {
      jsonResponse(res, 403, { error: 'Path outside home directory' });
      return true;
    }

    try {
      const s = await stat(resolved);
      if (!s.isDirectory()) {
        jsonResponse(res, 400, { error: 'Not a directory' });
        return true;
      }

      const entries = await readdir(resolved, { withFileTypes: true });
      const dirs = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        // Skip hidden dirs and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        // Check if it's a project (has .devmanager/ or .git/ or package.json)
        let isProject = false;
        try {
          const subPath = join(resolved, entry.name);
          const subEntries = await readdir(subPath);
          isProject = subEntries.includes('.devmanager') || subEntries.includes('.git') || subEntries.includes('package.json');
        } catch { /* can't read = skip */ }
        dirs.push({ name: entry.name, path: join(resolved, entry.name), isProject });
      }

      // Sort: projects first, then alphabetical
      dirs.sort((a, b) => {
        if (a.isProject !== b.isProject) return a.isProject ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const parent = dirname(resolved);
      jsonResponse(res, 200, {
        current: resolved,
        parent: parent !== resolved ? parent : null,
        dirs,
      });
    } catch (err) {
      jsonResponse(res, 400, { error: `Cannot read: ${err.message}` });
    }
    return true;
  }

  // PUT /api/project — switch active project
  if (method === 'PUT' && pathname === '/api/project') {
    const body = await parseJsonBody(req);
    const { path: newPath } = body;
    if (!newPath) {
      jsonResponse(res, 400, { error: 'Missing path' });
      return true;
    }
    const resolved = join(newPath); // normalize
    try {
      const s = await stat(resolved);
      if (!s.isDirectory()) {
        jsonResponse(res, 400, { error: 'Not a directory' });
        return true;
      }
    } catch {
      jsonResponse(res, 400, { error: 'Directory not found' });
      return true;
    }
    switchProject(resolved);
    jsonResponse(res, 200, { ok: true, projectPath: resolved, projectName: basename(resolved) });
    return true;
  }

  // GET /api/info
  if (method === 'GET' && pathname === '/api/info') {
    jsonResponse(res, 200, {
      projectPath,
      projectName: basename(projectPath),
    });
    return true;
  }

  return false;
}
