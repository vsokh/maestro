// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:child_process and node:os before importing the module
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:os', () => ({
  platform: vi.fn(),
  homedir: vi.fn(() => '/home/user'),
}));

const { execFile } = await import('node:child_process');
const { platform } = await import('node:os');
const { openNativeFolderDialog } = await import('../dialogs.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openNativeFolderDialog', () => {
  describe('win32', () => {
    beforeEach(() => {
      platform.mockReturnValue('win32');
    });

    it('returns selected path on success', async () => {
      execFile.mockImplementation((_cmd, _args, _opts, cb) => {
        cb(null, 'C:\\Users\\test\\project\r\n');
      });

      const result = await openNativeFolderDialog();
      expect(result).toBe('C:\\Users\\test\\project');
      expect(execFile).toHaveBeenCalledWith(
        'powershell',
        expect.arrayContaining(['-NoProfile', '-STA', '-Command']),
        expect.objectContaining({ timeout: 60000 }),
        expect.any(Function),
      );
    });

    it('returns null on empty output', async () => {
      execFile.mockImplementation((_cmd, _args, _opts, cb) => {
        cb(null, '  \n');
      });

      const result = await openNativeFolderDialog();
      expect(result).toBeNull();
    });

    it('rejects on error', async () => {
      const error = new Error('powershell failed');
      execFile.mockImplementation((_cmd, _args, _opts, cb) => {
        cb(error);
      });

      await expect(openNativeFolderDialog()).rejects.toThrow('powershell failed');
    });
  });

  describe('darwin', () => {
    beforeEach(() => {
      platform.mockReturnValue('darwin');
    });

    it('returns selected path on success', async () => {
      execFile.mockImplementation((_cmd, _args, _opts, cb) => {
        cb(null, '/Users/test/project\n');
      });

      const result = await openNativeFolderDialog();
      expect(result).toBe('/Users/test/project');
      expect(execFile).toHaveBeenCalledWith(
        'bash',
        expect.any(Array),
        expect.objectContaining({ timeout: 60000 }),
        expect.any(Function),
      );
    });

    it('returns null when user cancels (error)', async () => {
      execFile.mockImplementation((_cmd, _args, _opts, cb) => {
        cb(new Error('cancelled'));
      });

      const result = await openNativeFolderDialog();
      expect(result).toBeNull();
    });
  });

  describe('linux', () => {
    beforeEach(() => {
      platform.mockReturnValue('linux');
    });

    it('returns path from zenity on success', async () => {
      execFile.mockImplementation((cmd, _args, _opts, cb) => {
        if (cmd === 'zenity') cb(null, '/home/user/project\n');
      });

      const result = await openNativeFolderDialog();
      expect(result).toBe('/home/user/project');
    });

    it('falls back to kdialog when zenity fails', async () => {
      execFile.mockImplementation((cmd, _args, _opts, cb) => {
        if (cmd === 'zenity') cb(new Error('not found'));
        if (cmd === 'kdialog') cb(null, '/home/user/project\n');
      });

      const result = await openNativeFolderDialog();
      expect(result).toBe('/home/user/project');
      expect(execFile).toHaveBeenCalledTimes(2);
    });

    it('returns null when both zenity and kdialog fail', async () => {
      execFile.mockImplementation((cmd, _args, _opts, cb) => {
        if (cmd === 'zenity') cb(new Error('not found'));
        if (cmd === 'kdialog') cb(new Error('not found'));
      });

      const result = await openNativeFolderDialog();
      expect(result).toBeNull();
    });
  });
});
