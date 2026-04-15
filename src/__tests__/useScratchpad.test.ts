import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api module
vi.mock('../api.ts', () => ({
  api: {
    splitTasks: vi.fn().mockResolvedValue({ tasks: [] }),
    launch: vi.fn().mockResolvedValue({ pid: 1 }),
  },
}));

import { useScratchpad } from '../hooks/useScratchpad.ts';
import { api } from '../api.ts';
import type { StateData } from '../types';

const mockedApi = vi.mocked(api);

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

function setup(overrides: { data?: StateData | null } = {}) {
  const save = vi.fn();
  const showError = vi.fn();
  const data = overrides.data !== undefined ? overrides.data : makeData();
  const result = renderHook(() => useScratchpad({ data, save, showError }));
  return { ...result, save, showError };
}

describe('useScratchpad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with showScratchpad=false and splitting=false', () => {
    const { result } = setup();

    expect(result.current.showScratchpad).toBe(false);
    expect(result.current.splitting).toBe(false);
    expect(result.current.splitResult).toBeNull();
  });

  it('setShowScratchpad toggles visibility', () => {
    const { result } = setup();

    act(() => {
      result.current.setShowScratchpad(true);
    });

    expect(result.current.showScratchpad).toBe(true);
  });

  describe('handleSplitTasks', () => {
    it('does nothing when data is null', async () => {
      const { result, save } = setup({ data: null });

      await act(async () => {
        await result.current.handleSplitTasks('Build login page');
      });

      expect(mockedApi.splitTasks).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('creates tasks with correct sequential IDs starting after existing tasks', async () => {
      const existingTasks = [
        { id: 1, name: 'Existing', status: 'done' as const },
        { id: 5, name: 'Another', status: 'pending' as const },
      ];
      const data = makeData({ tasks: existingTasks });
      const { result, save } = setup({ data });

      mockedApi.splitTasks.mockResolvedValue({
        tasks: [
          { name: 'New Task A', fullName: 'New Task A', description: 'desc A' },
          { name: 'New Task B', fullName: 'New Task B', description: 'desc B' },
        ],
      });

      await act(async () => {
        await result.current.handleSplitTasks('Build new features');
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      // IDs should start after the max existing ID (5)
      expect(savedData.tasks).toHaveLength(4); // 2 existing + 2 new
      expect(savedData.tasks[2].id).toBe(6);
      expect(savedData.tasks[3].id).toBe(7);
      expect(savedData.tasks[2].name).toBe('New Task A');
      expect(savedData.tasks[3].name).toBe('New Task B');
      expect(savedData.tasks[2].status).toBe('pending');
    });

    it('adds activity entry for created tasks', async () => {
      const data = makeData();
      const { result, save } = setup({ data });

      mockedApi.splitTasks.mockResolvedValue({
        tasks: [
          { name: 'Task 1', fullName: 'Task 1', description: '' },
          { name: 'Task 2', fullName: 'Task 2', description: '' },
        ],
      });

      await act(async () => {
        await result.current.handleSplitTasks('Some text');
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.activity.length).toBeGreaterThan(0);
      expect(savedData.activity[0].label).toContain('2 tasks created from scratchpad');
    });

    it('auto-registers new epics from task groups', async () => {
      const data = makeData({
        epics: [{ name: 'Existing Epic', color: 0 }],
      });
      const { result, save } = setup({ data });

      mockedApi.splitTasks.mockResolvedValue({
        tasks: [
          { name: 'Task A', fullName: 'Task A', description: '', group: 'Existing Epic' },
          { name: 'Task B', fullName: 'Task B', description: '', group: 'New Epic' },
          { name: 'Task C', fullName: 'Task C', description: '', group: 'New Epic' },
        ],
      });

      await act(async () => {
        await result.current.handleSplitTasks('Multiple groups');
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.epics).toHaveLength(2);
      expect(savedData.epics![0].name).toBe('Existing Epic');
      expect(savedData.epics![1].name).toBe('New Epic');
      // New epic should not duplicate existing
    });

    it('sets splitResult after successful split', async () => {
      const { result } = setup();

      mockedApi.splitTasks.mockResolvedValue({
        tasks: [
          { name: 'Task A', fullName: 'Task A', description: '' },
        ],
      });

      await act(async () => {
        await result.current.handleSplitTasks('split me');
      });

      expect(result.current.splitResult).toEqual([{ name: 'Task A' }]);
    });

    it('clears scratchpad text in saved data', async () => {
      const data = makeData({ scratchpad: 'Build auth system' });
      const { result, save } = setup({ data });

      mockedApi.splitTasks.mockResolvedValue({
        tasks: [{ name: 'Auth', fullName: 'Auth', description: '' }],
      });

      await act(async () => {
        await result.current.handleSplitTasks('Build auth system');
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.scratchpad).toBe('');
    });

    it('calls showError on API failure', async () => {
      const { result, save, showError } = setup();

      mockedApi.splitTasks.mockRejectedValue(new Error('AI service down'));

      await act(async () => {
        await result.current.handleSplitTasks('fail me');
      });

      expect(save).not.toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith('Failed to split tasks: AI service down');
      expect(result.current.splitting).toBe(false);
    });

    it('does not call save when API returns empty tasks', async () => {
      const { result, save } = setup();

      mockedApi.splitTasks.mockResolvedValue({ tasks: [] });

      await act(async () => {
        await result.current.handleSplitTasks('nothing');
      });

      expect(save).not.toHaveBeenCalled();
    });

    it('triggers arrange after split', async () => {
      const { result } = setup();

      mockedApi.splitTasks.mockResolvedValue({
        tasks: [{ name: 'Task', fullName: 'Task', description: '' }],
      });

      await act(async () => {
        await result.current.handleSplitTasks('arrange me');
      });

      expect(mockedApi.launch).toHaveBeenCalledWith(0, '/orchestrator arrange', undefined, 'sonnet');
    });
  });
});
