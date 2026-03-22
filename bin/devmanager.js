#!/usr/bin/env node

import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let projectArg = null;
  let port = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port)) {
        console.error('Error: --port must be a number');
        process.exit(1);
      }
      i++; // skip next arg
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else if (!args[i].startsWith('-')) {
      projectArg = args[i];
    }
  }

  if (!projectArg) {
    printUsage();
    process.exit(1);
  }

  const projectPath = resolve(projectArg);

  // Validate directory exists
  try {
    const s = await stat(projectPath);
    if (!s.isDirectory()) {
      console.error(`Error: "${projectPath}" is not a directory`);
      process.exit(1);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Error: directory not found: "${projectPath}"`);
    } else {
      console.error(`Error: cannot access "${projectPath}": ${err.message}`);
    }
    process.exit(1);
  }

  // Set port if provided
  if (port) {
    process.env.PORT = String(port);
  }

  // Start server
  const { startServer } = await import('../server/index.js');
  startServer(projectPath);
}

function printUsage() {
  console.log('');
  console.log('Usage: devmanager <project-path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --port <number>   Port to listen on (default: 4545)');
  console.log('  --help, -h        Show this help message');
  console.log('');
  console.log('Example:');
  console.log('  devmanager ./my-project');
  console.log('  devmanager /home/user/projects/app --port 8080');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
