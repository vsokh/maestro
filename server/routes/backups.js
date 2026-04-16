import { readdir, stat, copyFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { jsonResponse, parseJsonBody, ensureDir } from '../middleware.js';

export async function handleBackups(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;

  // GET /api/backups
  if (method === 'GET' && pathname === '/api/backups') {
    const backupDir = join(projectPath, '.maestro', 'backups');
    const files = [];
    try {
      const entries = await readdir(backupDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.startsWith('state-') && entry.name.endsWith('.json')) {
          const fileStat = await stat(join(backupDir, entry.name));
          files.push({
            name: entry.name,
            lastModified: fileStat.mtimeMs,
          });
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    files.sort((a, b) => b.lastModified - a.lastModified);
    jsonResponse(res, 200, { backups: files });
    return true;
  }

  // POST /api/backups/snapshot
  if (method === 'POST' && pathname === '/api/backups/snapshot') {
    const statePath = join(projectPath, '.maestro', 'state.json');
    const backupDir = join(projectPath, '.maestro', 'backups');
    await ensureDir(backupDir);

    try {
      await stat(statePath); // verify state file exists
    } catch {
      jsonResponse(res, 404, { error: 'No state.json to snapshot' });
      return true;
    }

    const filename = `state-${Date.now()}.json`;
    await copyFile(statePath, join(backupDir, filename));

    // Prune to keep only 10 most recent
    try {
      const entries = await readdir(backupDir, { withFileTypes: true });
      const backups = [];
      for (const entry of entries) {
        if (entry.isFile() && entry.name.startsWith('state-') && entry.name.endsWith('.json')) {
          const fileStat = await stat(join(backupDir, entry.name));
          backups.push({ name: entry.name, mtimeMs: fileStat.mtimeMs });
        }
      }
      backups.sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const old of backups.slice(10)) {
        await unlink(join(backupDir, old.name));
      }
    } catch (err) {
      console.error('Prune backups error:', err.message);
    }

    jsonResponse(res, 200, { ok: true, filename });
    return true;
  }

  // POST /api/backups/restore
  if (method === 'POST' && pathname === '/api/backups/restore') {
    const body = await parseJsonBody(req);
    const { filename } = body;
    if (!filename) {
      jsonResponse(res, 400, { error: 'Missing filename' });
      return true;
    }
    // Security: only allow state-*.json filenames
    if (!filename.startsWith('state-') || !filename.endsWith('.json') || filename.includes('/') || filename.includes('\\')) {
      jsonResponse(res, 400, { error: 'Invalid backup filename' });
      return true;
    }
    const backupPath = join(projectPath, '.maestro', 'backups', filename);
    const statePath = join(projectPath, '.maestro', 'state.json');
    try {
      await stat(backupPath);
    } catch {
      jsonResponse(res, 404, { error: 'Backup file not found' });
      return true;
    }
    await copyFile(backupPath, statePath);
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}
