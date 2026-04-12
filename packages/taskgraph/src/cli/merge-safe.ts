#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { requireDevManagerDir } from './find-devmanager.js';

// --- Argument parsing ---

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node .devmanager/bin/merge-safe.cjs <taskId>');
  process.exit(1);
}

const taskId = parseInt(args[0], 10);
if (isNaN(taskId)) {
  console.error(`Error: Invalid task ID "${args[0]}" — must be a number.`);
  process.exit(1);
}

const devmanagerDir = requireDevManagerDir();
const projectRoot = path.dirname(devmanagerDir);
const lockFile = path.join(devmanagerDir, 'merge.lock');
const worktreeRelative = `.devmanager/worktrees/task-${taskId}`;
const worktreeAbsolute = path.join(projectRoot, worktreeRelative);

// --- Helpers ---

function git(cmd: string, cwd?: string): string {
  return execSync(cmd, {
    cwd: cwd || projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function fail(reason: string, extraInfo: { branch?: string; conflictFiles?: string }): never {
  console.log(`MERGE_FAILED=${reason}`);
  if (extraInfo.conflictFiles) {
    console.log(`CONFLICT_FILES=${extraInfo.conflictFiles}`);
  }
  console.log(`LOCK_RELEASED=yes`);
  console.log(`WORKTREE=${worktreeRelative}`);
  if (extraInfo.branch) {
    console.log(`BRANCH=${extraInfo.branch}`);
  }
  process.exit(1);
}

function getConflictFiles(cwd: string): string {
  try {
    const output = git('git diff --name-only --diff-filter=U', cwd);
    return output.split('\n').filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

function sleep(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy-wait
  }
}

// --- 1. Discover branch name ---

let branchName = '';
try {
  const branchOutput = git(`git branch --list "task-${taskId}-*"`);
  if (!branchOutput) {
    fail('no_branch', {});
  }
  const branches = branchOutput.split('\n').map(b => b.replace(/^[\s*]+/, '').trim()).filter(Boolean);
  if (branches.length === 0) {
    fail('no_branch', {});
  }
  branchName = branches[0];
} catch {
  fail('no_branch', {});
}

// --- 2. Check worktree exists ---

if (!fs.existsSync(worktreeAbsolute)) {
  fail('no_worktree', { branch: branchName });
}

// --- 3. Acquire lock ---

function acquireLock(): void {
  const LOCK_TIMEOUT_MS = 60000;
  const LOCK_STALE_MS = 10 * 60 * 1000;
  const POLL_INTERVAL_MS = 2000;

  const startTime = Date.now();

  while (fs.existsSync(lockFile)) {
    try {
      const lockStat = fs.statSync(lockFile);
      const lockAge = Date.now() - lockStat.mtimeMs;
      if (lockAge > LOCK_STALE_MS) {
        const lockContent = fs.readFileSync(lockFile, 'utf-8').trim();
        console.error(`Warning: Stale merge lock (${Math.round(lockAge / 1000)}s old, task ${lockContent}). Taking over.`);
        break;
      }
    } catch {
      break;
    }

    if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
      const lockContent = fs.readFileSync(lockFile, 'utf-8').trim();
      console.error(`Error: Merge lock held by task ${lockContent} for over 60s.`);
      console.log(`MERGE_FAILED=lock_timeout`);
      console.log(`LOCK_RELEASED=no`);
      console.log(`WORKTREE=${worktreeRelative}`);
      console.log(`BRANCH=${branchName}`);
      process.exit(1);
    }

    sleep(POLL_INTERVAL_MS);
  }

  fs.writeFileSync(lockFile, String(taskId), 'utf-8');
}

function releaseLock(): void {
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch {
    // Best effort
  }
}

// --- Main execution ---

acquireLock();

try {
  // --- 4. Rebase onto master ---

  try {
    git('git rebase master', worktreeAbsolute);
  } catch {
    const conflictFiles = getConflictFiles(worktreeAbsolute);
    if (conflictFiles) {
      try { git('git rebase --abort', worktreeAbsolute); } catch { /* already aborted */ }
      releaseLock();
      fail('rebase_conflict', { branch: branchName, conflictFiles });
    }
    releaseLock();
    fail('git_error', { branch: branchName });
  }

  // --- 5. Merge into master ---

  try {
    git(`git merge ${branchName} --no-edit`, projectRoot);
  } catch {
    const conflictFiles = getConflictFiles(projectRoot);
    if (conflictFiles) {
      try { git('git merge --abort', projectRoot); } catch { /* already aborted */ }
      releaseLock();
      fail('merge_conflict', { branch: branchName, conflictFiles });
    }
    releaseLock();
    fail('git_error', { branch: branchName });
  }

  // --- 6. Get commit hash ---

  let commitHash = '';
  try {
    commitHash = git('git rev-parse --short HEAD', projectRoot);
  } catch {
    commitHash = 'unknown';
  }

  // --- 7. Clean up worktree and branch ---

  try {
    git(`git worktree remove ${worktreeRelative}`, projectRoot);
  } catch {
    try {
      git(`git worktree remove ${worktreeRelative} --force`, projectRoot);
    } catch {
      console.error(`Warning: Could not remove worktree ${worktreeRelative}`);
    }
  }

  try {
    git(`git branch -d ${branchName}`, projectRoot);
  } catch {
    try {
      git(`git branch -D ${branchName}`, projectRoot);
    } catch {
      console.error(`Warning: Could not delete branch ${branchName}`);
    }
  }

  // --- 8. Success output ---

  console.log('MERGE_OK=yes');
  console.log(`COMMIT=${commitHash}`);
  console.log(`BRANCH=${branchName}`);

} finally {
  releaseLock();
}
