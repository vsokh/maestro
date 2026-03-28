import { readFile, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { jsonResponse, parseJsonBody, ensureDir, matchRoute, readJsonOrNull, handleNotFound, safePath } from '../middleware.js';
import { validateProgressEntry, validateStateStructure } from '../validate.js';

export async function handleState(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;
  let params;

  // POST /api/split-tasks — use Claude to split scratchpad text into individual tasks
  if (method === 'POST' && pathname === '/api/split-tasks') {
    const body = await parseJsonBody(req);
    const { text } = body;
    if (!text) {
      jsonResponse(res, 400, { error: 'Missing text' });
      return true;
    }
    const MAX_TEXT_LENGTH = 50000;
    if (text.length > MAX_TEXT_LENGTH) {
      jsonResponse(res, 400, { error: `Text too long. Maximum ${MAX_TEXT_LENGTH} characters` });
      return true;
    }

    try {
      // Read current state to understand existing tasks/epics
      const stateFile = join(projectPath, '.devmanager', 'state.json');
      let existingEpics = [];
      try {
        const stateContent = await readFile(stateFile, 'utf-8');
        const state = JSON.parse(stateContent);
        if (!validateStateStructure(state)) {
          existingEpics = [];
        } else {
          existingEpics = (state.epics || []).map(e => e.name);
        }
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
    const result = await readJsonOrNull(statePath);
    if (!result) {
      jsonResponse(res, 404, { error: 'State file not found' });
    } else if (!validateStateStructure(result.data)) {
      jsonResponse(res, 500, { error: 'Corrupt state file: invalid structure' });
    } else {
      jsonResponse(res, 200, { data: result.data, lastModified: result.stat.mtimeMs });
    }
    return true;
  }

  // PUT /api/state
  if (method === 'PUT' && pathname === '/api/state') {
    const body = await parseJsonBody(req);
    if (!validateStateStructure(body)) {
      jsonResponse(res, 400, { error: 'Invalid state structure: must include tasks array' });
      return true;
    }
    const stateDir = join(projectPath, '.devmanager');
    await ensureDir(stateDir);
    const statePath = join(stateDir, 'state.json');

    // Optimistic concurrency: if client sends lastModified, reject if file is newer
    if (body._lastModified) {
      const clientLastModified = body._lastModified;
      try {
        const fileStat = await stat(statePath);
        if (fileStat.mtimeMs > clientLastModified + 1000) {
          // File on disk is newer — return 409 with current state
          const content = await readFile(statePath, 'utf-8');
          const currentData = JSON.parse(content);
          if (!validateStateStructure(currentData)) {
            jsonResponse(res, 500, { error: 'Corrupt state file on disk' });
            return true;
          }
          jsonResponse(res, 409, {
            error: 'Conflict: file on disk is newer',
            data: currentData,
            lastModified: fileStat.mtimeMs,
          });
          return true;
        }
      } catch (err) {
        // File doesn't exist yet, safe to write
        if (err.code !== 'ENOENT') throw err;
      }
    }

    // Strip internal field and increment version counter before writing
    const { _lastModified, ...stateData } = body;
    stateData._v = (stateData._v || 0) + 1;
    await writeFile(statePath, JSON.stringify(stateData, null, 2), 'utf-8');
    const newStat = await stat(statePath);
    jsonResponse(res, 200, { ok: true, lastModified: newStat.mtimeMs });
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
          const parsed = JSON.parse(content);
          const validated = validateProgressEntry(parsed);
          if (validated) {
            entries[key] = validated;
          } else {
            console.warn(`[state] Invalid progress file skipped: ${file}`);
          }
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
  params = matchRoute(method, pathname, 'DELETE', '/api/progress/:taskId');
  if (params) {
    const filePath = safePath(projectPath, '.devmanager', 'progress', `${params.taskId}.json`);
    if (!filePath) {
      jsonResponse(res, 400, { error: 'Invalid path' });
      return true;
    }
    try {
      await unlink(filePath);
      jsonResponse(res, 200, { ok: true });
    } catch (err) {
      handleNotFound(res, err, 'Progress file not found');
    }
    return true;
  }

  return false;
}
