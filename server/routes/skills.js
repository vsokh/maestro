import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { jsonResponse, parseJsonBody, ensureDir, fileExists, requireFields, readJsonOrNull, safePath } from '../middleware.js';

// --- Helpers (only used by skills routes) ---

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

export async function handleSkills(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;

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
    const err = requireFields(body, 'skillName', 'filename', 'content');
    if (err) { jsonResponse(res, 400, { error: err }); return true; }
    const skillDir = safePath(projectPath, '.claude', 'skills', skillName);
    if (!skillDir) { jsonResponse(res, 400, { error: 'Invalid skill name' }); return true; }
    await ensureDir(skillDir);

    // Check hash to skip if unchanged
    const hash = simpleHash(content);
    const hashPath = safePath(skillDir, '.hash');
    if (!hashPath) { jsonResponse(res, 400, { error: 'Invalid path' }); return true; }
    try {
      const existingHash = await readFile(hashPath, 'utf-8');
      if (existingHash.trim() === hash) {
        jsonResponse(res, 200, { ok: true, deployed: false });
        return true;
      }
    } catch { /* no hash file yet */ }

    const skillFilePath = safePath(skillDir, filename);
    if (!skillFilePath) { jsonResponse(res, 400, { error: 'Invalid filename' }); return true; }
    await writeFile(skillFilePath, content, 'utf-8');
    await writeFile(hashPath, hash, 'utf-8');
    jsonResponse(res, 200, { ok: true, deployed: true });
    return true;
  }

  // POST /api/agents/deploy
  if (method === 'POST' && pathname === '/api/agents/deploy') {
    const body = await parseJsonBody(req);
    const { agentName, filename, content } = body;
    const err = requireFields(body, 'agentName', 'filename', 'content');
    if (err) { jsonResponse(res, 400, { error: err }); return true; }
    const agentsDir = join(projectPath, '.claude', 'agents');
    await ensureDir(agentsDir);

    const agentDir = safePath(agentsDir, agentName);
    if (!agentDir) { jsonResponse(res, 400, { error: 'Invalid agent name' }); return true; }
    await ensureDir(agentDir);
    const agentFilePath = safePath(agentDir, filename);
    if (!agentFilePath) { jsonResponse(res, 400, { error: 'Invalid filename' }); return true; }
    await writeFile(agentFilePath, content, 'utf-8');
    jsonResponse(res, 200, { ok: true, deployed: true });
    return true;
  }

  // GET /api/skills-config
  if (method === 'GET' && pathname === '/api/skills-config') {
    const configPath = join(projectPath, '.maestro', 'skills.json');
    const result = await readJsonOrNull(configPath);
    jsonResponse(res, 200, result ? result.data : {});
    return true;
  }

  // PUT /api/skills-config
  if (method === 'PUT' && pathname === '/api/skills-config') {
    const body = await parseJsonBody(req);
    const configDir = join(projectPath, '.maestro');
    await ensureDir(configDir);
    await writeFile(join(configDir, 'skills.json'), JSON.stringify(body, null, 2), 'utf-8');
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}
