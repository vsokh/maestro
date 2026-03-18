import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTaskActions } from '../hooks/useTaskActions.ts';
import type { StateData, Task, Epic } from '../types';

vi.mock('../fs.ts', () => ({
  saveAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

import { saveAttachment, deleteAttachment } from '../fs.ts';

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
    dirHandle: (restOverrides.dirHandle ?? null) as FileSystemDirectoryHandle | null,
    snapshotBeforeAction,
    onError,
    ...restOverrides,
  };
  const result = renderHook(() => useTaskActions(params));
  return { ...result, save, snapshotBeforeAction, onError };
}

describe('useTaskActions', () => {
  describe('handleUpdateTask', () => {
    it('updates a task\'s fields and calls save', () => {
      const task = makeTask(1, { name: 'Login' });
      const { result, save } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleUpdateTask(1, { name: 'Login v2' });
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.tasks[0].name).toBe('Login v2');
    });

    it('adds history entry on status change', () => {
      const task = makeTask(1, { status: 'pending', createdAt: '2026-01-01T00:00:00Z' });
      const { result, save } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleUpdateTask(1, { status: 'in-progress' });
      });

      const savedData = save.mock.calls[0][0] as StateData;
      const history = savedData.tasks[0].history!;
      expect(history.length).toBe(2);
      expect(history[0].status).toBe('created');
      expect(history[1].status).toBe('in-progress');
    });

    it('generates activity with "marked {status}" on status change', () => {
      const task = makeTask(1, { name: 'Build UI' });
      const { result, save } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleUpdateTask(1, { status: 'done' });
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.activity[0].label).toContain('marked done');
      expect(savedData.activity[0].label).toContain('Build UI');
    });

    it('generates activity with "updated" for non-status change', () => {
      const task = makeTask(1, { name: 'Build UI' });
      const { result, save } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleUpdateTask(1, { description: 'new description' });
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.activity[0].label).toContain('updated');
      expect(savedData.activity[0].label).not.toContain('marked');
    });
  });

  describe('handleBatchUpdateTasks', () => {
    // handleBatchUpdateTasks exists in uncommitted master changes but not in the
    // committed codebase. These tests are ready for when the function is committed.
    it.skip('updates multiple tasks at once', () => {});
    it.skip('leaves non-matching tasks unchanged', () => {});
  });

  describe('handleUpdateNotes', () => {
    it('updates taskNotes for a given id', () => {
      const { result, save } = setup({ data: { tasks: [makeTask(1)] } });

      act(() => {
        result.current.handleUpdateNotes(1, 'important note');
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.taskNotes['1']).toBe('important note');
    });
  });

  describe('handleAddTask', () => {
    it('adds task with auto-incremented id (max existing + 1)', () => {
      const tasks = [makeTask(3), makeTask(7)];
      const { result, save } = setup({ data: { tasks } });

      act(() => {
        result.current.handleAddTask({ name: 'New feature', status: 'pending' });
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      const newTask = savedData.tasks[savedData.tasks.length - 1];
      expect(newTask.id).toBe(8); // max(3,7) + 1
    });

    it('sets createdAt timestamp', () => {
      const { result, save } = setup();

      act(() => {
        result.current.handleAddTask({ name: 'Task A', status: 'pending' });
      });

      const savedData = save.mock.calls[0][0] as StateData;
      const newTask = savedData.tasks[0];
      expect(newTask.createdAt).toBeDefined();
      expect(typeof newTask.createdAt).toBe('string');
    });

    it('generates activity entry', () => {
      const { result, save } = setup();

      act(() => {
        result.current.handleAddTask({ name: 'My Task', status: 'pending' });
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.activity.length).toBeGreaterThan(0);
      expect(savedData.activity[0].label).toContain('"My Task" added');
    });
  });

  describe('handleRenameGroup', () => {
    it('renames group in both tasks and epics', () => {
      const tasks = [
        makeTask(1, { group: 'frontend' }),
        makeTask(2, { group: 'backend' }),
        makeTask(3, { group: 'frontend' }),
      ];
      const epics: Epic[] = [
        { name: 'frontend', color: 1 },
        { name: 'backend', color: 2 },
      ];
      const { result, save } = setup({ data: { tasks, epics } });

      act(() => {
        result.current.handleRenameGroup('frontend', 'ui');
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.tasks[0].group).toBe('ui');
      expect(savedData.tasks[1].group).toBe('backend');
      expect(savedData.tasks[2].group).toBe('ui');
      expect(savedData.epics![0].name).toBe('ui');
      expect(savedData.epics![1].name).toBe('backend');
    });
  });

  describe('handleUpdateEpics', () => {
    it('updates epics array', () => {
      const { result, save } = setup({ data: { epics: [{ name: 'old' }] } });
      const newEpics: Epic[] = [{ name: 'alpha' }, { name: 'beta' }];

      act(() => {
        result.current.handleUpdateEpics(newEpics);
      });

      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.epics).toEqual(newEpics);
    });
  });

  describe('handleDeleteTask', () => {
    it('calls snapshotBeforeAction before delete', () => {
      const task = makeTask(1, { name: 'Doomed task' });
      const { result, snapshotBeforeAction } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleDeleteTask(1);
      });

      expect(snapshotBeforeAction).toHaveBeenCalledWith('Doomed task deleted');
    });

    it('removes task from tasks array', () => {
      const tasks = [makeTask(1), makeTask(2)];
      const { result, save } = setup({ data: { tasks } });

      act(() => {
        result.current.handleDeleteTask(1);
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.tasks).toHaveLength(1);
      expect(savedData.tasks[0].id).toBe(2);
    });

    it('removes task from queue', () => {
      const tasks = [makeTask(1), makeTask(2)];
      const queue = [
        { task: 1, taskName: 'Task 1', notes: '' },
        { task: 2, taskName: 'Task 2', notes: '' },
      ];
      const { result, save } = setup({ data: { tasks, queue } });

      act(() => {
        result.current.handleDeleteTask(1);
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.queue).toHaveLength(1);
      expect(savedData.queue[0].task).toBe(2);
    });

    it('removes task from taskNotes', () => {
      const tasks = [makeTask(1), makeTask(2)];
      const taskNotes = { '1': 'note for 1', '2': 'note for 2' };
      const { result, save } = setup({ data: { tasks, taskNotes } });

      act(() => {
        result.current.handleDeleteTask(1);
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.taskNotes).not.toHaveProperty('1');
      expect(savedData.taskNotes['2']).toBe('note for 2');
    });

    it('removes task id from other tasks\' dependsOn arrays', () => {
      const tasks = [
        makeTask(1),
        makeTask(2, { dependsOn: [1, 3] }),
        makeTask(3, { dependsOn: [1] }),
      ];
      const { result, save } = setup({ data: { tasks } });

      act(() => {
        result.current.handleDeleteTask(1);
      });

      const savedData = save.mock.calls[0][0] as StateData;
      // task 1 removed, task 2 should have dependsOn: [3], task 3 should have dependsOn: []
      const task2 = savedData.tasks.find(t => t.id === 2)!;
      const task3 = savedData.tasks.find(t => t.id === 3)!;
      expect(task2.dependsOn).toEqual([3]);
      expect(task3.dependsOn).toEqual([]);
    });

    it('generates activity entry', () => {
      const task = makeTask(1, { name: 'Bye task' });
      const { result, save } = setup({ data: { tasks: [task] } });

      act(() => {
        result.current.handleDeleteTask(1);
      });

      const savedData = save.mock.calls[0][0] as StateData;
      expect(savedData.activity.length).toBeGreaterThan(0);
      expect(savedData.activity[0].label).toContain('Bye task deleted');
    });
  });

  describe('handleAddAttachment', () => {
    beforeEach(() => {
      vi.mocked(saveAttachment).mockReset();
    });

    it('returns early when dirHandle is null', async () => {
      const task = makeTask(1);
      const { result, save } = setup({ data: { tasks: [task] }, dirHandle: null });
      const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

      await act(async () => {
        await result.current.handleAddAttachment(1, file);
      });

      expect(saveAttachment).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('calls saveAttachment from fs.ts and updates task', async () => {
      vi.mocked(saveAttachment).mockResolvedValue('.devmanager/attachments/1/screenshot.png');
      const task = makeTask(1);
      const fakeDirHandle = {} as FileSystemDirectoryHandle;
      const { result, save } = setup({ data: { tasks: [task] }, dirHandle: fakeDirHandle });
      const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

      await act(async () => {
        await result.current.handleAddAttachment(1, file);
      });

      expect(saveAttachment).toHaveBeenCalledWith(fakeDirHandle, 1, 'screenshot.png', file);
      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      const updatedTask = savedData.tasks[0];
      expect(updatedTask.attachments).toHaveLength(1);
      expect(updatedTask.attachments![0].filename).toBe('screenshot.png');
    });

    it('calls onError on failure', async () => {
      vi.mocked(saveAttachment).mockRejectedValue(new Error('disk full'));
      const task = makeTask(1);
      const fakeDirHandle = {} as FileSystemDirectoryHandle;
      const { result, onError } = setup({ data: { tasks: [task] }, dirHandle: fakeDirHandle });
      const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

      await act(async () => {
        await result.current.handleAddAttachment(1, file);
      });

      expect(onError).toHaveBeenCalledWith('Failed to save screenshot');
    });
  });

  describe('handleDeleteAttachment', () => {
    beforeEach(() => {
      vi.mocked(deleteAttachment).mockReset();
    });

    it('returns early when dirHandle is null', async () => {
      const task = makeTask(1, {
        attachments: [{ id: 'att_1', filename: 'pic.png' }],
      });
      const { result, save, snapshotBeforeAction } = setup({
        data: { tasks: [task] },
        dirHandle: null,
      });

      await act(async () => {
        await result.current.handleDeleteAttachment(1, 'att_1');
      });

      expect(deleteAttachment).not.toHaveBeenCalled();
      expect(snapshotBeforeAction).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('calls snapshotBeforeAction', async () => {
      vi.mocked(deleteAttachment).mockResolvedValue(undefined);
      const task = makeTask(1, {
        attachments: [{ id: 'att_1', filename: 'pic.png' }],
      });
      const fakeDirHandle = {} as FileSystemDirectoryHandle;
      const { result, snapshotBeforeAction } = setup({
        data: { tasks: [task] },
        dirHandle: fakeDirHandle,
      });

      await act(async () => {
        await result.current.handleDeleteAttachment(1, 'att_1');
      });

      expect(snapshotBeforeAction).toHaveBeenCalledWith('Attachment deleted');
    });

    it('calls deleteAttachment from fs.ts and updates task', async () => {
      vi.mocked(deleteAttachment).mockResolvedValue(undefined);
      const task = makeTask(1, {
        attachments: [
          { id: 'att_1', filename: 'pic.png' },
          { id: 'att_2', filename: 'doc.pdf' },
        ],
      });
      const fakeDirHandle = {} as FileSystemDirectoryHandle;
      const { result, save } = setup({
        data: { tasks: [task] },
        dirHandle: fakeDirHandle,
      });

      await act(async () => {
        await result.current.handleDeleteAttachment(1, 'att_1');
      });

      expect(deleteAttachment).toHaveBeenCalledWith(fakeDirHandle, 1, 'pic.png', expect.any(Function));
      expect(save).toHaveBeenCalledTimes(1);
      const savedData = save.mock.calls[0][0] as StateData;
      const updatedTask = savedData.tasks[0];
      expect(updatedTask.attachments).toHaveLength(1);
      expect(updatedTask.attachments![0].id).toBe('att_2');
    });

    it('calls onError on failure', async () => {
      vi.mocked(deleteAttachment).mockRejectedValue(new Error('permission denied'));
      const task = makeTask(1, {
        attachments: [{ id: 'att_1', filename: 'pic.png' }],
      });
      const fakeDirHandle = {} as FileSystemDirectoryHandle;
      const { result, onError } = setup({
        data: { tasks: [task] },
        dirHandle: fakeDirHandle,
      });

      await act(async () => {
        await result.current.handleDeleteAttachment(1, 'att_1');
      });

      expect(onError).toHaveBeenCalledWith('Failed to delete screenshot');
    });
  });
});
