/**
 * Bundle CLI scripts into standalone CJS files for deployment to .maestro/bin/
 * These scripts must be self-contained (no require('taskgraph') at runtime).
 */
import * as esbuild from 'esbuild';

const entries = [
  'src/cli/queue-next.ts',
  'src/cli/task-start.ts',
  'src/cli/task-done.ts',
  'src/cli/merge-safe.ts',
];

await esbuild.build({
  entryPoints: entries,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outdir: 'dist/cli',
  outExtension: { '.js': '.cjs' },
  banner: { js: '#!/usr/bin/env node' },
});

console.log('CLI scripts bundled to dist/cli/*.cjs');
