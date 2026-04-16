import { validateProgress, fixInconsistentTasks } from 'taskgraph';
import type {
  FileReaderPort, FileWatcherPort, SyncBroadcastPort,
  TimerPort, WatchHandle, WatcherConfig,
} from './types.js';
import { DEBOUNCE_MS, RETRY_INTERVAL_MS } from './constants.js';

interface WatchTarget {
  path: string;
  type: string;
  isDir: boolean;
}

export class WatcherOrchestrator {
  private debounceMs: number;
  private retryIntervalMs: number;

  constructor(
    private fileReader: FileReaderPort,
    private watcher: FileWatcherPort,
    private broadcast: SyncBroadcastPort,
    private timer: TimerPort,
    config?: WatcherConfig,
  ) {
    this.debounceMs = config?.debounceMs ?? DEBOUNCE_MS;
    this.retryIntervalMs = config?.retryIntervalMs ?? RETRY_INTERVAL_MS;
  }

  /**
   * Start watching a project's .maestro directory.
   * Returns a cleanup function.
   */
  start(projectPath: string, targets: WatchTarget[]): () => void {
    const watchers: WatchHandle[] = [];
    const retryIntervals: unknown[] = [];

    for (const target of targets) {
      const watcher = target.isDir
        ? this.watchDirectory(target.path, target.type)
        : this.watchSingleFile(target.path, target.type);

      if (watcher) {
        watchers.push(watcher);
      } else {
        const interval = this.retryWatch(target, watchers);
        retryIntervals.push(interval);
      }
    }

    return () => {
      for (const w of watchers) {
        try { w.close(); } catch { /* ignore */ }
      }
      for (const interval of retryIntervals) {
        this.timer.clearInterval(interval);
      }
    };
  }

  private watchSingleFile(filePath: string, type: string): WatchHandle | null {
    let timeout: unknown = null;
    let lastContent: string | null = null;
    let lastKnownVersion = 0;

    const onChange = async () => {
      try {
        const content = await this.fileReader.readFile(filePath);
        if (content === lastContent) return;
        lastContent = content;
        let data = JSON.parse(content);

        if (type === 'state') {
          const incomingV = data._v || 0;
          if (incomingV > 0 && incomingV < lastKnownVersion) {
            console.warn(`[watcher] Rejected stale state.json: _v=${incomingV} < known=${lastKnownVersion}`);
            lastContent = null;
            return;
          }
          if (incomingV > lastKnownVersion) {
            lastKnownVersion = incomingV;
          }

          if (data && Array.isArray(data.tasks)) {
            const result = fixInconsistentTasks(data.tasks);
            if (result.fixed) {
              data = { ...data, tasks: result.tasks };
            }
          }
        }

        const fileStat = await this.fileReader.stat(filePath);
        this.broadcast.send({ type, data, lastModified: fileStat.mtimeMs });
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.error(`Watcher read error (${type}):`, err.message);
        }
      }
    };

    const handler = () => {
      if (timeout) this.timer.clearTimeout(timeout);
      timeout = this.timer.setTimeout(onChange, this.debounceMs);
    };

    return this.watcher.watchFile(filePath, handler);
  }

  private watchDirectory(dirPath: string, type: string): WatchHandle | null {
    let debounceTimeout: unknown = null;
    const lastContents = new Map<string, string>();

    const readAllFiles = async () => {
      try {
        const files = await this.fileReader.readdir(dirPath);
        const entries: Record<string, unknown> = {};
        let changed = false;

        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const fullPath = dirPath.endsWith('/') || dirPath.endsWith('\\')
              ? dirPath + file
              : dirPath + '/' + file;
            const content = await this.fileReader.readFile(fullPath);
            const key = file.replace('.json', '');
            const parsed = JSON.parse(content);

            if (type === 'progress') {
              const validated = validateProgress(parsed);
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
          } catch (err: any) {
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
          this.broadcast.send({ type, data: entries } as any);
        }
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.error(`Watcher directory read error (${type}):`, err.message);
        }
      }
    };

    const handler = () => {
      if (debounceTimeout) this.timer.clearTimeout(debounceTimeout);
      debounceTimeout = this.timer.setTimeout(readAllFiles, this.debounceMs);
    };

    return this.watcher.watchDirectory(dirPath, handler);
  }

  private retryWatch(target: WatchTarget, watchers: WatchHandle[]): unknown {
    return this.timer.setInterval(async () => {
      try {
        const exists = await this.fileReader.exists(target.path);
        if (exists) {
          // Stop retry — can't clear from inside, but the cleanup function handles it
          const watcher = target.isDir
            ? this.watchDirectory(target.path, target.type)
            : this.watchSingleFile(target.path, target.type);
          if (watcher) {
            watchers.push(watcher);
            console.log(`Watcher started: ${target.path}`);
          }
        }
      } catch {
        // Still doesn't exist, keep retrying
      }
    }, this.retryIntervalMs);
  }
}
