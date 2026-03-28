// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../../dialogs.js', () => ({
  openNativeFolderDialog: vi.fn(),
}));

import { handleProjects } from '../../routes/projects.js';
import { openNativeFolderDialog } from '../../dialogs.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

function mockReq(chunks = []) {
  const emitter = new EventEmitter();
  process.nextTick(() => {
    for (const chunk of chunks) emitter.emit('data', Buffer.from(chunk));
    emitter.emit('end');
  });
  return emitter;
}

function mockUrl(path) {
  return new URL(path, 'http://localhost');
}

function mockCtx(projectPath) {
  return {
    projectPath,
    getProjects: vi.fn(() => [{ name: 'proj-a', path: '/a' }]),
    switchProject: vi.fn(),
  };
}

let tmpDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'projects-test-'));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleProjects', () => {
  it('returns false for non-matching routes', async () => {
    const res = mockRes();
    const result = await handleProjects('GET', '/api/state', mockReq(), res, mockUrl('/api/state'), mockCtx(tmpDir));
    expect(result).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  describe('GET /api/projects', () => {
    it('returns the list of projects', async () => {
      const res = mockRes();
      const ctx = mockCtx(tmpDir);
      const result = await handleProjects('GET', '/api/projects', mockReq(), res, mockUrl('/api/projects'), ctx);
      expect(result).toBe(true);
      expect(ctx.getProjects).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual([{ name: 'proj-a', path: '/a' }]);
    });
  });

  describe('POST /api/browse/native', () => {
    it('returns selected path from native dialog', async () => {
      openNativeFolderDialog.mockResolvedValueOnce('/some/path');
      const res = mockRes();
      const result = await handleProjects('POST', '/api/browse/native', mockReq(), res, mockUrl('/api/browse/native'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual({ path: '/some/path' });
    });

    it('returns cancelled when dialog is cancelled', async () => {
      openNativeFolderDialog.mockResolvedValueOnce(null);
      const res = mockRes();
      await handleProjects('POST', '/api/browse/native', mockReq(), res, mockUrl('/api/browse/native'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual({ path: null, cancelled: true });
    });

    it('returns 500 on dialog error', async () => {
      openNativeFolderDialog.mockRejectedValueOnce(new Error('dialog failed'));
      const res = mockRes();
      await handleProjects('POST', '/api/browse/native', mockReq(), res, mockUrl('/api/browse/native'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('dialog failed');
    });
  });

  describe('GET /api/browse', () => {
    it('lists directories in the given path', async () => {
      // Create test dirs
      await mkdir(join(tmpDir, 'subdir'));
      await mkdir(join(tmpDir, 'subdir', '.git'));
      await mkdir(join(tmpDir, 'other'));

      const res = mockRes();
      const url = mockUrl(`/api/browse?path=${encodeURIComponent(tmpDir)}`);
      const result = await handleProjects('GET', '/api/browse', mockReq(), res, url, mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.current).toBe(tmpDir);
      expect(body.dirs.length).toBeGreaterThanOrEqual(2);
      const subdir = body.dirs.find(d => d.name === 'subdir');
      expect(subdir).toBeDefined();
      expect(subdir.isProject).toBe(true);
    });

    it('returns 403 for path outside home directory', async () => {
      const res = mockRes();
      const url = mockUrl('/api/browse?path=/nonexistent_path_12345');
      await handleProjects('GET', '/api/browse', mockReq(), res, url, mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Path outside home directory');
    });
  });

  describe('PUT /api/project', () => {
    it('switches project to a valid directory', async () => {
      const ctx = mockCtx(tmpDir);
      const res = mockRes();
      const req = mockReq([JSON.stringify({ path: tmpDir })]);
      const result = await handleProjects('PUT', '/api/project', req, res, mockUrl('/api/project'), ctx);
      expect(result).toBe(true);
      expect(ctx.switchProject).toHaveBeenCalled();
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
    });

    it('returns 400 when path is missing', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({})]);
      await handleProjects('PUT', '/api/project', req, res, mockUrl('/api/project'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Missing path');
    });

    it('returns 400 when directory does not exist', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({ path: '/nonexistent_dir_12345' })]);
      await handleProjects('PUT', '/api/project', req, res, mockUrl('/api/project'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Directory not found');
    });
  });

  describe('GET /api/info', () => {
    it('returns project path and name', async () => {
      const res = mockRes();
      const result = await handleProjects('GET', '/api/info', mockReq(), res, mockUrl('/api/info'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.projectPath).toBe(tmpDir);
      expect(body.projectName).toBeDefined();
    });
  });
});
