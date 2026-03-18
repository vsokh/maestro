import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useQueueActions } from '../hooks/useQueueActions.ts';
import type { StateData, Task } from '../types';

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

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

function setup(overrides: Record<string, unknown> = {}) {
  const save = vi.fn();
  const snapshotBeforeAction = vi.fn();
  const onError = vi.fn();
  const data = makeData(overrides.data as Partial<StateData> | undefined);
  const { data: _dataOverride, ...restOverrides } = overrides;
  const params = {
    data,
    save,
    dirHandle: null as FileSystemDirectoryHandle | null,
    projectPath: '',
    snapshotBeforeAction,
    onError,
    ...restOverrides,
  };
  const result = renderHook(() => useQueueActions(params));
  return { ...result, save, snapshotBeforeAction, onError };
}

describe('useQueueActions', () => {
  describe('handleQueue', () => {
    it('adds task to queue and calls save with updated queue and activity', () => {
      const task = makeTask(1);
      const { result, save } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleQueue(task);
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.queue).toHaveLength(1);
      expect(savedData.queue[0].task).toBe(1);
      expect(savedData.queue[0].taskName).toBe('Task 1');
      expect(savedData.activity.length).toBeGreaterThan(0);
      expect(savedData.activity[0].label).toContain('queued');
    });

    it('prevents duplicates when task is already in queue', () => {
      const task = makeTask(1);
      const { result, save } = setup({
        data: {
          tasks: [task],
          queue: [{ task: 1, taskName: 'Task 1', notes: '' }],
        },
      });

      act(() => {
        result.current.handleQueue(task);
      });

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('handleQueueAll', () => {
    it('queues all pending/paused tasks not already queued', () => {
      const tasks = [
        makeTask(1, { status: 'pending' }),
        makeTask(2, { status: 'paused' }),
        makeTask(3, { status: 'done' }),
      ];
      const { result, save } = setup({ data: { tasks } });

      act(() => {
        result.current.handleQueueAll();
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.queue).toHaveLength(2);
      const queuedIds = savedData.queue.map(q => q.task);
      expect(queuedIds).toContain(1);
      expect(queuedIds).toContain(2);
      expect(queuedIds).not.toContain(3);
    });

    it('does nothing when no pending tasks', () => {
      const tasks = [makeTask(1, { status: 'done' })];
      const { result, save } = setup({ data: { tasks } });

      act(() => {
        result.current.handleQueueAll();
      });

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('handleQueueGroup', () => {
    it('queues only tasks in the specified group', () => {
      const tasks = [
        makeTask(1, { status: 'pending', group: 'frontend' }),
        makeTask(2, { status: 'pending', group: 'backend' }),
        makeTask(3, { status: 'pending', group: 'frontend' }),
      ];
      const { result, save } = setup({ data: { tasks } });

      act(() => {
        result.current.handleQueueGroup('frontend');
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.queue).toHaveLength(2);
      const queuedIds = savedData.queue.map(q => q.task);
      expect(queuedIds).toContain(1);
      expect(queuedIds).toContain(3);
      expect(queuedIds).not.toContain(2);
    });
  });

  describe('handleRemoveFromQueue', () => {
    it('removes task from queue', () => {
      const { result, save } = setup({
        data: {
          tasks: [makeTask(1), makeTask(2)],
          queue: [
            { task: 1, taskName: 'Task 1', notes: '' },
            { task: 2, taskName: 'Task 2', notes: '' },
          ],
        },
      });

      act(() => {
        result.current.handleRemoveFromQueue(1);
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.queue).toHaveLength(1);
      expect(savedData.queue[0].task).toBe(2);
    });
  });

  describe('handleClearQueue', () => {
    it('takes snapshot and clears queue', () => {
      const { result, save, snapshotBeforeAction } = setup({
        data: {
          queue: [{ task: 1, taskName: 'Task 1', notes: '' }],
        },
      });

      act(() => {
        result.current.handleClearQueue();
      });

      expect(snapshotBeforeAction).toHaveBeenCalledWith('Queue cleared');
      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.queue).toEqual([]);
    });

    it('does nothing when queue already empty', () => {
      const { result, save, snapshotBeforeAction } = setup({
        data: { queue: [] },
      });

      act(() => {
        result.current.handleClearQueue();
      });

      expect(snapshotBeforeAction).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('handleLaunchTask', () => {
    it('does nothing when no projectPath', () => {
      const anchors: HTMLAnchorElement[] = [];
      const origCreate = document.createElement.bind(document);
      const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') anchors.push(el as HTMLAnchorElement);
        return el;
      });

      const { result } = setup({ projectPath: '' });

      act(() => {
        result.current.handleLaunchTask(1, '/orchestrator task 1', 'Fix the login button');
      });

      // No anchor elements should have been created by launchProtocol
      const anchorCreations = createSpy.mock.calls.filter(c => c[0] === 'a');
      expect(anchorCreations).toHaveLength(0);
      createSpy.mockRestore();
    });

    it('constructs correct claudecode URL', () => {
      const anchors: HTMLAnchorElement[] = [];
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') anchors.push(el as HTMLAnchorElement);
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as HTMLElement);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as HTMLElement);

      const { result } = setup({
        projectPath: 'C:\\Users\\test\\project',
        data: { tasks: [], queue: [], taskNotes: {}, activity: [] },
      });

      act(() => {
        result.current.handleLaunchTask(1, '/orchestrator task 1', 'Fix the login button');
      });

      expect(anchors).toHaveLength(1);
      const anchor = anchors[0];
      // Verify the href was set correctly
      // shortTitle("Fix the login button") -> "Fix login"
      // URL components are encoded with encodeURIComponent
      const href = anchor.getAttribute('href')!;
      expect(href).toContain('claudecode:');
      expect(href).toContain(encodeURIComponent('C:/Users/test/project'));
      expect(href).toContain(encodeURIComponent('/orchestrator task 1'));
      expect(href).toContain(encodeURIComponent('Fix login'));

      vi.restoreAllMocks();
    });
  });

  describe('handleArrange', () => {
    it('does nothing when no projectPath', () => {
      const origCreate = document.createElement.bind(document);
      const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        return origCreate(tag);
      });

      const { result } = setup({ projectPath: '' });

      act(() => {
        result.current.handleArrange();
      });

      const anchorCreations = createSpy.mock.calls.filter(c => c[0] === 'a');
      expect(anchorCreations).toHaveLength(0);
      createSpy.mockRestore();
    });

    it('constructs correct URL with path normalization', () => {
      const anchors: HTMLAnchorElement[] = [];
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') anchors.push(el as HTMLAnchorElement);
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as HTMLElement);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as HTMLElement);

      const { result } = setup({
        projectPath: 'C:\\Users\\test\\project',
      });

      act(() => {
        result.current.handleArrange();
      });

      expect(anchors).toHaveLength(1);
      const anchor = anchors[0];
      const href = anchor.getAttribute('href')!;
      expect(href).toContain('claudecode:');
      expect(href).toContain(encodeURIComponent('C:/Users/test/project'));
      expect(href).toContain(encodeURIComponent('/orchestrator arrange'));
      expect(href).toContain(encodeURIComponent('Arrange tasks'));

      vi.restoreAllMocks();
    });
  });
});
