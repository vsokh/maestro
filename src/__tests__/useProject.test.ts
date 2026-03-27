import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api module to prevent real fetch calls
vi.mock('../api.ts', () => ({
  default: {
    getInfo: vi.fn().mockRejectedValue(new Error('not connected')),
    launch: vi.fn().mockResolvedValue({ pid: 1 }),
    launchTerminal: vi.fn().mockResolvedValue({ ok: true }),
    listProcesses: vi.fn().mockResolvedValue([]),
    getBufferedOutput: vi.fn().mockResolvedValue({}),
    killProcess: vi.fn().mockResolvedValue({ ok: true }),
    saveAttachment: vi.fn().mockResolvedValue('path'),
    deleteAttachment: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(null),
    saveState: vi.fn().mockResolvedValue({ ok: true }),
  },
  api: {
    getInfo: vi.fn().mockRejectedValue(new Error('not connected')),
    launch: vi.fn().mockResolvedValue({ pid: 1 }),
    launchTerminal: vi.fn().mockResolvedValue({ ok: true }),
    listProcesses: vi.fn().mockResolvedValue([]),
    getBufferedOutput: vi.fn().mockResolvedValue({}),
    killProcess: vi.fn().mockResolvedValue({ ok: true }),
    saveAttachment: vi.fn().mockResolvedValue('path'),
    deleteAttachment: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(null),
    saveState: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

// Mock fs module before importing useProject
vi.mock('../fs.ts', () => ({
  loadDirHandle: vi.fn().mockResolvedValue(null),
  saveDirHandle: vi.fn().mockResolvedValue(undefined),
  clearDirHandle: vi.fn().mockResolvedValue(undefined),
  verifyHandle: vi.fn().mockResolvedValue(false),
  requestAccess: vi.fn().mockResolvedValue(false),
  readState: vi.fn().mockResolvedValue(null),
  writeState: vi.fn().mockResolvedValue({ ok: true, lastModified: Date.now() }),
  createDefaultState: vi.fn((name: string) => ({
    project: name,
    tasks: [],
    queue: [],
    taskNotes: {},
    activity: [{ id: 'act_init', time: Date.now(), label: 'Project initialized' }],
  })),
  ensureDevManagerDir: vi.fn().mockResolvedValue({}),
  ensureOrchestratorSkill: vi.fn().mockResolvedValue(true),
  ensureCodehealthSkill: vi.fn().mockResolvedValue(true),
  ensureAutofixSkill: vi.fn().mockResolvedValue(true),
  readProgressFiles: vi.fn().mockResolvedValue({}),
  deleteProgressFile: vi.fn().mockResolvedValue(undefined),
  syncSkills: vi.fn().mockResolvedValue(undefined),
  snapshotState: vi.fn().mockResolvedValue(null),
}));

import { useProject } from '../hooks/useProject.ts';

describe('useProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts disconnected with null data', () => {
    const { result } = renderHook(() => useProject());

    expect(result.current.connected).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.projectName).toBe('');
  });

  it('disconnect resets state', async () => {
    const { result } = renderHook(() => useProject());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.projectName).toBe('');
    expect(result.current.status).toBe('disconnected');
  });

  it('save updates data state when dirHandle is null', () => {
    const { result } = renderHook(() => useProject());

    const newData = {
      project: 'test',
      tasks: [{ id: 1, name: 'Task 1', status: 'pending' as const }],
      queue: [],
      taskNotes: {},
      activity: [],
    };

    act(() => {
      result.current.save(newData);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.project).toBe('test');
    expect(result.current.data!.tasks).toHaveLength(1);
    expect(result.current.data!.savedAt).toBeDefined();
  });
});
