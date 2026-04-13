import type {
  SpawnPort, ProcessHandle, BroadcastPort, ProgressWriterPort,
  EngineAdapter, LaunchResult, ProcessInfo, OutputLine, TaskOutput,
} from './types.js';
import { MAX_OUTPUT_LINES, FALLBACK_PROGRESS_WINDOW_MS } from './constants.js';
import { DEFAULT_ENGINES } from './prompt-builder.js';

interface ProcessEntry {
  taskId: number;
  engine: string;
  handle: ProcessHandle;
  projectPath: string;
  startedAt: string;
  output: OutputLine[];
}

interface FinishedEntry extends ProcessEntry {
  exitCode: number | null;
  error?: string;
  finishedAt: number;
}

export class ProcessManager {
  private processes = new Map<number, ProcessEntry>();
  private finished = new Map<number, FinishedEntry>();
  private engines: Record<string, EngineAdapter>;

  constructor(
    private spawner: SpawnPort,
    private progressWriter: ProgressWriterPort,
    private broadcast: BroadcastPort,
    engines?: Record<string, EngineAdapter>,
  ) {
    this.engines = engines ?? DEFAULT_ENGINES;
  }

  launchProcess(projectPath: string, taskId: number, command: string, engine = 'claude'): LaunchResult {
    // Prevent duplicate launches
    if (taskId && taskId > 0) {
      for (const [, entry] of this.processes) {
        if (entry.taskId === taskId) {
          throw new Error(`Task ${taskId} is already running (pid ${entry.handle.pid}). Kill it first or wait for it to finish.`);
        }
      }
    }

    const adapter = this.engines[engine];
    if (!adapter) {
      throw new Error(`Unknown engine: ${engine}. Supported: ${Object.keys(this.engines).join(', ')}`);
    }

    const { cmd, args } = adapter(command);
    const handle = this.spawner.spawn(cmd, args, { cwd: projectPath });
    const pid = handle.pid;
    const output: OutputLine[] = [];

    const entry: ProcessEntry = {
      taskId,
      engine,
      handle,
      projectPath,
      startedAt: new Date().toISOString(),
      output,
    };
    this.processes.set(pid, entry);

    const addOutput = (text: string, stream: 'stdout' | 'stderr') => {
      output.push({ text, stream, time: Date.now() });
      if (output.length > MAX_OUTPUT_LINES) output.shift();
    };

    // Stream stdout
    handle.onStdout((text) => {
      addOutput(text, 'stdout');
      try {
        this.broadcast.send({ type: 'output', taskId, pid, text });
      } catch (err: any) {
        console.error('Broadcast stdout error:', err.message);
      }
    });

    // Stream stderr
    handle.onStderr((text) => {
      addOutput(text, 'stderr');
      try {
        this.broadcast.send({ type: 'output', taskId, pid, text, stream: 'stderr' });
      } catch (err: any) {
        console.error('Broadcast stderr error:', err.message);
      }
    });

    // Handle exit
    handle.onClose(async (code) => {
      this.finished.set(taskId, { ...entry, exitCode: code, finishedAt: Date.now() });
      this.processes.delete(pid);

      // Write fallback progress if orchestrator didn't handle it
      if (taskId && taskId > 0) {
        try {
          const alreadyWritten = await this.progressWriter.wasRecentlyWritten(
            projectPath, taskId, FALLBACK_PROGRESS_WINDOW_MS,
          );
          if (code === 0) {
            // Success: mark done if orchestrator didn't already
            if (!alreadyWritten) {
              await this.progressWriter.writeFallbackProgress(projectPath, taskId, {
                status: 'done',
                progress: 'Completed',
              });
            }
          } else if (!alreadyWritten) {
            await this.progressWriter.writeFallbackProgress(projectPath, taskId, {
              status: 'in-progress',
              progress: `Process exited with code ${code}`,
            });
          }
        } catch (writeErr: any) {
          console.error(`Failed to write progress for task ${taskId}:`, writeErr.message);
          try {
            this.broadcast.send({ type: 'error', taskId, message: `Failed to write progress: ${writeErr.message}` });
          } catch { /* swallow broadcast error */ }
        }
      }

      try {
        this.broadcast.send({ type: 'exit', taskId, pid, code });
      } catch (err: any) {
        console.error('Broadcast exit error:', err.message);
      }
    });

    // Handle spawn error
    handle.onError((err) => {
      console.error(`Process error (pid=${pid}, engine=${engine}):`, err.message);
      this.finished.set(taskId, { ...entry, exitCode: -1, error: err.message, finishedAt: Date.now() });
      this.processes.delete(pid);
      try {
        this.broadcast.send({ type: 'exit', taskId, pid, code: -1, error: err.message });
      } catch { /* swallow */ }
    });

    return { pid };
  }

  listProcesses(): ProcessInfo[] {
    const result: ProcessInfo[] = [];
    for (const [pid, entry] of this.processes) {
      result.push({
        pid,
        taskId: entry.taskId,
        engine: entry.engine,
        startedAt: entry.startedAt,
      });
    }
    return result;
  }

  killProcess(pid: number): boolean {
    const entry = this.processes.get(pid);
    if (!entry) return false;
    try {
      entry.handle.kill();
    } catch (err: any) {
      console.error(`Kill process error (pid=${pid}):`, err.message);
    }
    this.processes.delete(pid);
    return true;
  }

  getOutput(taskId: number): TaskOutput | null {
    for (const [, entry] of this.processes) {
      if (entry.taskId === taskId) return { output: entry.output, running: true };
    }
    const fin = this.finished.get(taskId);
    if (fin) return { output: fin.output, running: false, exitCode: fin.exitCode };
    return null;
  }

  getAllOutput(): Record<number, TaskOutput> {
    const result: Record<number, TaskOutput> = {};
    for (const [, entry] of this.processes) {
      result[entry.taskId] = { output: entry.output, running: true };
    }
    for (const [taskId, entry] of this.finished) {
      if (!result[taskId]) {
        result[taskId] = { output: entry.output, running: false, exitCode: entry.exitCode };
      }
    }
    return result;
  }

  killAll(): void {
    for (const [pid, entry] of this.processes) {
      try {
        entry.handle.kill();
      } catch (err: any) {
        console.error(`Kill process error (pid=${pid}):`, err.message);
      }
    }
    this.processes.clear();
  }
}
