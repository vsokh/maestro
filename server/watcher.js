import { watch, existsSync, renameSync } from 'node:fs';
import { readFile, stat, mkdir, copyFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WatcherOrchestrator } from 'sync-protocol';

// --- Migrate legacy .devmanager → .maestro ---

function migrateIfNeeded(projectPath) {
  const legacy = join(projectPath, '.maestro');
  const modern = join(projectPath, '.maestro');
  if (existsSync(legacy) && !existsSync(modern)) {
    renameSync(legacy, modern);
    console.log(`Migrated .devmanager → .maestro in ${projectPath}`);
  }
}

// --- Adapter: FileReaderPort → node:fs ---

const nodeFileReader = {
  async readFile(path) { return readFile(path, 'utf-8'); },
  async stat(path) { return stat(path); },
  async readdir(path) { return readdir(path); },
  async exists(path) {
    try { await stat(path); return true; } catch { return false; }
  },
};

// --- Adapter: FileWatcherPort → node:fs.watch ---

const nodeFileWatcher = {
  watchFile(path, callback) {
    try {
      const watcher = watch(path, { persistent: false }, callback);
      watcher.on('error', (err) => console.error(`Watcher error (${path}):`, err.message));
      return watcher;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  },
  watchDirectory(path, callback) {
    try {
      const watcher = watch(path, { persistent: false, recursive: false }, callback);
      watcher.on('error', (err) => console.error(`Directory watcher error (${path}):`, err.message));
      return watcher;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  },
};

// --- Adapter: TimerPort → global timers ---

const nodeTimer = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (h) => clearTimeout(h),
  setInterval: (cb, ms) => setInterval(cb, ms),
  clearInterval: (h) => clearInterval(h),
};

// --- Helper scripts deployment (infrastructure-only, not part of sync protocol) ---

const HELPER_SCRIPTS = ['task-done.cjs', 'task-start.cjs', 'queue-next.cjs', 'merge-safe.cjs'];

async function ensureHelperScripts(projectPath) {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const engineCliDir = join(serverDir, '..', 'packages', 'taskgraph', 'dist', 'cli');
  const targetDir = join(projectPath, '.maestro', 'bin');

  let needsMkdir = true;

  for (const script of HELPER_SCRIPTS) {
    let source = join(engineCliDir, script);
    try {
      await stat(source);
    } catch {
      source = join(serverDir, script);
    }
    const target = join(targetDir, script);

    try {
      await stat(source);
      try {
        const [srcStat, tgtStat] = await Promise.all([stat(source), stat(target)]);
        if (srcStat.size === tgtStat.size && srcStat.mtimeMs <= tgtStat.mtimeMs) {
          continue;
        }
      } catch { /* target doesn't exist */ }

      if (needsMkdir) {
        await mkdir(targetDir, { recursive: true });
        needsMkdir = false;
      }

      await copyFile(source, target);
      console.log(`Deployed ${script} to ${targetDir}`);
    } catch (err) {
      console.error(`Failed to deploy ${script}:`, err.message);
    }
  }
}

// --- Start watcher ---

export function startWatcher(projectPath, broadcast) {
  // Migrate .devmanager → .maestro if needed
  migrateIfNeeded(projectPath);

  // Deploy CLI helper scripts
  ensureHelperScripts(projectPath);

  // Create orchestrator with real adapters
  const broadcastPort = { send: (msg) => broadcast(msg) };
  const orchestrator = new WatcherOrchestrator(
    nodeFileReader, nodeFileWatcher, broadcastPort, nodeTimer,
  );

  const stateFile = join(projectPath, '.maestro', 'state.json');
  const progressDir = join(projectPath, '.maestro', 'progress');
  const qualityDir = join(projectPath, '.maestro', 'quality');
  const errorsDir = join(projectPath, '.maestro', 'errors');

  return orchestrator.start(projectPath, [
    { path: stateFile, type: 'state', isDir: false },
    { path: progressDir, type: 'progress', isDir: true },
    { path: qualityDir, type: 'quality', isDir: true },
    { path: errorsDir, type: 'errors', isDir: true },
  ]);
}
