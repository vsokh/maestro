// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleQuality } from '../../routes/quality.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
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
  tmpDir = await mkdtemp(join(tmpdir(), 'quality-test-'));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleQuality', () => {
  it('returns false for non-matching routes', async () => {
    const res = mockRes();
    const result = await handleQuality('GET', '/api/state', {}, res, mockUrl('/api/state'), mockCtx(tmpDir));
    expect(result).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  describe('GET /api/quality/latest', () => {
    it('returns quality report when it exists', async () => {
      const qualityDir = join(tmpDir, '.maestro', 'quality');
      await mkdir(qualityDir, { recursive: true });
      const report = { score: 85, dimensions: {} };
      await writeFile(join(qualityDir, 'latest.json'), JSON.stringify(report));

      const res = mockRes();
      const result = await handleQuality('GET', '/api/quality/latest', {}, res, mockUrl('/api/quality/latest'), mockCtx(tmpDir));
      expect(result).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual(report);
    });

    it('returns 404 when quality report does not exist', async () => {
      const res = mockRes();
      await handleQuality('GET', '/api/quality/latest', {}, res, mockUrl('/api/quality/latest'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Quality report not found');
    });
  });

  describe('GET /api/quality/history', () => {
    it('returns quality history when it exists', async () => {
      const qualityDir = join(tmpDir, '.maestro', 'quality');
      await mkdir(qualityDir, { recursive: true });
      const history = [{ date: '2026-01-01', score: 80 }];
      await writeFile(join(qualityDir, 'history.json'), JSON.stringify(history));

      const res = mockRes();
      const result = await handleQuality('GET', '/api/quality/history', {}, res, mockUrl('/api/quality/history'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual(history);
    });

    it('returns 404 when quality history does not exist', async () => {
      const res = mockRes();
      await handleQuality('GET', '/api/quality/history', {}, res, mockUrl('/api/quality/history'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Quality history not found');
    });
  });
});
