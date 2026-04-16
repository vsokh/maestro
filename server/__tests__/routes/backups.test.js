// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFile, mkdtemp, rm, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleBackups } from '../../routes/backups.js';

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
  tmpDir = await mkdtemp(join(tmpdir(), 'backups-test-'));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleBackups', () => {
  it('returns false for non-matching routes', async () => {
    const res = mockRes();
    const result = await handleBackups('GET', '/api/state', mockReq(), res, mockUrl('/api/state'), mockCtx(tmpDir));
    expect(result).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  describe('GET /api/backups', () => {
    it('returns list of backup files', async () => {
      const backupDir = join(tmpDir, '.maestro', 'backups');
      await mkdir(backupDir, { recursive: true });
      await writeFile(join(backupDir, 'state-1000.json'), '{}');
      await writeFile(join(backupDir, 'state-2000.json'), '{}');

      const res = mockRes();
      const result = await handleBackups('GET', '/api/backups', mockReq(), res, mockUrl('/api/backups'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.backups.length).toBe(2);
      // Should be sorted newest first
      expect(body.backups[0].lastModified).toBeGreaterThanOrEqual(body.backups[1].lastModified);
    });

    it('returns empty list when no backups exist', async () => {
      const res = mockRes();
      await handleBackups('GET', '/api/backups', mockReq(), res, mockUrl('/api/backups'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.backups).toEqual([]);
    });

    it('ignores non-state files', async () => {
      const backupDir = join(tmpDir, '.maestro', 'backups');
      await mkdir(backupDir, { recursive: true });
      await writeFile(join(backupDir, 'state-1000.json'), '{}');
      await writeFile(join(backupDir, 'other.txt'), 'nope');

      const res = mockRes();
      await handleBackups('GET', '/api/backups', mockReq(), res, mockUrl('/api/backups'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.backups.length).toBe(1);
    });
  });

  describe('POST /api/backups/snapshot', () => {
    it('creates a backup of state.json', async () => {
      const devDir = join(tmpDir, '.maestro');
      await mkdir(devDir, { recursive: true });
      await writeFile(join(devDir, 'state.json'), JSON.stringify({ project: 'test' }));

      const res = mockRes();
      const result = await handleBackups('POST', '/api/backups/snapshot', mockReq(), res, mockUrl('/api/backups/snapshot'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);
      expect(body.filename).toMatch(/^state-\d+\.json$/);

      // Verify backup file exists
      const backupDir = join(devDir, 'backups');
      const files = await readdir(backupDir);
      expect(files.length).toBe(1);
    });

    it('returns 404 when state.json does not exist', async () => {
      const res = mockRes();
      await handleBackups('POST', '/api/backups/snapshot', mockReq(), res, mockUrl('/api/backups/snapshot'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toContain('No state.json');
    });
  });

  describe('POST /api/backups/restore', () => {
    it('restores a backup', async () => {
      const devDir = join(tmpDir, '.maestro');
      const backupDir = join(devDir, 'backups');
      await mkdir(backupDir, { recursive: true });
      const backupData = { project: 'restored' };
      await writeFile(join(backupDir, 'state-1000.json'), JSON.stringify(backupData));
      await writeFile(join(devDir, 'state.json'), '{}');

      const res = mockRes();
      const req = mockReq([JSON.stringify({ filename: 'state-1000.json' })]);
      const result = await handleBackups('POST', '/api/backups/restore', req, res, mockUrl('/api/backups/restore'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);

      // Verify state.json was overwritten
      const restored = JSON.parse(await readFile(join(devDir, 'state.json'), 'utf-8'));
      expect(restored).toEqual(backupData);
    });

    it('returns 400 when filename is missing', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({})]);
      await handleBackups('POST', '/api/backups/restore', req, res, mockUrl('/api/backups/restore'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('returns 400 for invalid filename (path traversal)', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({ filename: '../secret.json' })]);
      await handleBackups('POST', '/api/backups/restore', req, res, mockUrl('/api/backups/restore'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toBe('Invalid backup filename');
    });

    it('returns 404 when backup file does not exist', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({ filename: 'state-9999.json' })]);
      await handleBackups('POST', '/api/backups/restore', req, res, mockUrl('/api/backups/restore'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });
});
