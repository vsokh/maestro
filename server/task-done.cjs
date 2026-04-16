#!/usr/bin/env node

/**
 * task-done.cjs — Mark a task as done via progress file
 *
 * Usage:
 *   node .maestro/bin/task-done.cjs <taskId> --commit <commitRef>
 *
 * What it does:
 *   - Writes to .maestro/progress/{taskId}.json with status: "done"
 *   - The UI automatically merges this, removes task from queue, and adds activity
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

function printUsage() {
  console.error('Usage: node .maestro/bin/task-done.cjs <taskId> --commit <commitRef>');
  console.error('');
  console.error('Options:');
  console.error('  --commit <ref>   Git commit hash (required)');
  process.exit(1);
}

if (args.length === 0) {
  printUsage();
}

const taskId = parseInt(args[0], 10);
if (isNaN(taskId)) {
  console.error(`Error: Invalid task ID "${args[0]}" — must be a number.`);
  process.exit(1);
}

let commitRef = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--commit' && args[i + 1]) {
    commitRef = args[i + 1];
    i++;
  }
}

if (!commitRef) {
  console.error('Error: --commit <ref> is required.');
  printUsage();
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

// --- Write progress file ---

const progressDir = path.join(devmanagerDir, 'progress');
fs.mkdirSync(progressDir, { recursive: true });

const progressFile = path.join(progressDir, `${taskId}.json`);
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const progressData = {
  status: 'done',
  completedAt: today,
  commitRef: commitRef,
};

try {
  fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2), 'utf-8');
} catch (err) {
  console.error(`Error writing ${progressFile}: ${err.message}`);
  process.exit(1);
}

console.log(`Done: Task ${taskId} marked as done.`);
console.log(`  completedAt: ${today}`);
console.log(`  commitRef: ${commitRef}`);
console.log(`  progress file: ${progressFile}`);
