import { readFile, writeFile, unlink } from 'node:fs/promises';
import { extname } from 'node:path';
import { jsonResponse, parseBody, ensureDir, matchRoute, handleNotFound, safePath } from '../middleware.js';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

export async function handleAttachments(method, pathname, req, res, url, ctx) {
  const { projectPath } = ctx;
  let params;

  // POST /api/attachments/:taskId
  params = matchRoute(method, pathname, 'POST', '/api/attachments/:taskId');
  if (params) {
    const taskId = params.taskId;
    const filename = url.searchParams.get('name');
    if (!filename) {
      jsonResponse(res, 400, { error: 'Missing ?name= query parameter for filename' });
      return true;
    }
    const ext = '.' + filename.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      jsonResponse(res, 400, { error: 'File type not allowed. Accepted: png, jpg, jpeg, gif, webp, svg' });
      return true;
    }
    const attachDir = safePath(projectPath, '.maestro', 'attachments', taskId);
    if (!attachDir) {
      jsonResponse(res, 400, { error: 'Invalid path' });
      return true;
    }
    await ensureDir(attachDir);
    const buf = await parseBody(req);
    if (buf.length > MAX_UPLOAD_SIZE) {
      jsonResponse(res, 400, { error: 'File too large. Maximum size: 10MB' });
      return true;
    }
    const filePath = safePath(attachDir, filename);
    if (!filePath) {
      jsonResponse(res, 400, { error: 'Invalid filename' });
      return true;
    }
    try {
      await writeFile(filePath, buf);
    } catch (err) {
      jsonResponse(res, 500, { error: 'Failed to save attachment' });
      return true;
    }
    jsonResponse(res, 200, {
      ok: true,
      path: `.maestro/attachments/${taskId}/${filename}`,
    });
    return true;
  }

  // GET /api/attachments/:taskId/:filename
  params = matchRoute(method, pathname, 'GET', '/api/attachments/:taskId/:filename');
  if (params) {
    const filePath = safePath(projectPath, '.maestro', 'attachments', params.taskId, params.filename);
    if (!filePath) {
      jsonResponse(res, 400, { error: 'Invalid path' });
      return true;
    }
    try {
      const content = await readFile(filePath);
      const ext = extname(params.filename).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': content.length,
      });
      res.end(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        jsonResponse(res, 404, { error: 'Attachment not found' });
      } else {
        throw err;
      }
    }
    return true;
  }

  // DELETE /api/attachments/:taskId/:filename
  params = matchRoute(method, pathname, 'DELETE', '/api/attachments/:taskId/:filename');
  if (params) {
    const filePath = safePath(projectPath, '.maestro', 'attachments', params.taskId, params.filename);
    if (!filePath) {
      jsonResponse(res, 400, { error: 'Invalid path' });
      return true;
    }
    try {
      await unlink(filePath);
      jsonResponse(res, 200, { ok: true });
    } catch (err) {
      handleNotFound(res, err, 'Attachment not found');
    }
    return true;
  }

  return false;
}
