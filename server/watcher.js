import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DEBOUNCE_MS = 300;

function createDebouncedWatcher(filePath, type, broadcast) {
  let timeout = null;
  let lastContent = null;

  async function onChange() {
    try {
      const content = await readFile(filePath, 'utf-8');
      // Skip if content hasn't changed
      if (content === lastContent) return;
      lastContent = content;
      const data = JSON.parse(content);
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

export function startWatcher(projectPath, broadcast) {
  const watchers = [];
  const retryIntervals = [];

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
