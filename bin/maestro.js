#!/usr/bin/env node

import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

async function main() {
  const args = process.argv.slice(2);

  const projectArgs = [];
  let port = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port)) {
        console.error('Error: --port must be a number');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else if (!args[i].startsWith('-')) {
      projectArgs.push(args[i]);
    }
  }

  if (projectArgs.length === 0) {
    printUsage();
    process.exit(1);
  }

  // Validate all project directories
  const projectPaths = [];
  for (const arg of projectArgs) {
    const projectPath = resolve(arg);
    try {
      const s = await stat(projectPath);
      if (!s.isDirectory()) {
        console.error(`Error: "${projectPath}" is not a directory`);
        process.exit(1);
      }
      projectPaths.push(projectPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`Error: directory not found: "${projectPath}"`);
      } else {
        console.error(`Error: cannot access "${projectPath}": ${err.message}`);
      }
      process.exit(1);
    }
  }

  if (port) {
    process.env.PORT = String(port);
  }

  const { startServer } = await import('../server/index.js');
  startServer(projectPaths);
}

function printUsage() {
  console.log('');
  console.log('Usage: maestro <project-path> [project-path2 ...] [options]');
  console.log('');
  console.log('Options:');
  console.log('  --port <number>   Port to listen on (default: 4545)');
  console.log('  --help, -h        Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  maestro ./my-project');
  console.log('  maestro ./project-a ./project-b ./project-c');
  console.log('  maestro . --port 8080');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
