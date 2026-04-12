#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { requireDevManagerDir } from './find-devmanager.js';

const devmanagerDir = requireDevManagerDir();
const stateFile = path.join(devmanagerDir, 'state.json');
const projectRoot = path.dirname(devmanagerDir);

// --- Read state ---

let raw: string;
try {
  raw = fs.readFileSync(stateFile, 'utf-8');
} catch (err: any) {
  console.error(`Error reading ${stateFile}: ${err.message}`);
  process.exit(1);
}

let state: any;
try {
  state = JSON.parse(raw);
} catch (err: any) {
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

const task = Array.isArray(state.tasks)
  ? state.tasks.find((t: any) => t.id === taskId)
  : null;

// --- Output task details ---

console.log(`TASK_ID=${taskId}`);
console.log(`TASK_NAME=${task ? task.name : queueItem.taskName || ''}`);
console.log(`TASK_FULL=${task && task.fullName ? task.fullName : (task ? task.name : queueItem.taskName || '')}`);
console.log(`TASK_GROUP=${task && task.group ? task.group : ''}`);

const notes: string = queueItem.notes || '';
const notesOneLine = notes.replace(/\r?\n/g, '\\n');
console.log(`NOTES=${notesOneLine}`);

// --- Resume detection ---

const notesFile = path.join(devmanagerDir, 'notes', `${taskId}.md`);
const hasNotes = fs.existsSync(notesFile);
console.log(`HAS_NOTES=${hasNotes ? 'yes' : 'no'}`);

let hasBranch = false;
let branchName = '';
try {
  const branchOutput = execSync(`git branch --list "task-${taskId}-*"`, {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  if (branchOutput) {
    const branches = branchOutput.split('\n').map(b => b.replace(/^[\s*]+/, '').trim()).filter(Boolean);
    if (branches.length > 0) {
      hasBranch = true;
      branchName = branches[0];
    }
  }
} catch {
  // git not available or not a git repo
}
console.log(`HAS_BRANCH=${hasBranch ? 'yes' : 'no'}`);
if (hasBranch) {
  console.log(`BRANCH=${branchName}`);
}

const worktreeDir = path.join(devmanagerDir, 'worktrees', `task-${taskId}`);
const hasWorktree = fs.existsSync(worktreeDir);
console.log(`HAS_WORKTREE=${hasWorktree ? 'yes' : 'no'}`);

if (task && task.autoApprove) {
  console.log('AUTO_APPROVE=yes');
}

console.log(`QUEUE_REMAINING=${state.queue.length}`);
