// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFile, mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleAttachments } from '../../routes/attachments.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

function mockReq(chunks = []) {
  const emitter = new EventEmitter();
  // Use setTimeout to defer data emission — matchRoute runs synchronously before
  // parseBody attaches listeners, so nextTick fires too early for POST routes
  // that use matchRoute before reading the body.
  setTimeout(() => {
    for (const chunk of chunks) emitter.emit('data', Buffer.from(chunk));
    emitter.emit('end');
  }, 5);
  return emitter;
}

function mockUrl(path) {
  return new URL(path, 'http://localhost');
}

function mockCtx(projectPath) {
  return {
    projectPath,
    getProjects: vi.fn(() => []),
    switchProject: vi.fn(),
  };
}

let tmpDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'attachments-test-'));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAttachments', () => {
  it('returns false for non-matching routes', async () => {
    const res = mockRes();
    const result = await handleAttachments('GET', '/api/state', mockReq(), res, mockUrl('/api/state'), mockCtx(tmpDir));
    expect(result).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  describe('POST /api/attachments/:taskId', () => {
    it('uploads an attachment', async () => {
      const res = mockRes();
      const req = mockReq(['file content here']);
      const url = mockUrl('/api/attachments/5?name=test.png');
      const result = await handleAttachments('POST', '/api/attachments/5', req, res, url, mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
      expect(body.path).toBe('.maestro/attachments/5/test.png');

      // Verify file was written
      const content = await readFile(join(tmpDir, '.maestro', 'attachments', '5', 'test.png'));
      expect(content.toString()).toBe('file content here');
    });

    it('returns 400 when filename is missing', async () => {
      const res = mockRes();
      const req = mockReq(['data']);
      const url = mockUrl('/api/attachments/5');
      await handleAttachments('POST', '/api/attachments/5', req, res, url, mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toContain('Missing');
    });
  });

  describe('GET /api/attachments/:taskId/:filename', () => {
    it('serves an attachment with correct MIME type', async () => {
      const attachDir = join(tmpDir, '.maestro', 'attachments', '5');
      await mkdir(attachDir, { recursive: true });
      await writeFile(join(attachDir, 'image.png'), Buffer.from('PNG data'));

      const res = mockRes();
      const result = await handleAttachments('GET', '/api/attachments/5/image.png', mockReq(), res, mockUrl('/api/attachments/5/image.png'), mockCtx(tmpDir));
      expect(result).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'image/png',
      }));
    });

    it('uses application/octet-stream for unknown extensions', async () => {
      const attachDir = join(tmpDir, '.maestro', 'attachments', '5');
      await mkdir(attachDir, { recursive: true });
      await writeFile(join(attachDir, 'file.xyz'), 'data');

      const res = mockRes();
      await handleAttachments('GET', '/api/attachments/5/file.xyz', mockReq(), res, mockUrl('/api/attachments/5/file.xyz'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/octet-stream',
      }));
    });

    it('returns 404 for nonexistent attachment', async () => {
      const res = mockRes();
      await handleAttachments('GET', '/api/attachments/5/nope.txt', mockReq(), res, mockUrl('/api/attachments/5/nope.txt'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Attachment not found');
    });
  });

  describe('path traversal protection', () => {
    // matchRoute decodes URL params, so ..%2F becomes ../
    // Paths are resolved under projectPath, so we need enough ../
    // to escape: projectPath/.maestro/attachments/<taskId> needs 3+ levels

    it('rejects path traversal in taskId for POST', async () => {
      const res = mockRes();
      const req = mockReq(['file content']);
      // Use enough ../ to escape projectPath: .maestro/attachments/../../../../x
      const traversal = '..%2F..%2F..%2F..%2Fetc';
      const url = mockUrl(`/api/attachments/${traversal}?name=evil.png`);
      await handleAttachments('POST', `/api/attachments/${traversal}`, req, res, url, mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid path');
    });

    it('rejects path traversal in filename for POST', async () => {
      const res = mockRes();
      const req = mockReq(['file content']);
      // filename is resolved under attachDir, so ../../../../.. escapes projectPath
      const url = mockUrl('/api/attachments/5?name=..%2F..%2F..%2F..%2F..%2Fetc%2Fevil.png');
      await handleAttachments('POST', '/api/attachments/5', req, res, url, mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid filename');
    });

    it('rejects path traversal in taskId for GET', async () => {
      const res = mockRes();
      const traversal = '..%2F..%2F..%2F..%2Fetc';
      await handleAttachments('GET', `/api/attachments/${traversal}/passwd`, mockReq(), res, mockUrl(`/api/attachments/${traversal}/passwd`), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid path');
    });

    it('rejects path traversal in filename for GET', async () => {
      const res = mockRes();
      const traversal = '..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd';
      await handleAttachments('GET', `/api/attachments/5/${traversal}`, mockReq(), res, mockUrl(`/api/attachments/5/${traversal}`), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid path');
    });

    it('rejects path traversal in taskId for DELETE', async () => {
      const res = mockRes();
      const traversal = '..%2F..%2F..%2F..%2Fetc';
      await handleAttachments('DELETE', `/api/attachments/${traversal}/passwd`, mockReq(), res, mockUrl(`/api/attachments/${traversal}/passwd`), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid path');
    });
  });

  describe('DELETE /api/attachments/:taskId/:filename', () => {
    it('deletes an attachment', async () => {
      const attachDir = join(tmpDir, '.maestro', 'attachments', '5');
      await mkdir(attachDir, { recursive: true });
      await writeFile(join(attachDir, 'file.txt'), 'data');

      const res = mockRes();
      const result = await handleAttachments('DELETE', '/api/attachments/5/file.txt', mockReq(), res, mockUrl('/api/attachments/5/file.txt'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
    });

    it('returns 404 for nonexistent attachment', async () => {
      const res = mockRes();
      await handleAttachments('DELETE', '/api/attachments/5/nope.txt', mockReq(), res, mockUrl('/api/attachments/5/nope.txt'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });
});
