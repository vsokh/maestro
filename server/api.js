import { readFile, writeFile, mkdir, readdir, stat, unlink, copyFile, rm } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

// --- Helpers ---

function jsonResponse(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      resolve(buf);
    });
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const buf = await parseBody(req);
  if (buf.length === 0) return {};
  return JSON.parse(buf.toString('utf-8'));
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dirPath) {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function parseDescription(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return '';
  const fm = match[1];
  // Try quoted description first
  let descMatch = fm.match(/description:\s*"([^"]*(?:"[^"]*?)*)"/m) ||
                  fm.match(/description:\s*'([^']*)'/m);
  if (!descMatch) {
    // Unquoted single-line
    descMatch = fm.match(/description:\s*(.+)$/m);
  }
  if (!descMatch) {
    // Fallback: first non-heading line after frontmatter
    const firstLine = text.split('\n---')[1]?.split('\n').find(l => l.trim() && !l.startsWith('#'));
    if (firstLine) return firstLine.trim().slice(0, 120);
    return '';
  }
  let desc = descMatch[1].trim();
  desc = desc.replace(/\s*TRIGGER\s+on:.*$/i, '').replace(/\s*Use when:.*$/i, '');
  let end = desc.indexOf('. ');
  if (end > 0) {
    const second = desc.indexOf('. ', end + 2);
    if (second > 0 && second < 200) end = second + 1;
    else end = end + 1;
  }
  if (end > 0 && end < 200) desc = desc.slice(0, end);
  else if (desc.length > 200) desc = desc.slice(0, 200) + '...';
  return desc;
}

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

// --- Route matching ---

