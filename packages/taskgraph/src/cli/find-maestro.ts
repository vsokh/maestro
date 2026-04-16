import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Walk up from startDir looking for .maestro/ with state.json.
 * Returns the absolute path to .maestro/ or null.
 */
export function findMaestroDir(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (true) {
    const candidate = path.join(dir, '.maestro');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    // Migrate legacy .dev-manager → .maestro
    const legacy = path.join(dir, '.dev-manager');
    if (fs.existsSync(legacy) && fs.statSync(legacy).isDirectory()) {
      fs.renameSync(legacy, candidate);
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Find .maestro/ or exit with error.
 */
export function requireMaestroDir(): string {
  const dir = findMaestroDir(process.cwd());
  if (!dir) {
    console.error('Error: Could not find .maestro/ in current directory or any parent.');
    process.exit(1);
  }
  return dir;
}
