import { spawn } from 'node:child_process';
import { writeFile, mkdir, stat as fsStat } from 'node:fs/promises';
import { join } from 'node:path';
import { ProcessManager } from 'agent-runner';

// --- Adapter: SpawnPort → node:child_process ---

const nodeSpawnPort = {
  spawn(cmd, args, opts) {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', ...opts.env },
    });
    return {
      get pid() { return proc.pid; },
      onStdout(cb) { proc.stdout?.on('data', (d) => cb(d.toString('utf-8'))); },
      onStderr(cb) { proc.stderr?.on('data', (d) => cb(d.toString('utf-8'))); },
      onClose(cb) { proc.on('close', cb); },
      onError(cb) { proc.on('error', cb); },
      kill() { proc.kill(); },
    };
  },
};

// --- Adapter: ProgressWriterPort → node:fs ---

const nodeProgressWriter = {
  async wasRecentlyWritten(projectPath, taskId, windowMs) {
    try {
      const progressFile = join(projectPath, '.maestro', 'progress', `${taskId}.json`);
      const s = await fsStat(progressFile);
      return (Date.now() - s.mtimeMs) < windowMs;
    } catch {
      return false;
    }
  },
  async writeFallbackProgress(projectPath, taskId, entry) {
    const progressDir = join(projectPath, '.maestro', 'progress');
    await mkdir(progressDir, { recursive: true });
    const progressFile = join(progressDir, `${taskId}.json`);
    await writeFile(progressFile, JSON.stringify(entry, null, 2), 'utf-8');
  },
};

// --- Singleton ---

let instance = null;
let broadcastFn = null;

export function setBroadcast(fn) {
  broadcastFn = fn;
}

export function getProcessManager() {
  if (!instance) {
    const broadcastPort = {
      send(message) {
        if (broadcastFn) broadcastFn(message);
      },
    };
    instance = new ProcessManager(nodeSpawnPort, nodeProgressWriter, broadcastPort);
  }
  return instance;
}
