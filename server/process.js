import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_OUTPUT_LINES = 500;

function buildClaudePrompt(command) {
  // In -p mode, slash commands don't work. Convert to plain prompts.
  const taskMatch = command.match(/^\/orchestrator\s+task\s+(\d+)/);
  if (taskMatch) {
    return `Read .devmanager/state.json, find task #${taskMatch[1]}, and execute it using the orchestrator skill defined in .claude/skills/orchestrator/SKILL.md. This is a headless execution — skip plan approval, execute the full plan immediately. Do not wait for user input at any point.

CRITICAL — DO NOT WRITE TO .devmanager/state.json DIRECTLY. Other agents and the UI write to state.json concurrently. If you overwrite it, you will destroy other agents' work. Instead:

1. Write progress updates ONLY to .devmanager/progress/${taskMatch[1]}.json (the UI merges these automatically)
2. For progress during execution, write to .devmanager/progress/${taskMatch[1]}.json with:
   {"status":"in-progress","progress":"<current step>"}
3. When done, use the helper script: node .devmanager/bin/task-done.cjs ${taskMatch[1]} --commit <short-hash>
   This writes the final done status to the progress file (the UI handles queue removal and activity logging)

When the task is complete, write the progress file to .devmanager/progress/${taskMatch[1]}.json with this format:
{"status":"done","completedAt":"<ISO date>","commitRef":"<short hash>","summary":"<2-3 sentence product-level summary of what was done and what users will see>","filesChanged":<number>}

The summary should be written for a product manager — describe the user-facing outcome, not the code changes.`;
  }
  if (/^\/codehealth/.test(command)) {
    return `Execute the codehealth skill defined in .claude/skills/codehealth/SKILL.md. Scan the entire codebase, score all 11 dimensions, and write the results to .devmanager/quality/latest.json.

This is a headless execution — do not wait for user input at any point.`;
  }
  if (/^\/autofix/.test(command)) {
    return `Execute the autofix skill defined in .claude/skills/autofix/SKILL.md. Read the codehealth backlog from .devmanager/quality/backlog.json, pick the highest-priority fixable issues, and fix them.

Write progress updates to .devmanager/progress/autofix.json as you work.

This is a headless execution — do not wait for user input at any point.`;
  }
  if (/^\/orchestrator\s+arrange/.test(command)) {
    return `Read .devmanager/state.json and analyze all pending tasks. Organize them into a logical dependency graph — figure out which tasks depend on others and set the dependsOn fields. Group related tasks under epics.

CRITICAL — DO NOT WRITE TO .devmanager/state.json DIRECTLY. Other agents and the UI write to state.json concurrently. If you overwrite it, you will destroy other agents' work.

Instead, write ALL your changes to .devmanager/progress/arrange.json. The UI merges this automatically. Use this exact JSON format:
{"status":"done","label":"<short summary of changes>","changes":[<list of change descriptions>],"taskUpdates":{"<taskId>":{"dependsOn":[<ids>],"group":"<epic name>"}}}

The taskUpdates object maps task IDs to the fields you want to change. Only include dependsOn and group fields.

Example: {"status":"done","label":"Arranged 8 tasks into 3 phases","changes":["Set task #5 depends on #3","Grouped #6,#7,#8 under 'Polish' epic"],"taskUpdates":{"5":{"dependsOn":[3],"group":"Core"},"6":{"group":"Polish"},"7":{"group":"Polish"},"8":{"group":"Polish"}}}

Be specific about what dependencies you set and what groupings you made.`;
  }
  return command + '\n\nThis is a headless execution. Skip plan approval and execute immediately. Do not wait for user input at any point.';
}

const ENGINE_COMMANDS = {
  claude: (command) => ({
    cmd: 'claude',
    args: ['--dangerously-skip-permissions', '-p', buildClaudePrompt(command)],
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
    this.finished = new Map(); // taskId → { output, exitCode, ... } — kept for reconnecting clients
  }

  launchProcess(projectPath, taskId, command, engine = 'claude', broadcast) {
    // Prevent duplicate launches — reject if this task is already running
    if (taskId && taskId > 0) {
      for (const [, entry] of this.processes) {
        if (entry.taskId === taskId) {
          throw new Error(`Task ${taskId} is already running (pid ${entry.process.pid}). Kill it first or wait for it to finish.`);
        }
      }
    }

    const adapter = ENGINE_COMMANDS[engine];
    if (!adapter) {
      throw new Error(`Unknown engine: ${engine}. Supported: ${Object.keys(ENGINE_COMMANDS).join(', ')}`);
    }

    const { cmd, args } = adapter(command);

    const proc = spawn(cmd, args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const pid = proc.pid;
    const output = [];
    const entry = {
      taskId,
      engine,
      process: proc,
      projectPath,
      startedAt: new Date().toISOString(),
      output,
    };
    this.processes.set(pid, entry);

    // Also keep finished output for reconnecting clients
    const addOutput = (text, stream) => {
      const line = { text, stream, time: Date.now() };
      output.push(line);
      if (output.length > MAX_OUTPUT_LINES) output.shift();
    };

    // Stream stdout
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        const text = data.toString('utf-8');
        addOutput(text, 'stdout');
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
        addOutput(text, 'stderr');
        try {
          broadcast({ type: 'output', taskId, pid, text, stream: 'stderr' });
        } catch (err) {
          console.error('Broadcast stderr error:', err.message);
        }
      });
    }

    // Handle exit — write progress file so task status updates even if client disconnected
    proc.on('close', async (code) => {
      // Move to finished map before deleting from active
      this.finished.set(taskId, { ...entry, exitCode: code, finishedAt: Date.now() });
      this.processes.delete(pid);

      // Write progress file only if the orchestrator didn't already write one
      if (taskId && taskId > 0) {
        try {
          const progressDir = join(projectPath, '.devmanager', 'progress');
          await mkdir(progressDir, { recursive: true });
          const progressFile = join(progressDir, `${taskId}.json`);
          // Check if orchestrator already wrote a progress file
          let alreadyWritten = false;
          try {
            const { stat: fsStat } = await import('node:fs/promises');
            const s = await fsStat(progressFile);
            // If file was modified in the last 60s, orchestrator handled it
            alreadyWritten = (Date.now() - s.mtimeMs) < 60000;
          } catch { /* file doesn't exist */ }
          if (!alreadyWritten && code !== 0) {
            // Only write on failure — success should be handled by the orchestrator
            await writeFile(progressFile, JSON.stringify({ status: 'in-progress', progress: `Process exited with code ${code}` }, null, 2), 'utf-8');
          }
        } catch (writeErr) {
          console.error(`Failed to write progress for task ${taskId}:`, writeErr.message);
        }
      }

      try {
        broadcast({ type: 'exit', taskId, pid, code });
      } catch (err) {
        console.error('Broadcast exit error:', err.message);
      }
    });

    proc.on('error', (err) => {
      console.error(`Process error (pid=${pid}, engine=${engine}):`, err.message);
      this.finished.set(taskId, { ...entry, exitCode: -1, error: err.message, finishedAt: Date.now() });
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

  getOutput(taskId) {
    // Check active processes first
    for (const [, entry] of this.processes) {
      if (entry.taskId === taskId) return { output: entry.output, running: true };
    }
    // Check finished
    const fin = this.finished.get(taskId);
    if (fin) return { output: fin.output, running: false, exitCode: fin.exitCode };
    return null;
  }

  getAllOutput() {
    const result = {};
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
