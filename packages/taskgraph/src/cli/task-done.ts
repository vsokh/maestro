#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { requireDevManagerDir } from './find-devmanager.js';

// --- Argument parsing ---

const args = process.argv.slice(2);

function printUsage(): never {
  console.error('Usage: node .devmanager/bin/task-done.cjs <taskId> --commit <commitRef>');
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

let commitRef: string | null = null;
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

const devmanagerDir = requireDevManagerDir();

// --- Write progress file ---

const progressDir = path.join(devmanagerDir, 'progress');
fs.mkdirSync(progressDir, { recursive: true });

const progressFile = path.join(progressDir, `${taskId}.json`);
const today = new Date().toISOString().split('T')[0];

const progressData = {
  status: 'done',
  completedAt: today,
  commitRef,
};

try {
  fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2), 'utf-8');
} catch (err: any) {
  console.error(`Error writing ${progressFile}: ${err.message}`);
  process.exit(1);
}

console.log(`Done: Task ${taskId} marked as done.`);
console.log(`  completedAt: ${today}`);
console.log(`  commitRef: ${commitRef}`);
console.log(`  progress file: ${progressFile}`);