function matchRoute(method, pathname, routeMethod, routePattern) {
  if (method !== routeMethod) return null;
  const routeParts = routePattern.split('/');
  const pathParts = pathname.split('/');
  if (routeParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(':')) {
      params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (routeParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// --- API handler ---

export async function handleApi(req, res) {
  const { getActiveProject, getProjects, switchProject } = await import('./index.js');
  const projectPath = getActiveProject();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // Only handle /api/* routes
  if (!pathname.startsWith('/api/')) return false;

  try {
    // GET /api/projects — list all registered projects
    if (method === 'GET' && pathname === '/api/projects') {
      jsonResponse(res, 200, getProjects());
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

    // GET /api/state
    if (method === 'GET' && pathname === '/api/state') {
      const statePath = join(projectPath, '.devmanager', 'state.json');
      try {
        const content = await readFile(statePath, 'utf-8');
        const data = JSON.parse(content);
        const fileStat = await stat(statePath);
        jsonResponse(res, 200, {
          data,
          lastModified: fileStat.mtimeMs,
        });
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'State file not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // PUT /api/state
    if (method === 'PUT' && pathname === '/api/state') {
      const body = await parseJsonBody(req);
      const stateDir = join(projectPath, '.devmanager');
      await ensureDir(stateDir);
      const statePath = join(stateDir, 'state.json');
      await writeFile(statePath, JSON.stringify(body, null, 2), 'utf-8');
      jsonResponse(res, 200, { ok: true });
      return true;
    }

    // GET /api/progress
    if (method === 'GET' && pathname === '/api/progress') {
      const progDir = join(projectPath, '.devmanager', 'progress');
      const entries = {};
      try {
        const files = await readdir(progDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const content = await readFile(join(progDir, file), 'utf-8');
            const key = file.replace('.json', '');
            entries[key] = JSON.parse(content);
          } catch (err) {
            console.error('Failed to parse progress file:', file, err.message);
          }
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      jsonResponse(res, 200, entries);
      return true;
    }

    // DELETE /api/progress/:taskId
    let params = matchRoute(method, pathname, 'DELETE', '/api/progress/:taskId');
    if (params) {
      const filePath = join(projectPath, '.devmanager', 'progress', `${params.taskId}.json`);
      try {
        await unlink(filePath);
        jsonResponse(res, 200, { ok: true });
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'Progress file not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // GET /api/skills
    if (method === 'GET' && pathname === '/api/skills') {
      const results = [];

      // Discover skills from .claude/skills/
      const skillsDir = join(projectPath, '.claude', 'skills');
      try {
        const dirs = await readdir(skillsDir, { withFileTypes: true });
        for (const entry of dirs) {
          if (!entry.isDirectory() || entry.name === 'orchestrator') continue;
          let description = '';
          // Try SKILL.md then skill.md
          for (const filename of ['SKILL.md', 'skill.md']) {
            const filePath = join(skillsDir, entry.name, filename);
            if (await fileExists(filePath)) {
              try {
                const text = await readFile(filePath, 'utf-8');
                description = parseDescription(text);
              } catch { /* ignore */ }
              break;
            }
          }
          results.push({ name: entry.name, description, type: 'skill' });
        }
      } catch (err) {
        if (err.code !== 'ENOENT') console.error('Skills scan error:', err.message);
      }

      // Discover agents from .claude/agents/
      const agentsDir = join(projectPath, '.claude', 'agents');
      try {
        const files = await readdir(agentsDir, { withFileTypes: true });
        for (const entry of files) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
          const agentName = entry.name.replace(/\.md$/, '');
          let description = '';
          try {
            const text = await readFile(join(agentsDir, entry.name), 'utf-8');
            description = parseDescription(text);
          } catch { /* ignore */ }
          results.push({ name: agentName, description, type: 'agent' });
        }
      } catch (err) {
        if (err.code !== 'ENOENT') console.error('Agents scan error:', err.message);
      }

      results.sort((a, b) => a.name.localeCompare(b.name));
      jsonResponse(res, 200, results);
      return true;
    }

    // POST /api/skills/deploy
    if (method === 'POST' && pathname === '/api/skills/deploy') {
      const body = await parseJsonBody(req);
      const { skillName, filename, content } = body;
      if (!skillName || !filename || !content) {
        jsonResponse(res, 400, { error: 'Missing skillName, filename, or content' });
        return true;
      }
      const skillDir = join(projectPath, '.claude', 'skills', skillName);
      await ensureDir(skillDir);

      // Check hash to skip if unchanged
      const hash = simpleHash(content);
      const hashPath = join(skillDir, '.hash');
      try {
        const existingHash = await readFile(hashPath, 'utf-8');
        if (existingHash.trim() === hash) {
          jsonResponse(res, 200, { ok: true, deployed: false });
          return true;
        }
      } catch { /* no hash file yet */ }

      await writeFile(join(skillDir, filename), content, 'utf-8');
      await writeFile(hashPath, hash, 'utf-8');
      jsonResponse(res, 200, { ok: true, deployed: true });
      return true;
    }

    // POST /api/agents/deploy
    if (method === 'POST' && pathname === '/api/agents/deploy') {
      const body = await parseJsonBody(req);
      const { agentName, filename, content } = body;
      if (!agentName || !filename || !content) {
        jsonResponse(res, 400, { error: 'Missing agentName, filename, or content' });
        return true;
      }
      const agentsDir = join(projectPath, '.claude', 'agents');
      await ensureDir(agentsDir);

      const agentDir = join(agentsDir, agentName);
      await ensureDir(agentDir);
      await writeFile(join(agentDir, filename), content, 'utf-8');
      jsonResponse(res, 200, { ok: true, deployed: true });
      return true;
    }

    // GET /api/skills-config
    if (method === 'GET' && pathname === '/api/skills-config') {
      const configPath = join(projectPath, '.devmanager', 'skills.json');
      try {
        const content = await readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        jsonResponse(res, 200, parsed);
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'Skills config not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // PUT /api/skills-config
    if (method === 'PUT' && pathname === '/api/skills-config') {
      const body = await parseJsonBody(req);
      const configDir = join(projectPath, '.devmanager');
      await ensureDir(configDir);
      await writeFile(join(configDir, 'skills.json'), JSON.stringify(body, null, 2), 'utf-8');
      jsonResponse(res, 200, { ok: true });
      return true;
    }

    // GET /api/quality/latest
    if (method === 'GET' && pathname === '/api/quality/latest') {
      const filePath = join(projectPath, '.devmanager', 'quality', 'latest.json');
      try {
        const content = await readFile(filePath, 'utf-8');
        jsonResponse(res, 200, JSON.parse(content));
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'Quality report not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // GET /api/quality/history
    if (method === 'GET' && pathname === '/api/quality/history') {
      const filePath = join(projectPath, '.devmanager', 'quality', 'history.json');
      try {
        const content = await readFile(filePath, 'utf-8');
        jsonResponse(res, 200, JSON.parse(content));
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'Quality history not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // POST /api/attachments/:taskId
    params = matchRoute(method, pathname, 'POST', '/api/attachments/:taskId');
    if (params) {
      const taskId = params.taskId;
      const filename = url.searchParams.get('name');
      if (!filename) {
        jsonResponse(res, 400, { error: 'Missing ?name= query parameter for filename' });
        return true;
      }
      const attachDir = join(projectPath, '.devmanager', 'attachments', taskId);
      await ensureDir(attachDir);
      const buf = await parseBody(req);
      await writeFile(join(attachDir, filename), buf);
      jsonResponse(res, 200, {
        ok: true,
        path: `.devmanager/attachments/${taskId}/${filename}`,
      });
      return true;
    }

    // GET /api/attachments/:taskId/:filename
    params = matchRoute(method, pathname, 'GET', '/api/attachments/:taskId/:filename');
    if (params) {
      const filePath = join(projectPath, '.devmanager', 'attachments', params.taskId, params.filename);
      try {
        const content = await readFile(filePath);
        const ext = extname(params.filename).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': content.length,
        });
        res.end(content);
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'Attachment not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // DELETE /api/attachments/:taskId/:filename
    params = matchRoute(method, pathname, 'DELETE', '/api/attachments/:taskId/:filename');
    if (params) {
      const filePath = join(projectPath, '.devmanager', 'attachments', params.taskId, params.filename);
      try {
        await unlink(filePath);
        jsonResponse(res, 200, { ok: true });
      } catch (err) {
        if (err.code === 'ENOENT') {
          jsonResponse(res, 404, { error: 'Attachment not found' });
        } else {
          throw err;
        }
      }
      return true;
    }

    // GET /api/backups
    if (method === 'GET' && pathname === '/api/backups') {
      const backupDir = join(projectPath, '.devmanager', 'backups');
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
      const statePath = join(projectPath, '.devmanager', 'state.json');
      const backupDir = join(projectPath, '.devmanager', 'backups');
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
      const backupPath = join(projectPath, '.devmanager', 'backups', filename);
      const statePath = join(projectPath, '.devmanager', 'state.json');
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

    // POST /api/launch
    if (method === 'POST' && pathname === '/api/launch') {
      const { getProcessManager } = await import('./process.js');
      const { broadcast } = await import('./index.js');
      const body = await parseJsonBody(req);
      const { taskId, command, engine } = body;
      if (!taskId || !command) {
        jsonResponse(res, 400, { error: 'Missing taskId or command' });
        return true;
      }
      const pm = getProcessManager();
      const result = pm.launchProcess(projectPath, taskId, command, engine || 'claude', broadcast);
      jsonResponse(res, 200, result);
      return true;
    }

    // GET /api/launch
    if (method === 'GET' && pathname === '/api/launch') {
      const { getProcessManager } = await import('./process.js');
      const pm = getProcessManager();
      jsonResponse(res, 200, pm.listProcesses());
      return true;
    }

    // DELETE /api/launch/:pid
    params = matchRoute(method, pathname, 'DELETE', '/api/launch/:pid');
    if (params) {
      const { getProcessManager } = await import('./process.js');
      const pm = getProcessManager();
      const pid = parseInt(params.pid, 10);
      if (isNaN(pid)) {
        jsonResponse(res, 400, { error: 'Invalid PID' });
        return true;
      }
      const killed = pm.killProcess(pid);
      if (killed) {
        jsonResponse(res, 200, { ok: true });
      } else {
        jsonResponse(res, 404, { error: 'Process not found' });
      }
      return true;
    }

    // Unmatched /api/ route
    jsonResponse(res, 404, { error: 'API route not found' });
    return true;

  } catch (err) {
    console.error(`API error [${method} ${pathname}]:`, err);
    jsonResponse(res, 500, { error: err.message || 'Internal server error' });
    return true;
  }
}
