import { readFile, writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises';
import { writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import { jsonResponse, parseJsonBody, ensureDir, matchRoute, readJsonOrNull, handleNotFound, safePath } from '../middleware.js';
import { validateStateStructure } from 'taskgraph';
import { StateWriter } from 'sync-protocol';

// --- Adapter: FileReaderPort + FileWriterPort → node:fs ---

const nodeFileReader = {
  async readFile(path) { return readFile(path, 'utf-8'); },
  async stat(path) { return stat(path); },
  async readdir(path) { return readdir(path); },
  async exists(path) {
    try { await stat(path); return true; } catch { return false; }
  },
};

const nodeFileWriter = {
  async writeFile(path, content) { return writeFile(path, content, 'utf-8'); },
  async ensureDir(path) { return mkdir(path, { recursive: true }); },
  async unlink(path) { return unlink(path); },
};

const stateWriter = new StateWriter(nodeFileReader, nodeFileWriter);

export async function handleState(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;
  let params;

  // POST /api/split-tasks — use Claude to split scratchpad text into individual tasks
  // This is product-specific logic, NOT part of sync-protocol
  if (method === 'POST' && pathname === '/api/split-tasks') {
    const body = await parseJsonBody(req);
    const { text, terminal } = body;
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

      // Terminal mode: open Claude in a terminal tab, write result to file
      if (terminal) {
        const scriptDir = join(projectPath, '.devmanager');
        mkdirSync(scriptDir, { recursive: true });

        const promptPath = join(scriptDir, 'split-prompt.txt');
        const resultPath = join(scriptDir, 'split-result.txt');

        // Clean up previous result
        try { unlinkSync(resultPath); } catch { /* ok */ }

        writeFileSync(promptPath, prompt);

        const os = platform();
        const { spawn: spawnProc } = await import('node:child_process');

        if (os === 'win32') {
          const scriptPath = join(scriptDir, 'split-run.ps1');
          const pf = promptPath.replace(/'/g, "''");
          const rf = resultPath.replace(/'/g, "''");
          writeFileSync(scriptPath, [
            `Write-Host "Splitting scratchpad into tasks..." -ForegroundColor Cyan`,
            `try {`,
            `  $prompt = [System.IO.File]::ReadAllText('${pf}')`,
            `  Write-Host "Prompt: $($prompt.Length) chars" -ForegroundColor DarkGray`,
            `  $output = & claude -p $prompt --output-format text 2>&1`,
            `  $text = ($output | Out-String).Trim()`,
            `  [System.IO.File]::WriteAllText('${rf}', $text)`,
            `  Write-Host ""`,
            `  Write-Host "Split complete! ($($text.Length) chars written)" -ForegroundColor Green`,
            `} catch {`,
            `  Write-Host "ERROR: $_" -ForegroundColor Red`,
            `}`,
          ].join('\n'));

          spawnProc('wt', [
            '-w', '0', 'nt',
            '--title', 'Split Tasks', '--suppressApplicationTitle',
            '-d', projectPath,
            '--', 'pwsh', '-NoExit', '-NoLogo', '-File', scriptPath,
          ], { cwd: projectPath, detached: true, stdio: 'ignore' }).unref();
        } else if (os === 'darwin') {
          const scriptPath = join(scriptDir, 'split-run.sh');
          const esc = s => s.replace(/"/g, '\\"');
          writeFileSync(scriptPath, [
            '#!/bin/bash',
            'echo "Splitting scratchpad into tasks..."',
            `cat "${esc(promptPath)}" | claude --output-format text > "${esc(resultPath)}" 2>&1`,
            'echo "\\nSplit complete!"',
          ].join('\n'));
          chmodSync(scriptPath, 0o755);
          spawnProc('open', ['-a', 'Terminal', scriptPath], { detached: true, stdio: 'ignore' }).unref();
        } else {
          const scriptPath = join(scriptDir, 'split-run.sh');
          const esc = s => s.replace(/"/g, '\\"');
          writeFileSync(scriptPath, [
            '#!/bin/bash',
            'echo "Splitting scratchpad into tasks..."',
            `cat "${esc(promptPath)}" | claude --output-format text > "${esc(resultPath)}" 2>&1`,
            'echo "Split complete!"; exec bash',
          ].join('\n'));
          chmodSync(scriptPath, 0o755);
          spawnProc('x-terminal-emulator', ['-e', scriptPath], { detached: true, stdio: 'ignore' }).unref();
        }

        jsonResponse(res, 200, { terminal: true });
        return true;
      }

      // Background mode: run Claude inline and return result
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

  // GET /api/split-tasks/result — poll for terminal split result
  if (method === 'GET' && pathname === '/api/split-tasks/result') {
    const resultPath = join(projectPath, '.devmanager', 'split-result.txt');
    try {
      const content = await readFile(resultPath, 'utf-8');
      const cleaned = content.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '').trim();
      const tasks = JSON.parse(cleaned);
      // Clean up temp files
      try { await unlink(resultPath); } catch { /* ok */ }
      try { await unlink(join(projectPath, '.devmanager', 'split-prompt.txt')); } catch { /* ok */ }
      jsonResponse(res, 200, { tasks });
    } catch {
      jsonResponse(res, 404, { pending: true });
    }
    return true;
  }

  // GET /api/state — delegated to StateWriter
  if (method === 'GET' && pathname === '/api/state') {
    const statePath = join(projectPath, '.devmanager', 'state.json');
    const result = await stateWriter.readState(statePath);
    if (!result) {
      jsonResponse(res, 404, { error: 'State file not found' });
    } else {
      jsonResponse(res, 200, { data: result.data, lastModified: result.lastModified });
    }
    return true;
  }

  // PUT /api/state — delegated to StateWriter
  if (method === 'PUT' && pathname === '/api/state') {
    const body = await parseJsonBody(req);
    const stateDir = join(projectPath, '.devmanager');
    const statePath = join(stateDir, 'state.json');

    const result = await stateWriter.writeState(statePath, stateDir, body);

    if ('error' in result) {
      jsonResponse(res, 400, { error: result.error });
    } else if ('conflict' in result) {
      jsonResponse(res, 409, {
        error: 'Conflict: file on disk is newer',
        data: result.data,
        lastModified: result.lastModified,
      });
    } else {
      jsonResponse(res, 200, { ok: true, lastModified: result.lastModified });
    }
    return true;
  }

  // GET /api/progress — delegated to StateWriter
  if (method === 'GET' && pathname === '/api/progress') {
    const progDir = join(projectPath, '.devmanager', 'progress');
    const entries = await stateWriter.readProgress(progDir);
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
