import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Walk up from startDir looking for .devmanager/ with state.json.
 * Returns the absolute path to .devmanager/ or null.
 */
export function findDevManagerDir(startDir: string): string | null {
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

/**
 * Find .devmanager/ or exit with error.
 */
export function requireDevManagerDir(): string {
  const dir = findDevManagerDir(process.cwd());
  if (!dir) {
    console.error('Error: Could not find .devmanager/ in current directory or any parent.');
    process.exit(1);
  }
  return dir;
}
