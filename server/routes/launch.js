import { platform } from 'node:os';
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { jsonResponse, parseJsonBody, matchRoute } from '../middleware.js';

// PowerShell-safe string escaping (mirrors src/utils/queueUtils.ts)
function escapePS(s) {
  return s
    .replace(/`/g, '``')           // backtick (PS escape char) — double it first
    .replace(/\$/g, '`$')          // variable expansion
    .replace(/;/g, '`;')           // statement separator
    .replace(/\|/g, '`|')          // pipeline
    .replace(/&/g, '`&')           // call operator
    .replace(/\(/g, '`(')          // subexpression open
    .replace(/\)/g, '`)')          // subexpression close
    .replace(/'/g, "''")           // single quote (for single-quoted strings)
    .replace(/[\r\n]+/g, ' ');     // newlines
}

// Allowlist pattern for commands passed to terminal launchers
const ALLOWED_CMD_RE = /^\/orchestrator\s+(next|arrange|status|task\s+\d+|\d+)$|^\/codehealth(\s+(scan|quick|diff))?$|^\/autofix$|^Read \.devmanager\//;

export async function handleLaunch(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;
  let params;

  // POST /api/launch
  if (method === 'POST' && pathname === '/api/launch') {
    const { getProcessManager } = await import('../process.js');
    const { broadcast } = await import('../index.js');
    const body = await parseJsonBody(req);
    const { taskId, command, engine } = body;
    if (taskId == null || !command) {
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
    // Layer 1: Validate command against allowlist
    if (!ALLOWED_CMD_RE.test(command)) {
      jsonResponse(res, 400, { error: 'Invalid command format' });
      return true;
    }
    const eng = engine || 'claude';
    const tabTitle = title || `Task ${taskId}`;
    const os = platform();

    try {
      const cliName = eng === 'claude' ? 'claude' : eng === 'codex' ? 'codex' : 'cursor-agent';

      // Layer 2: Write temp script files to avoid shell string interpolation
      const scriptDir = join(projectPath, '.devmanager');
      mkdirSync(scriptDir, { recursive: true });

      if (os === 'win32') {
        const scriptPath = join(scriptDir, `launch-${taskId || 'term'}.ps1`);
        // PowerShell single-quote escaping: double any single quotes
        const safeCmd = escapePS(command);
        writeFileSync(scriptPath, `& ${cliName} --dangerously-skip-permissions '${safeCmd}'\n`);

        const { spawn: spawnProc } = await import('node:child_process');
        spawnProc('wt', [
          '-w', '0', 'nt',
          '--title', tabTitle, '--suppressApplicationTitle',
          '-d', projectPath,
          '--', 'pwsh', '-NoExit', '-NoLogo', '-File', scriptPath,
        ], {
          cwd: projectPath,
          detached: true,
          stdio: 'ignore',
        }).unref();
      } else if (os === 'darwin') {
        const scriptPath = join(scriptDir, `launch-${taskId || 'term'}.sh`);
        writeFileSync(scriptPath, `#!/bin/bash\ncd "${projectPath.replace(/"/g, '\\"')}" && exec ${cliName} --dangerously-skip-permissions "${command.replace(/"/g, '\\"')}"\n`);
        chmodSync(scriptPath, 0o755);

        const { spawn: spawnProc } = await import('node:child_process');
        spawnProc('open', ['-a', 'Terminal', scriptPath], { detached: true, stdio: 'ignore' }).unref();
      } else {
        const scriptPath = join(scriptDir, `launch-${taskId || 'term'}.sh`);
        writeFileSync(scriptPath, `#!/bin/bash\ncd "${projectPath.replace(/"/g, '\\"')}" && ${cliName} --dangerously-skip-permissions "${command.replace(/"/g, '\\"')}"; exec bash\n`);
        chmodSync(scriptPath, 0o755);

        const { spawn: spawnProc } = await import('node:child_process');
        spawnProc('x-terminal-emulator', ['-e', scriptPath], {
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
    const { getProcessManager } = await import('../process.js');
    const pm = getProcessManager();
    jsonResponse(res, 200, pm.listProcesses());
    return true;
  }

  // GET /api/launch/output — get all buffered output (for reconnecting clients)
  if (method === 'GET' && pathname === '/api/launch/output') {
    const { getProcessManager } = await import('../process.js');
    const pm = getProcessManager();
    jsonResponse(res, 200, pm.getAllOutput());
    return true;
  }

  // DELETE /api/launch/:pid
  params = matchRoute(method, pathname, 'DELETE', '/api/launch/:pid');
  if (params) {
    const { getProcessManager } = await import('../process.js');
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

  return false;
}
