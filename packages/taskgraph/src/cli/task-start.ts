#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { requireDevManagerDir } from './find-devmanager.js';

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

const devmanagerDir = requireDevManagerDir();

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
} catch (err: any) {
  console.error(`Error writing ${progressFile}: ${err.message}`);
  process.exit(1);
}

console.log(`Started: Task ${taskId} marked as in-progress.`);
console.log(`  progress file: ${progressFile}`);
