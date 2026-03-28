#!/usr/bin/env node

/**
 * task-start.cjs — Mark a task as in-progress via progress file
 *
 * Usage:
 *   node .devmanager/bin/task-start.cjs <taskId>
 *
 * What it does:
 *   - Writes to .devmanager/progress/{taskId}.json with status: "in-progress"
 *   - The UI automatically merges this and removes the task from the queue
 *   - Does NOT touch state.json (avoids concurrent write races)
 *
 * Exit codes:
 *   0 = success
 *   1 = error (bad args, write failure)
 */

const fs = require('fs');
const path = require('path');

// --- Argument parsing ---

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node .devmanager/bin/task-start.cjs <taskId>');
  process.exit(1);
}

const taskId = parseInt(args[0], 10);
if (isNaN(taskId)) {
  console.error(`Error: Invalid task ID "${args[0]}" — must be a number.`);
  process.exit(1);
}

// --- Find .devmanager/ by walking up directories ---

function findDevManagerDir(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (true) {
    const candidate = path.join(dir, '.devmanager');
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
  console.error('Error: Could not find .devmanager/ in current directory or any parent.');
  process.exit(1);
}

// --- Write progress file ---

const progressDir = path.join(devmanagerDir, 'progress');
fs.mkdirSync(progressDir, { recursive: true });

const progressFile = path.join(progressDir, `${taskId}.json`);
const progressData = {
  status: 'in-progress',
  startedAt: new Date().toISOString(),
};

try {
  fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2), 'utf-8');
} catch (err) {
  console.error(`Error writing ${progressFile}: ${err.message}`);
  process.exit(1);
}

console.log(`Started: Task ${taskId} marked as in-progress.`);
console.log(`  progress file: ${progressFile}`);
