import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module before importing useSync
vi.mock('../fs.ts', () => ({
  writeState: vi.fn().mockResolvedValue({ ok: true, lastModified: Date.now() }),
  readProgressFiles: vi.fn().mockResolvedValue({}),
  deleteProgressFile: vi.fn().mockResolvedValue(undefined),
}));

import { useSync } from '../hooks/useSync.ts';
import { mergeProgressIntoState } from 'taskgraph';
import { writeState, deleteProgressFile } from '../fs.ts';
import type { StateData, ProgressEntry } from '../types';

function makeData(overrides: Partial<StateData> = {}): StateData {
  return {
    project: 'test',
    tasks: [],
    queue: [],
    taskNotes: {},
    activity: [],
    ...overrides,
  };
}

function makeTask(id: number, overrides: Partial<import('../types').Task> = {}): import('../types').Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

describe('mergeProgressIntoState (supplemental)', () => {
  it('returns unchanged data with needsWrite=false for empty progress', () => {
    const state = makeData({ tasks: [makeTask(1)] });

    const result = mergeProgressIntoState(state, {});

    expect(result.needsWrite).toBe(false);
    expect(result.hasChanges).toBe(false);
    expect(result.completedTaskIds).toEqual([]);
    expect(result.staleProgressIds).toEqual([]);
  });

  it('preserves existing startedAt on subsequent in-progress updates', () => {
    const state = makeData({
      tasks: [makeTask(1, { status: 'in-progress', startedAt: '2026-01-01T00:00:00Z' })],
    });
    const progress: Record<string, ProgressEntry> = {
      '1': { status: 'in-progress', progress: 'Updated progress' },
    };

    const result = mergeProgressIntoState(state, progress);

    expect(result.data.tasks[0].startedAt).toBe('2026-01-01T00:00:00Z');
    expect(result.data.tasks[0].progress).toBe('Updated progress');
  });

  it('includes summary in activity changes on done', () => {
    const state = makeData({
      tasks: [makeTask(1, { status: 'in-progress' })],
    });
    const progress: Record<string, ProgressEntry> = {
      '1': { status: 'done', summary: 'Implemented feature X' },
    };

    const result = mergeProgressIntoState(state, progress);

    expect(result.data.activity[0].changes).toEqual(['Implemented feature X']);
    expect(result.data.tasks[0].summary).toBe('Implemented feature X');
  });

  it('includes commitRef and filesChanged in activity entry on done', () => {
    const state = makeData({
      tasks: [makeTask(1, { status: 'in-progress' })],
    });
    const progress: Record<string, ProgressEntry> = {
      '1': { status: 'done', commitRef: 'abc123', filesChanged: 5 },
    };

    const result = mergeProgressIntoState(state, progress);

    expect(result.data.activity[0].commitRef).toBe('abc123');
    expect(result.data.activity[0].filesChanged).toBe(5);
  });

  it('includes changes field in arrange activity entry', () => {
    const state = makeData({ tasks: [makeTask(1)] });
    const progress: Record<string, ProgressEntry> = {
      arrange: { status: 'done', label: 'Arranged', changes: ['Added dependency graph'] },
    };

    const result = mergeProgressIntoState(state, progress);

    expect(result.data.activity[0].changes).toEqual(['Added dependency graph']);
  });
});

describe('useSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const setStatus = vi.fn();
    const result = renderHook(() => useSync({ setStatus }));
    return { ...result, setStatus };
  }

  it('starts with null data and empty projectName', () => {
    const { result } = setup();

    expect(result.current.data).toBeNull();
    expect(result.current.projectName).toBe('');
  });

  it('save updates data state immediately', () => {
    const { result } = setup();
    const newData = makeData({ project: 'my-project', tasks: [makeTask(1)] });

    act(() => {
      result.current.save(newData);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.project).toBe('my-project');
    expect(result.current.data!.tasks).toHaveLength(1);
    expect(result.current.data!.savedAt).toBeDefined();
  });

  it('save debounces writeState call by 500ms', async () => {
    const { result } = setup();
    const data = makeData({ project: 'test' });

    act(() => {
      result.current.save(data);
    });

    // Not called yet (debounced)
    expect(writeState).not.toHaveBeenCalled();

    // Advance past the debounce timer
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(writeState).toHaveBeenCalledTimes(1);
  });

  describe('handleSyncMessage', () => {
    it('handles state message and updates data when lastModified is newer', () => {
      const { result, setStatus } = setup();
      const stateData = makeData({ project: 'synced-project' });

      act(() => {
        const handled = result.current.handleSyncMessage({
          type: 'state',
          data: stateData,
          lastModified: Date.now() + 5000,
        });
        expect(handled).toBe(true);
      });

      expect(result.current.data).not.toBeNull();
      expect(result.current.data!.project).toBe('synced-project');
      expect(result.current.projectName).toBe('synced-project');
      expect(setStatus).toHaveBeenCalledWith('synced');
    });

    it('rejects stale state based on _v check', () => {
      const { result } = setup();

      // First, set current data with _v=5
      act(() => {
        result.current.setData(makeData({ project: 'current', _v: 5 }));
      });

      // Try to sync state with _v=3 (stale)
      act(() => {
        const handled = result.current.handleSyncMessage({
          type: 'state',
          data: makeData({ project: 'stale', _v: 3 }),
          lastModified: Date.now() + 5000,
        });
        expect(handled).toBe(true);
      });

      // Data should remain as 'current', not overwritten with 'stale'
      expect(result.current.data!.project).toBe('current');
    });

    it('handles progress message and merges into state', () => {
      const { result } = setup();

      // Set initial data
      act(() => {
        result.current.setData(makeData({
          project: 'test',
          tasks: [makeTask(1)],
        }));
      });

      act(() => {
        const handled = result.current.handleSyncMessage({
          type: 'progress',
          data: { '1': { status: 'in-progress', progress: 'Working...' } },
        });
        expect(handled).toBe(true);
      });

      expect(result.current.data!.tasks[0].status).toBe('in-progress');
      expect(result.current.data!.tasks[0].progress).toBe('Working...');
    });

    it('deletes stale progress files on progress message', () => {
      const { result } = setup();

      // Set initial data with a done task
      act(() => {
        result.current.setData(makeData({
          tasks: [makeTask(1, { status: 'done', completedAt: '2026-01-01' })],
        }));
      });

      act(() => {
        result.current.handleSyncMessage({
          type: 'progress',
          data: { '1': { status: 'in-progress', progress: 'stale' } },
        });
      });

      expect(deleteProgressFile).toHaveBeenCalledWith(1);
    });

    it('returns false for unknown message types', () => {
      const { result } = setup();

      act(() => {
        const handled = result.current.handleSyncMessage({
          type: 'quality',
          data: { overallScore: 85, grade: 'B', dimensions: {} },
        });
        expect(handled).toBe(false);
      });
    });
  });
});
