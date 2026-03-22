import { spawn } from 'node:child_process';

const ENGINE_COMMANDS = {
  claude: (command) => ({
    cmd: 'claude',
    args: ['-p', command, '--dangerously-skip-permissions'],
  }),
  codex: (command) => ({
    cmd: 'codex',
    args: ['exec', command],
  }),
  cursor: (command) => ({
    cmd: 'cursor-agent',
    args: ['-p', command],
  }),
};

class ProcessManager {
  constructor() {
    this.processes = new Map();
  }

  launchProcess(projectPath, taskId, command, engine = 'claude', broadcast) {
    const adapter = ENGINE_COMMANDS[engine];
    if (!adapter) {
      throw new Error(`Unknown engine: ${engine}. Supported: ${Object.keys(ENGINE_COMMANDS).join(', ')}`);
    }

    const { cmd, args } = adapter(command);

    const proc = spawn(cmd, args, {
      cwd: projectPath,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pid = proc.pid;
    const entry = {
      taskId,
      engine,
      process: proc,
      startedAt: new Date().toISOString(),
    };
    this.processes.set(pid, entry);

    // Stream stdout
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        const text = data.toString('utf-8');
        try {
          broadcast({ type: 'output', taskId, pid, text });
        } catch (err) {
          console.error('Broadcast stdout error:', err.message);
        }
      });
    }

    // Stream stderr
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        const text = data.toString('utf-8');
        try {
          broadcast({ type: 'output', taskId, pid, text, stream: 'stderr' });
        } catch (err) {
          console.error('Broadcast stderr error:', err.message);
        }
      });
    }

    // Handle exit
    proc.on('close', (code) => {
      this.processes.delete(pid);
      try {
        broadcast({ type: 'exit', taskId, pid, code });
      } catch (err) {
        console.error('Broadcast exit error:', err.message);
      }
    });

    proc.on('error', (err) => {
      console.error(`Process error (pid=${pid}, engine=${engine}):`, err.message);
      this.processes.delete(pid);
      try {
        broadcast({ type: 'exit', taskId, pid, code: -1, error: err.message });
      } catch (broadcastErr) {
        console.error('Broadcast process error:', broadcastErr.message);
      }
    });

    return { pid };
  }

  listProcesses() {
    const result = [];
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

  killProcess(pid) {
    const entry = this.processes.get(pid);
    if (!entry) return false;
    try {
      entry.process.kill();
    } catch (err) {
      console.error(`Kill process error (pid=${pid}):`, err.message);
    }
    this.processes.delete(pid);
    return true;
  }

  killAll() {
    for (const [pid, entry] of this.processes) {
      try {
        entry.process.kill();
      } catch (err) {
        console.error(`Kill process error (pid=${pid}):`, err.message);
      }
    }
    this.processes.clear();
  }
}

let instance = null;

export function getProcessManager() {
  if (!instance) {
    instance = new ProcessManager();
  }
  return instance;
}
