import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Integration tests for .devmanager/bin/ CLI scripts.
 *
 * Each test creates a temp directory with a .devmanager/ structure,
 * runs the script via node, and asserts on stdout/stderr/files.
 */

const SCRIPTS_DIR = path.resolve(__dirname, '../../.devmanager/bin');

let tmpDir: string;

function run(script: string, args: string[] = [], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const scriptPath = path.join(SCRIPTS_DIR, script);
  try {
    const stdout = execSync(`node "${scriptPath}" ${args.join(' ')}`, {
      cwd: cwd || tmpDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: stdout.trim(), stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout || '').trim(),
      stderr: (e.stderr || '').trim(),
      exitCode: e.status ?? 1,
    };
  }
}

function writeState(state: object) {
  const devDir = path.join(tmpDir, '.devmanager');
  fs.mkdirSync(devDir, { recursive: true });
  fs.writeFileSync(path.join(devDir, 'state.json'), JSON.stringify(state));
}

function readProgress(taskId: number) {
  const p = path.join(tmpDir, '.devmanager', 'progress', `${taskId}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devmanager-test-'));
  // Create .devmanager dir so scripts can find it
  fs.mkdirSync(path.join(tmpDir, '.devmanager'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── task-start.cjs ──

describe('task-start.cjs', () => {
  it('creates progress file with in-progress status', () => {
    const result = run('task-start.cjs', ['42']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Task 42 marked as in-progress');

    const progress = readProgress(42);
    expect(progress.status).toBe('in-progress');
    expect(progress.startedAt).toBeTruthy();
  });

  it('fails with no arguments', () => {
    const result = run('task-start.cjs');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
  });

  it('fails with non-numeric task ID', () => {
    const result = run('task-start.cjs', ['abc']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid task ID');
  });

  it('creates progress directory if missing', () => {
    // .devmanager exists but progress/ does not
    const result = run('task-start.cjs', ['7']);
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, '.devmanager', 'progress', '7.json'))).toBe(true);
  });
});

// ── task-done.cjs ──

describe('task-done.cjs', () => {
  it('creates progress file with done status and commit ref', () => {
    const result = run('task-done.cjs', ['42', '--commit', 'abc1234']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Task 42 marked as done');

    const progress = readProgress(42);
    expect(progress.status).toBe('done');
    expect(progress.commitRef).toBe('abc1234');
    expect(progress.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('fails with no arguments', () => {
    const result = run('task-done.cjs');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
  });

  it('fails without --commit flag', () => {
    const result = run('task-done.cjs', ['42']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--commit');
  });

  it('fails with non-numeric task ID', () => {
    const result = run('task-done.cjs', ['xyz']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid task ID');
  });
});

// ── queue-next.cjs ──

describe('queue-next.cjs', () => {
  it('outputs QUEUE_EMPTY when queue is empty', () => {
    writeState({ tasks: [], queue: [] });
    const result = run('queue-next.cjs');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('QUEUE_EMPTY=true');
  });

  it('outputs QUEUE_EMPTY when queue field is missing', () => {
    writeState({ tasks: [] });
    const result = run('queue-next.cjs');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('QUEUE_EMPTY=true');
  });

  it('outputs task details for first queued item', () => {
    writeState({
      tasks: [
        { id: 10, name: 'Add login', fullName: 'Add Google OAuth login', group: 'Auth' },
        { id: 11, name: 'Fix bug' },
      ],
      queue: [
        { task: 10, taskName: 'Add login', notes: 'Use OAuth2' },
        { task: 11, taskName: 'Fix bug' },
      ],
    });
    const result = run('queue-next.cjs');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TASK_ID=10');
    expect(result.stdout).toContain('TASK_NAME=Add login');
    expect(result.stdout).toContain('TASK_FULL=Add Google OAuth login');
    expect(result.stdout).toContain('TASK_GROUP=Auth');
    expect(result.stdout).toContain('NOTES=Use OAuth2');
    expect(result.stdout).toContain('QUEUE_REMAINING=2');
  });

  it('falls back to queue taskName when task not found', () => {
    writeState({
      tasks: [],
      queue: [{ task: 99, taskName: 'Orphan task', notes: '' }],
    });
    const result = run('queue-next.cjs');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TASK_ID=99');
    expect(result.stdout).toContain('TASK_NAME=Orphan task');
  });

  it('outputs HAS_NOTES=yes when notes file exists', () => {
    writeState({
      tasks: [{ id: 5, name: 'Test' }],
      queue: [{ task: 5, taskName: 'Test', notes: '' }],
    });
    const notesDir = path.join(tmpDir, '.devmanager', 'notes');
    fs.mkdirSync(notesDir, { recursive: true });
    fs.writeFileSync(path.join(notesDir, '5.md'), '# Notes');

    const result = run('queue-next.cjs');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('HAS_NOTES=yes');
  });

  it('outputs HAS_NOTES=no when notes file missing', () => {
    writeState({
      tasks: [{ id: 5, name: 'Test' }],
      queue: [{ task: 5, taskName: 'Test', notes: '' }],
    });
    const result = run('queue-next.cjs');
    expect(result.stdout).toContain('HAS_NOTES=no');
  });

  it('fails when state.json is missing', () => {
    // Remove the .devmanager dir so state.json can't be found
    fs.rmSync(path.join(tmpDir, '.devmanager'), { recursive: true });
    const result = run('queue-next.cjs');
    expect(result.exitCode).toBe(1);
  });

  it('outputs AUTO_APPROVE=yes when task has autoApprove flag', () => {
    writeState({
      tasks: [{ id: 3, name: 'Auto task', autoApprove: true }],
      queue: [{ task: 3, taskName: 'Auto task', notes: '' }],
    });
    const result = run('queue-next.cjs');
    expect(result.stdout).toContain('AUTO_APPROVE=yes');
  });

  it('multiline notes are escaped to single line', () => {
    writeState({
      tasks: [{ id: 1, name: 'Test' }],
      queue: [{ task: 1, taskName: 'Test', notes: 'Line 1\nLine 2\nLine 3' }],
    });
    const result = run('queue-next.cjs');
    expect(result.stdout).toContain('NOTES=Line 1\\nLine 2\\nLine 3');
  });
});

// ── merge-safe.cjs ──

describe('merge-safe.cjs', () => {
  it('fails with no arguments', () => {
    const result = run('merge-safe.cjs');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
  });

  it('fails with non-numeric task ID', () => {
    const result = run('merge-safe.cjs', ['abc']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid task ID');
  });

  it('fails when no matching branch exists', () => {
    // Initialize a git repo so git commands work
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git -c user.name=Test -c user.email=test@test.com commit --allow-empty -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    // Create worktree dir so it passes that check... but no branch exists
    const worktreeDir = path.join(tmpDir, '.devmanager', 'worktrees', 'task-999');
    fs.mkdirSync(worktreeDir, { recursive: true });

    const result = run('merge-safe.cjs', ['999']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('MERGE_FAILED=no_branch');
  });

  it('uses for-each-ref for clean branch name discovery', () => {
    // Initialize git repo with a task branch
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git -c user.name=Test -c user.email=test@test.com commit --allow-empty -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git branch task-50-test-feature', { cwd: tmpDir, stdio: 'pipe' });

    // Verify for-each-ref gives clean output (no + or * prefixes)
    const branchOutput = execSync(
      'git for-each-ref --format=%(refname:short) "refs/heads/task-50-*"',
      { cwd: tmpDir, encoding: 'utf-8' },
    ).trim();
    expect(branchOutput).toBe('task-50-test-feature');

    // merge-safe will fail at worktree check, but the branch should be found
    const result = run('merge-safe.cjs', ['50']);
    expect(result.exitCode).toBe(1);
    // Should fail at worktree check, not branch check
    expect(result.stdout).toContain('MERGE_FAILED=no_worktree');
    expect(result.stdout).toContain('BRANCH=task-50-test-feature');
  });
});
