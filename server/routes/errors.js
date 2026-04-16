import { join } from 'node:path';
import { jsonResponse, readJsonOrNull } from '../middleware.js';

export async function handleErrors(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;

  // GET /api/errors/latest
  if (method === 'GET' && pathname === '/api/errors/latest') {
    const filePath = join(projectPath, '.maestro', 'errors', 'latest.json');
    const result = await readJsonOrNull(filePath);
    if (!result) {
      jsonResponse(res, 404, { error: 'Errors report not found' });
    } else {
      jsonResponse(res, 200, result.data);
    }
    return true;
  }

  // GET /api/errors/history
  if (method === 'GET' && pathname === '/api/errors/history') {
    const filePath = join(projectPath, '.maestro', 'errors', 'history.json');
    const result = await readJsonOrNull(filePath);
    if (!result) {
      jsonResponse(res, 200, []);
    } else {
      jsonResponse(res, 200, result.data);
    }
    return true;
  }

  return false;
}
