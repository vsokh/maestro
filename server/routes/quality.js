import { join } from 'node:path';
import { jsonResponse, readJsonOrNull } from '../middleware.js';

export async function handleQuality(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;

  // GET /api/quality/latest
  if (method === 'GET' && pathname === '/api/quality/latest') {
    const filePath = join(projectPath, '.maestro', 'quality', 'latest.json');
    const result = await readJsonOrNull(filePath);
    if (!result) {
      jsonResponse(res, 404, { error: 'Quality report not found' });
    } else {
      jsonResponse(res, 200, result.data);
    }
    return true;
  }

  // GET /api/quality/history
  if (method === 'GET' && pathname === '/api/quality/history') {
    const filePath = join(projectPath, '.maestro', 'quality', 'history.json');
    const result = await readJsonOrNull(filePath);
    if (!result) {
      jsonResponse(res, 404, { error: 'Quality history not found' });
    } else {
      jsonResponse(res, 200, result.data);
    }
    return true;
  }

  return false;
}
