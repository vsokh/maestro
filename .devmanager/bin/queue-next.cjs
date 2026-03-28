#!/usr/bin/env node

/**
 * queue-next.cjs — Print the next queued task as key=value pairs
 *
 * Usage:
 *   node .devmanager/bin/queue-next.cjs
 *
 * Output format (key=value, one per line — easy for LLMs to parse):
 *   TASK_ID=42
 *   TASK_NAME=Add Google login
 *   TASK_FULL=Add Google OAuth login with session persistence
 *   TASK_GROUP=Auth
 *   NOTES=Use the existing auth middleware. Skip email login for now.
 *   HAS_BRANCH=yes
 *   BRANCH=task-42-google-login
 *   HAS_WORKTREE=yes
 *   HAS_NOTES=yes
 *   QUEUE_REMAINING=3
 *
 * If queue is empty:
 *   QUEUE_EMPTY=true
 *
 * Exit codes:
 *   0 = success (including empty queue)
 *   1 = error (state.json not found, parse error, etc.)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- Find state.json by walking up directories ---

function findDevManagerDir(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (true) {
    const candidate = path.join(dir, '.devmanager');
    if (fs.existsSync(path.join(candidate, 'state.json'))) {
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
  console.error('Error: Could not find .devmanager/state.json in current directory or any parent.');
  process.exit(1);
}

const stateFile = path.join(devmanagerDir, 'state.json');
const projectRoot = path.dirname(devmanagerDir);

// --- Read state ---

let raw;
try {
  raw = fs.readFileSync(stateFile, 'utf-8');
} catch (err) {
  console.error(`Error reading ${stateFile}: ${err.message}`);
  process.exit(1);
}

let state;
try {
  state = JSON.parse(raw);
} catch (err) {
  console.error(`Error parsing ${stateFile}: ${err.message}`);
  process.exit(1);
}

// --- Check queue ---

if (!Array.isArray(state.queue) || state.queue.length === 0) {
  console.log('QUEUE_EMPTY=true');
  process.exit(0);
}

const queueItem = state.queue[0];
const taskId = queueItem.task;

// Find the task object for additional details
const task = Array.isArray(state.tasks)
  ? state.tasks.find(t => t.id === taskId)
  : null;

// --- Output task details ---

console.log(`TASK_ID=${taskId}`);
console.log(`TASK_NAME=${task ? task.name : queueItem.taskName || ''}`);
console.log(`TASK_FULL=${task && task.fullName ? task.fullName : (task ? task.name : queueItem.taskName || '')}`);
console.log(`TASK_GROUP=${task && task.group ? task.group : ''}`);

// Notes from queue item (manager instructions) — join multiline to single line
const notes = queueItem.notes || '';
const notesOneLine = notes.replace(/\r?\n/g, '\\n');
console.log(`NOTES=${notesOneLine}`);

// --- Resume detection ---

// Check for .devmanager/notes/{taskId}.md
const notesFile = path.join(devmanagerDir, 'notes', `${taskId}.md`);
const hasNotes = fs.existsSync(notesFile);
console.log(`HAS_NOTES=${hasNotes ? 'yes' : 'no'}`);

// Check for git branch matching task-{taskId}-*
let hasBranch = false;
let branchName = '';
try {
  const branchOutput = execSync(`git branch --list "task-${taskId}-*"`, {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  if (branchOutput) {
    // git branch --list prefixes with "  " or "* " — clean it
    const branches = branchOutput.split('\n').map(b => b.replace(/^[\s*]+/, '').trim()).filter(Boolean);
    if (branches.length > 0) {
      hasBranch = true;
      branchName = branches[0];
    }
  }
} catch {
  // git not available or not a git repo — that's fine
}
console.log(`HAS_BRANCH=${hasBranch ? 'yes' : 'no'}`);
if (hasBranch) {
  console.log(`BRANCH=${branchName}`);
}

// Check for worktree directory
const worktreeDir = path.join(devmanagerDir, 'worktrees', `task-${taskId}`);
const hasWorktree = fs.existsSync(worktreeDir);
console.log(`HAS_WORKTREE=${hasWorktree ? 'yes' : 'no'}`);

// Check for auto-approve flag
if (task && task.autoApprove) {
  console.log('AUTO_APPROVE=yes');
}

// Queue remaining (including current)
console.log(`QUEUE_REMAINING=${state.queue.length}`);
