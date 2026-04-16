import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { jsonResponse, readJsonOrNull } from '../middleware.js';

/** Parse CHANGELOG.md into version sections */
function parseChangelog(content) {
  const sections = [];
  let current = null;

  for (const line of content.split('\n')) {
    // Match version headers: ## [v0.4.0] — 2026-03-15  or  ## [Unreleased]
    const vMatch = line.match(/^## \[([^\]]+)\](?:\s*[—–-]\s*(.+))?/);
    if (vMatch) {
      if (current) sections.push(current);
      current = { version: vMatch[1], date: (vMatch[2] || '').trim(), groups: [], currentGroup: null };
      continue;
    }
    if (!current) continue;

    // Match group headers: ### Added, ### Fixed, etc.
    const gMatch = line.match(/^### (.+)/);
    if (gMatch) {
      current.currentGroup = { name: gMatch[1].trim(), items: [] };
      current.groups.push(current.currentGroup);
      continue;
    }

    // Match list items: - something
    const iMatch = line.match(/^[-*]\s+(.+)/);
    if (iMatch && current.currentGroup) {
      current.currentGroup.items.push(iMatch[1].trim());
    }
  }
  if (current) sections.push(current);

  // Clean up internal state
  return sections.map(({ currentGroup: _, ...s }) => s);
}

export async function handleRelease(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;

  // GET /api/release/releases
  if (method === 'GET' && pathname === '/api/release/releases') {
    const filePath = join(projectPath, '.maestro', 'release', 'releases.json');
    const result = await readJsonOrNull(filePath);
    jsonResponse(res, 200, result ? result.data : []);
    return true;
  }

  // GET /api/release/stability
  if (method === 'GET' && pathname === '/api/release/stability') {
    const filePath = join(projectPath, '.maestro', 'release', 'stability.json');
    const result = await readJsonOrNull(filePath);
    jsonResponse(res, 200, result ? result.data : null);
    return true;
  }

  // GET /api/release/changelog
  if (method === 'GET' && pathname === '/api/release/changelog') {
    const filePath = join(projectPath, 'CHANGELOG.md');
    try {
      const content = await readFile(filePath, 'utf-8');
      const sections = parseChangelog(content);
      jsonResponse(res, 200, { sections });
    } catch {
      jsonResponse(res, 200, { sections: [] });
    }
    return true;
  }

  return false;
}
