import { watch } from 'node:fs';
import { readFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

        // Validate state.json when it changes — fix inconsistent task statuses
        data = await validateState(filePath, data);
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
          entries[key] = JSON.parse(content);
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

// --- State validation safety net ---
// Fixes inconsistent task states that the orchestrator LLM may produce
// (e.g., sets completedAt but forgets status: "done")

export async function validateState(filePath, data) {
  if (!data || !Array.isArray(data.tasks)) return data;

  let fixed = false;

  for (const task of data.tasks) {
    // If completedAt is set but status isn't "done" — fix it
    if (task.completedAt && task.status !== 'done') {
      console.warn(`[validate] Task ${task.id} ("${task.name}"): has completedAt but status="${task.status}" — fixing to "done"`);
      task.status = 'done';
      fixed = true;
    }

    // If commitRef is set but status isn't "done" — fix it
    if (task.commitRef && task.status !== 'done') {
      console.warn(`[validate] Task ${task.id} ("${task.name}"): has commitRef but status="${task.status}" — fixing to "done"`);
      task.status = 'done';
      fixed = true;
    }

    // If status is "done" but no completedAt — set it to today
    if (task.status === 'done' && !task.completedAt) {
      const today = new Date().toISOString().split('T')[0];
      console.warn(`[validate] Task ${task.id} ("${task.name}"): status is "done" but no completedAt — setting to ${today}`);
      task.completedAt = today;
      fixed = true;
    }
  }

  if (fixed) {
    // NOTE: Do NOT write corrections back to state.json here.
    // The watcher must not be a concurrent writer — corrections are
    // applied in-memory only and broadcast to the UI, which saves
    // through the server API (the sole authorized writer).
    console.warn('[validate] Corrections applied in-memory (not written to disk)');
  }

  return data;
}

// Deploy all CLI helper scripts to .devmanager/bin/ in the target project
const HELPER_SCRIPTS = ['task-done.cjs', 'task-start.cjs', 'queue-next.cjs', 'merge-safe.cjs'];

async function ensureHelperScripts(projectPath) {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const targetDir = join(projectPath, '.devmanager', 'bin');

  let needsMkdir = true;

  for (const script of HELPER_SCRIPTS) {
    const source = join(serverDir, script);
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
