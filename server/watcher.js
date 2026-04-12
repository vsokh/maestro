import { watch } from 'node:fs';
import { readFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProgress as validateProgressEntry, fixInconsistentTasks } from 'taskgraph';

const DEBOUNCE_MS = 300;

function createDebouncedWatcher(filePath, type, broadcast) {
  let timeout = null;
  let lastContent = null;
  let lastKnownVersion = 0;

  async function onChange() {
    try {
      const content = await readFile(filePath, 'utf-8');
      // Skip if content hasn't changed
      if (content === lastContent) return;
      lastContent = content;
      let data = JSON.parse(content);

      // Reject stale state.json writes (rogue LLM overwrites)
      if (type === 'state') {
        const incomingV = data._v || 0;
        if (incomingV > 0 && incomingV < lastKnownVersion) {
          console.warn(`[watcher] Rejected stale state.json: _v=${incomingV} < known=${lastKnownVersion}`);
          lastContent = null; // Reset so next valid write is accepted
          return;
        }
        if (incomingV > lastKnownVersion) {
          lastKnownVersion = incomingV;
        }

        // Fix inconsistent task statuses (e.g., completedAt without done status)
        if (data && Array.isArray(data.tasks)) {
          const result = fixInconsistentTasks(data.tasks);
          if (result.fixed) {
            data = { ...data, tasks: result.tasks };
          }
        }
      }

      const fileStat = await stat(filePath);
      broadcast({ type, data, lastModified: fileStat.mtimeMs });
    } catch (err) {
      // File may be mid-write or deleted; ignore transient errors
      if (err.code !== 'ENOENT') {
        console.error(`Watcher read error (${type}):`, err.message);
      }
    }
  }

  function handler() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(onChange, DEBOUNCE_MS);
  }

  return handler;
}

function watchFile(filePath, type, broadcast) {
  const handler = createDebouncedWatcher(filePath, type, broadcast);
  try {
    const watcher = watch(filePath, { persistent: false }, handler);
    watcher.on('error', (err) => {
      console.error(`Watcher error (${filePath}):`, err.message);
    });
    return watcher;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

function watchDirectory(dirPath, type, broadcast) {
  let debounceTimeout = null;
  let lastContents = new Map();

  async function readAllFiles() {
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(dirPath);
      const entries = {};
      let changed = false;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await readFile(join(dirPath, file), 'utf-8');
          const key = file.replace('.json', '');
          const parsed = JSON.parse(content);
          if (type === 'progress') {
            const validated = validateProgressEntry(parsed);
            if (!validated) {
              console.warn(`[watcher] Invalid progress entry skipped: ${file}`);
              continue;
            }
            entries[key] = validated;
          } else {
            entries[key] = parsed;
          }
          if (lastContents.get(file) !== content) {
            changed = true;
            lastContents.set(file, content);
          }
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.error(`Watcher parse error (${file}):`, err.message);
          }
        }
      }

      // Detect deletions
      for (const key of lastContents.keys()) {
        if (!files.includes(key)) {
          lastContents.delete(key);
          changed = true;
        }
      }

      if (changed) {
        broadcast({ type, data: entries });
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Watcher directory read error (${type}):`, err.message);
      }
    }
  }

  function handler() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(readAllFiles, DEBOUNCE_MS);
  }

  try {
    const watcher = watch(dirPath, { persistent: false, recursive: false }, handler);
    watcher.on('error', (err) => {
      console.error(`Directory watcher error (${dirPath}):`, err.message);
    });
    return watcher;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

function retryWatch(path, isDir, type, broadcast, watchers) {
  const retryInterval = setInterval(async () => {
    try {
      const s = await stat(path);
      if (isDir ? s.isDirectory() : s.isFile()) {
        clearInterval(retryInterval);
        const watcher = isDir
          ? watchDirectory(path, type, broadcast)
          : watchFile(path, type, broadcast);
        if (watcher) {
          watchers.push(watcher);
          console.log(`Watcher started: ${path}`);
        }
      }
    } catch {
      // Still doesn't exist, keep retrying
    }
  }, 5000);

  return retryInterval;
}

// validateState removed — now using fixInconsistentTasks from taskgraph

// Deploy all CLI helper scripts to .devmanager/bin/ in the target project
const HELPER_SCRIPTS = ['task-done.cjs', 'task-start.cjs', 'queue-next.cjs', 'merge-safe.cjs'];

async function ensureHelperScripts(projectPath) {
  // Prefer engine-built CLI scripts; fall back to server/ copies
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const engineCliDir = join(serverDir, '..', 'packages', 'engine', 'dist', 'cli');
  const targetDir = join(projectPath, '.devmanager', 'bin');

  let needsMkdir = true;

  for (const script of HELPER_SCRIPTS) {
    // Try engine dist first, then server dir as fallback
    let source = join(engineCliDir, script);
    try {
      await stat(source);
    } catch {
      source = join(serverDir, script);
    }
    const target = join(targetDir, script);

    try {
      // Check if source exists
      await stat(source);

      // Check if target already matches (by size comparison for speed)
      try {
        const [srcStat, tgtStat] = await Promise.all([stat(source), stat(target)]);
        if (srcStat.size === tgtStat.size && srcStat.mtimeMs <= tgtStat.mtimeMs) {
          continue; // Already up to date
        }
      } catch {
        // Target doesn't exist — need to copy
      }

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

export function startWatcher(projectPath, broadcast) {
  const watchers = [];
  const retryIntervals = [];

  // Deploy CLI helper scripts to target project
  ensureHelperScripts(projectPath);

  const stateFile = join(projectPath, '.devmanager', 'state.json');
  const progressDir = join(projectPath, '.devmanager', 'progress');
  const qualityDir = join(projectPath, '.devmanager', 'quality');

  // Watch state.json
  const stateWatcher = watchFile(stateFile, 'state', broadcast);
  if (stateWatcher) {
    watchers.push(stateWatcher);
  } else {
    retryIntervals.push(retryWatch(stateFile, false, 'state', broadcast, watchers));
  }

  // Watch progress directory
  const progressWatcher = watchDirectory(progressDir, 'progress', broadcast);
  if (progressWatcher) {
    watchers.push(progressWatcher);
  } else {
    retryIntervals.push(retryWatch(progressDir, true, 'progress', broadcast, watchers));
  }

  // Watch quality directory
  const qualityWatcher = watchDirectory(qualityDir, 'quality', broadcast);
  if (qualityWatcher) {
    watchers.push(qualityWatcher);
  } else {
    retryIntervals.push(retryWatch(qualityDir, true, 'quality', broadcast, watchers));
  }

  // Return cleanup function
  return () => {
    for (const w of watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    for (const interval of retryIntervals) {
      clearInterval(interval);
    }
  };
}
