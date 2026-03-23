import { readFile, writeFile, mkdir, readdir, stat, unlink, copyFile, rm } from 'node:fs/promises';
import { join, basename, extname, dirname, resolve, sep } from 'node:path';
import { homedir, platform } from 'node:os';
import { execFile } from 'node:child_process';

// --- Native folder dialog ---

function openNativeFolderDialog() {
  return new Promise((resolve, reject) => {
    const os = platform();
    if (os === 'win32') {
      const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FOD {}

[ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileOpenDialog {
  [PreserveSig] int Show(IntPtr hwnd);
  void SetFileTypes(uint c, IntPtr f);
  void SetFileTypeIndex(uint i);
  void GetFileTypeIndex(out uint i);
  void Advise(IntPtr e, out uint k);
  void Unadvise(uint k);
  void SetOptions(uint o);
  void GetOptions(out uint o);
  void SetDefaultFolder(IShellItem i);
  void SetFolder(IShellItem i);
  void GetFolder(out IShellItem i);
  void GetCurrentSelection(out IShellItem i);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
  void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
  void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
  void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
  void GetResult(out IShellItem i);
  void AddPlace(IShellItem i, int p);
  void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string e);
  void Close(int r);
  void SetClientGuid([In] ref Guid g);
  void ClearClientData();
  void SetFilter(IntPtr f);
  void GetResults(out IntPtr e);
  void GetSelectedItems(out IntPtr e);
}

[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem {
  void BindToHandler(IntPtr p, [MarshalAs(UnmanagedType.LPStruct)] Guid b, [MarshalAs(UnmanagedType.LPStruct)] Guid r, out IntPtr v);
  void GetParent(out IShellItem i);
  void GetDisplayName(uint n, [MarshalAs(UnmanagedType.LPWStr)] out string s);
  void GetAttributes(uint m, out uint a);
  void Compare(IShellItem i, uint h, out int o);
}

public class Picker {
  public static string Run() {
    var d = (IFileOpenDialog)new FOD();
    d.SetTitle("Select a project folder");
    d.SetOptions(0x20 | 0x40);
    if (d.Show(IntPtr.Zero) != 0) return null;
    IShellItem r; d.GetResult(out r);
    string p; r.GetDisplayName(0x80058000u, out p);
    return p;
  }
}
'@

$r = [Picker]::Run()
if ($r) { Write-Output $r } else { Write-Output '' }
`;
      execFile('powershell', ['-NoProfile', '-STA', '-Command', script], { timeout: 60000 }, (err, stdout) => {
        if (err) return reject(err);
        const path = stdout.trim();
        resolve(path || null);
      });
    } else if (os === 'darwin') {
      const script = 'osascript -e \'tell application "Finder" to set f to POSIX path of (choose folder with prompt "Select a project folder")\' 2>/dev/null';
      execFile('bash', ['-c', script], { timeout: 60000 }, (err, stdout) => {
        if (err) return resolve(null); // user cancelled
        resolve(stdout.trim() || null);
      });
    } else {
      // Linux — try zenity, then kdialog
      execFile('zenity', ['--file-selection', '--directory', '--title=Select a project folder'], { timeout: 60000 }, (err, stdout) => {
        if (err) {
          execFile('kdialog', ['--getexistingdirectory', homedir(), '--title', 'Select a project folder'], { timeout: 60000 }, (err2, stdout2) => {
            if (err2) return resolve(null);
            resolve(stdout2.trim() || null);
          });
          return;
        }
        resolve(stdout.trim() || null);
      });
    }
  });
}

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
      const url = new URL(req.url, 'http://localhost');
      let browsePath = url.searchParams.get('path') || '';

      // Default to home directory
      if (!browsePath) {
        browsePath = homedir();
      }

      const resolved = resolve(browsePath);

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

    // GET /api/git/status — check for unpushed commits
    if (method === 'GET' && pathname === '/api/git/status') {
      try {
        const { execFile: ef } = await import('node:child_process');
        const run = (cmd, args) => new Promise((resolve, reject) => {
          ef(cmd, args, { cwd: projectPath, timeout: 10000 }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout.trim());
          });
        });

        const branch = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
        let unpushed = 0;
        try {
          const log = await run('git', ['log', '--oneline', `origin/${branch}..HEAD`]);
          unpushed = log ? log.split('\n').length : 0;
        } catch { /* no remote tracking branch */ }

        jsonResponse(res, 200, { branch, unpushed });
      } catch (err) {
        jsonResponse(res, 200, { branch: null, unpushed: 0, error: err.message });
      }
      return true;
    }

    // POST /api/git/push — push to origin
    if (method === 'POST' && pathname === '/api/git/push') {
      try {
        const { execFile: ef } = await import('node:child_process');
        const result = await new Promise((resolve, reject) => {
          ef('git', ['push'], { cwd: projectPath, timeout: 60000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve((stdout + '\n' + stderr).trim());
          });
        });
        jsonResponse(res, 200, { ok: true, output: result });
      } catch (err) {
        jsonResponse(res, 400, { error: err.message });
      }
      return true;
    }

    // POST /api/split-tasks — use Claude to split scratchpad text into individual tasks
    if (method === 'POST' && pathname === '/api/split-tasks') {
      const body = await parseJsonBody(req);
      const { text } = body;
      if (!text) {
        jsonResponse(res, 400, { error: 'Missing text' });
        return true;
      }

      try {
        // Read current state to understand existing tasks/epics
        const stateFile = join(projectPath, '.devmanager', 'state.json');
        let existingEpics = [];
        try {
          const stateContent = await readFile(stateFile, 'utf-8');
          const state = JSON.parse(stateContent);
          existingEpics = (state.epics || []).map(e => e.name);
        } catch { /* no state yet */ }

        const prompt = `You are a product manager assistant. Split the following user notes into individual actionable tasks for a development team.

User's notes:
---
${text}
---

${existingEpics.length ? `Existing epics/groups in the project: ${existingEpics.join(', ')}` : ''}

Return ONLY valid JSON — an array of task objects. No markdown, no explanation, no code fences. Each task:
{"name": "short title (under 50 chars)", "fullName": "descriptive title", "description": "what needs to happen and why", "group": "epic/category name"}

Rules:
- Each bullet point or distinct issue becomes its own task
- If a note describes multiple things, split them
- Use clear, actionable titles (e.g. "Fix toast black border on mobile" not "toast issue")
- Group related tasks under the same epic
- Use existing epics when they fit, create new ones when needed`;

        const { execFile: ef } = await import('node:child_process');
        const result = await new Promise((resolve, reject) => {
          ef('claude', ['-p', prompt, '--output-format', 'text'], {
            cwd: projectPath,
            timeout: 120000,
            maxBuffer: 1024 * 1024,
          }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout.trim());
          });
        });

        // Parse JSON from Claude's response (handle possible markdown fences)
        let tasks;
        try {
          const cleaned = result.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '').trim();
          tasks = JSON.parse(cleaned);
        } catch {
          jsonResponse(res, 400, { error: 'Failed to parse tasks from AI response', raw: result });
          return true;
        }

        jsonResponse(res, 200, { tasks });
      } catch (err) {
        jsonResponse(res, 500, { error: err.message });
      }
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

    // POST /api/launch/terminal — open task in a new terminal tab
    if (method === 'POST' && pathname === '/api/launch/terminal') {
      const body = await parseJsonBody(req);
      const { taskId, command, engine, title } = body;
      if (!command) {
        jsonResponse(res, 400, { error: 'Missing command' });
        return true;
      }
      const eng = engine || 'claude';
      const tabTitle = title || `Task ${taskId}`;
      const os = platform();

      try {
        const cliName = eng === 'claude' ? 'claude' : eng === 'codex' ? 'codex' : 'cursor-agent';

        if (os === 'win32') {
          // Open in Windows Terminal new tab — interactive claude with initial prompt
          const { spawn: spawnProc } = await import('node:child_process');
          spawnProc('wt', [
            '-w', '0', 'nt',
            '--title', tabTitle, '--suppressApplicationTitle',
            '-d', projectPath,
            '--', 'pwsh', '-NoExit', '-Command', `${cliName} --dangerously-skip-permissions '${command.replace(/'/g, "''")}'`,
          ], {
            cwd: projectPath,
            detached: true,
            stdio: 'ignore',
          }).unref();
        } else if (os === 'darwin') {
          const fullCmd = `cd "${projectPath}" && ${cliName} "${command.replace(/"/g, '\\"')}"`;
          const { execFile: ef } = await import('node:child_process');
          ef('osascript', ['-e', `tell app "Terminal" to do script "${fullCmd.replace(/"/g, '\\"')}"`], { timeout: 5000 });
        } else {
          const fullCmd = `cd "${projectPath}" && ${cliName} "${command.replace(/"/g, '\\"')}"; exec bash`;
          const { spawn: spawnProc } = await import('node:child_process');
          spawnProc('x-terminal-emulator', ['-e', `bash -c '${fullCmd}'`], {
            detached: true, stdio: 'ignore',
          }).unref();
        }
        jsonResponse(res, 200, { ok: true });
      } catch (err) {
        jsonResponse(res, 500, { error: err.message });
      }
      return true;
    }

    // GET /api/launch
    if (method === 'GET' && pathname === '/api/launch') {
      const { getProcessManager } = await import('./process.js');
      const pm = getProcessManager();
      jsonResponse(res, 200, pm.listProcesses());
      return true;
    }

    // GET /api/launch/output — get all buffered output (for reconnecting clients)
    if (method === 'GET' && pathname === '/api/launch/output') {
      const { getProcessManager } = await import('./process.js');
      const pm = getProcessManager();
      jsonResponse(res, 200, pm.getAllOutput());
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
