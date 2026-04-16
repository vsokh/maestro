// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFile, mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleState } from '../../routes/state.js';

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
    getProjects: vi.fn(() => []),
    switchProject: vi.fn(),
  };
}

let tmpDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'state-test-'));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleState', () => {
  it('returns false for non-matching routes', async () => {
    const res = mockRes();
    const result = await handleState('GET', '/api/skills', mockReq(), res, mockUrl('/api/skills'), mockCtx(tmpDir));
    expect(result).toBeFalsy();
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  describe('GET /api/state', () => {
    it('returns state data when file exists', async () => {
      const devDir = join(tmpDir, '.maestro');
      await mkdir(devDir, { recursive: true });
      const stateData = { project: 'test', tasks: [] };
      await writeFile(join(devDir, 'state.json'), JSON.stringify(stateData));

      const res = mockRes();
      const result = await handleState('GET', '/api/state', mockReq(), res, mockUrl('/api/state'), mockCtx(tmpDir));
      expect(result).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.data).toEqual(stateData);
      expect(body.lastModified).toBeDefined();
    });

    it('returns 404 when state file does not exist', async () => {
      const res = mockRes();
      await handleState('GET', '/api/state', mockReq(), res, mockUrl('/api/state'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });

  describe('PUT /api/state', () => {
    it('writes state data and returns lastModified', async () => {
      const res = mockRes();
      const stateData = { project: 'test', tasks: [{ id: 1, name: 'Test task', status: 'pending' }] };
      const req = mockReq([JSON.stringify(stateData)]);
      const result = await handleState('PUT', '/api/state', req, res, mockUrl('/api/state'), mockCtx(tmpDir));
      expect(result).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
      expect(body.lastModified).toBeDefined();

      // Verify file was written with incremented _v
      const written = JSON.parse(await readFile(join(tmpDir, '.maestro', 'state.json'), 'utf-8'));
      expect(written._v).toBe(1);
      expect(written.project).toBe('test');
    });

    it('returns 409 when file on disk is newer (concurrency conflict)', async () => {
      const devDir = join(tmpDir, '.maestro');
      await mkdir(devDir, { recursive: true });
      const statePath = join(devDir, 'state.json');
      const currentData = { project: 'test', tasks: [] };
      await writeFile(statePath, JSON.stringify(currentData));

      const res = mockRes();
      // Send a very old lastModified to trigger conflict
      const req = mockReq([JSON.stringify({ project: 'new', tasks: [], _lastModified: 1000 })]);
      await handleState('PUT', '/api/state', req, res, mockUrl('/api/state'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toContain('Conflict');
    });
  });

  describe('GET /api/progress', () => {
    it('returns progress entries', async () => {
      const progDir = join(tmpDir, '.maestro', 'progress');
      await mkdir(progDir, { recursive: true });
      await writeFile(join(progDir, '1.json'), JSON.stringify({ status: 'done' }));
      await writeFile(join(progDir, '2.json'), JSON.stringify({ status: 'in-progress' }));

      const res = mockRes();
      const result = await handleState('GET', '/api/progress', mockReq(), res, mockUrl('/api/progress'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body['1']).toEqual({ status: 'done' });
      expect(body['2']).toEqual({ status: 'in-progress' });
    });

    it('returns empty object when progress dir does not exist', async () => {
      const res = mockRes();
      await handleState('GET', '/api/progress', mockReq(), res, mockUrl('/api/progress'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual({});
    });
  });

  describe('DELETE /api/progress/:taskId — path traversal', () => {
    it('rejects path traversal in taskId', async () => {
      const res = mockRes();
      // Need enough ../ to escape projectPath: .maestro/progress/../../../../x.json
      const traversal = '..%2F..%2F..%2F..%2Fetc';
      await handleState('DELETE', `/api/progress/${traversal}`, mockReq(), res, mockUrl(`/api/progress/${traversal}`), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid path');
    });
  });

  describe('DELETE /api/progress/:taskId', () => {
    it('deletes a progress file', async () => {
      const progDir = join(tmpDir, '.maestro', 'progress');
      await mkdir(progDir, { recursive: true });
      await writeFile(join(progDir, '42.json'), '{}');

      const res = mockRes();
      const result = await handleState('DELETE', '/api/progress/42', mockReq(), res, mockUrl('/api/progress/42'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
    });

    it('returns 404 for nonexistent progress file', async () => {
      const res = mockRes();
      await handleState('DELETE', '/api/progress/999', mockReq(), res, mockUrl('/api/progress/999'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });
});
