#!/usr/bin/env node

/**
 * merge-safe.cjs — Safely merge a task branch to master with lock management
 *
 * Usage:
 *   node .maestro/bin/merge-safe.cjs <taskId>
 *
 * What it does:
 *   1. Discovers branch name (git branch --list "task-{taskId}-*")
 *   2. Discovers worktree path (.maestro/worktrees/task-{taskId})
 *   3. Acquires .maestro/merge.lock (waits up to 60s if locked)
 *   4. Rebases branch onto master inside worktree
 *   5. Merges branch into master from project root
 *   6. Cleans up worktree and branch
 *   7. Releases lock (ALWAYS, even on failure)
 *
 * Success output:
 *   MERGE_OK=yes
 *   COMMIT=abc1234
 *   BRANCH=task-42-google-login
 *
 * Failure output:
 *   MERGE_FAILED=<reason>
 *   CONFLICT_FILES=file1, file2
 *   LOCK_RELEASED=yes
 *   WORKTREE=.maestro/worktrees/task-42
 *   BRANCH=task-42-google-login
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- Argument parsing ---

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node .maestro/bin/merge-safe.cjs <taskId>');
  process.exit(1);
}

const taskId = parseInt(args[0], 10);
if (isNaN(taskId)) {
  console.error(`Error: Invalid task ID "${args[0]}" — must be a number.`);
  process.exit(1);
}

// --- Find .maestro/ by walking up directories ---

function findDevManagerDir(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (true) {
    const candidate = path.join(dir, '.maestro');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) {
      return null;
    }
    dir = parent;
  }
}

const devmanagerDir = findDevManagerDir(process.cwd());
if (!devmanagerDir) {
  console.error('Error: Could not find .maestro/ in current directory or any parent.');
  process.exit(1);
}

const projectRoot = path.dirname(devmanagerDir);
const lockFile = path.join(devmanagerDir, 'merge.lock');
const worktreeRelative = `.maestro/worktrees/task-${taskId}`;
const worktreeAbsolute = path.join(projectRoot, worktreeRelative);

// --- Helper: run git command ---

function git(cmd, cwd) {
  return execSync(cmd, {
    cwd: cwd || projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

// --- Helper: print failure and exit ---

function fail(reason, extraInfo) {
  console.log(`MERGE_FAILED=${reason}`);
  if (extraInfo && extraInfo.conflictFiles) {
    console.log(`CONFLICT_FILES=${extraInfo.conflictFiles}`);
  }
  console.log(`LOCK_RELEASED=yes`);
  console.log(`WORKTREE=${worktreeRelative}`);
  if (extraInfo && extraInfo.branch) {
    console.log(`BRANCH=${extraInfo.branch}`);
  }
  process.exit(1);
}

// --- Helper: get conflict files from git ---

function getConflictFiles(cwd) {
  try {
    const output = git('git diff --name-only --diff-filter=U', cwd);
    return output.split('\n').filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

// --- Helper: sleep ---

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy-wait (simpler than Atomics for a CLI tool)
  }
}

// --- 1. Discover branch name ---

let branchName = '';
try {
  const branchOutput = git(`git branch --list "task-${taskId}-*"`);
  if (!branchOutput) {
    fail('no_branch', {});
  }
  const branches = branchOutput.split('\n').map(b => b.replace(/^[\s*+]+/, '').trim()).filter(Boolean);
  if (branches.length === 0) {
    fail('no_branch', {});
  }
  branchName = branches[0];
} catch (err) {
  fail('no_branch', {});
}

// --- 2. Check worktree exists ---

if (!fs.existsSync(worktreeAbsolute)) {
  fail('no_worktree', { branch: branchName });
}

// --- 3. Acquire lock ---

function acquireLock() {
  const LOCK_TIMEOUT_MS = 60000;
  const LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes
  const POLL_INTERVAL_MS = 2000;

  const startTime = Date.now();

  while (fs.existsSync(lockFile)) {
    // Check if lock is stale (older than 10 minutes)
    try {
      const lockStat = fs.statSync(lockFile);
      const lockAge = Date.now() - lockStat.mtimeMs;
      if (lockAge > LOCK_STALE_MS) {
        const lockContent = fs.readFileSync(lockFile, 'utf-8').trim();
        console.error(`Warning: Stale merge lock (${Math.round(lockAge / 1000)}s old, task ${lockContent}). Taking over.`);
        break; // Take over the stale lock
      }
    } catch {
      break; // Lock disappeared during check — proceed
    }

    // Check if we've waited too long
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

  // Write our lock
  fs.writeFileSync(lockFile, String(taskId), 'utf-8');
}

function releaseLock() {
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch {
    // Best effort — don't fail on cleanup
  }
}

// --- Main execution (try/finally for guaranteed lock release) ---

acquireLock();

try {
  // --- 4. Rebase onto master ---

  try {
    git('git rebase master', worktreeAbsolute);
  } catch (err) {
    // Check if rebase conflict
    const conflictFiles = getConflictFiles(worktreeAbsolute);
    if (conflictFiles) {
      // Abort the rebase so the worktree is clean for retry
      try { git('git rebase --abort', worktreeAbsolute); } catch { /* already aborted */ }
      releaseLock();
      fail('rebase_conflict', { branch: branchName, conflictFiles });
    }
    // Check if "already up to date" or no-op (not actually an error)
    // If git rebase fails for non-conflict reasons, report as git_error
    releaseLock();
    fail('git_error', { branch: branchName });
  }

  // --- 5. Merge into master ---

  try {
    git(`git merge ${branchName} --no-edit`, projectRoot);
  } catch (err) {
    const conflictFiles = getConflictFiles(projectRoot);
    if (conflictFiles) {
      // Abort the merge so master is clean for retry
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
    // Worktree removal can fail if there are untracked files — force it
    try {
      git(`git worktree remove ${worktreeRelative} --force`, projectRoot);
    } catch {
      console.error(`Warning: Could not remove worktree ${worktreeRelative}`);
    }
  }

  try {
    git(`git branch -d ${branchName}`, projectRoot);
  } catch {
    // Branch may already be deleted or not fully merged — try force
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
