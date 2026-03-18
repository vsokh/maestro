import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockDirectoryHandle } from './mocks/fsa.ts';
import {
  createDefaultState,
  verifyHandle,
  requestAccess,
  ensureDevManagerDir,
  writeState,
  readState,
  readProgressFiles,
  deleteProgressFile,
  snapshotState,
} from '../fs.ts';
import type { StateData } from '../types';

// Cast mock handles to FileSystemDirectoryHandle for the API calls
function asFSHandle(mock: MockDirectoryHandle): FileSystemDirectoryHandle {
  return mock as unknown as FileSystemDirectoryHandle;
}

describe('createDefaultState', () => {
  it('returns valid state with correct project name', () => {
    const state = createDefaultState('my-project');
    expect(state.project).toBe('my-project');
    expect(state.tasks).toEqual([]);
    expect(state.queue).toEqual([]);
    expect(state.taskNotes).toEqual({});
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0].label).toBe('Project initialized');
    expect(state.activity[0].id).toBe('act_init');
    expect(state.savedAt).toBeDefined();
  });

  it('returns empty features array', () => {
    const state = createDefaultState('test');
    expect(state.features).toEqual([]);
  });
});

describe('verifyHandle', () => {
  it('returns false for null handle', async () => {
    const result = await verifyHandle(null);
    expect(result).toBe(false);
  });

  it('returns true when permission is granted', async () => {
    const mock = new MockDirectoryHandle('test-project');
    const result = await verifyHandle(asFSHandle(mock));
    expect(result).toBe(true);
  });
});

describe('requestAccess', () => {
  it('returns false for null handle', async () => {
    const result = await requestAccess(null);
    expect(result).toBe(false);
  });

  it('returns true when permission is granted', async () => {
    const mock = new MockDirectoryHandle('test-project');
    const result = await requestAccess(asFSHandle(mock));
    expect(result).toBe(true);
  });
});

describe('ensureDevManagerDir', () => {
  it('creates and returns .devmanager directory handle', async () => {
    const mock = new MockDirectoryHandle('test-project');
    const dir = await ensureDevManagerDir(asFSHandle(mock));
    expect(dir).toBeDefined();
    expect((dir as unknown as MockDirectoryHandle).name).toBe('.devmanager');
  });
});

describe('writeState + readState round-trip', () => {
  let root: MockDirectoryHandle;
  const sampleState: StateData = {
    project: 'test-project',
    tasks: [{ id: 1, name: 'Task 1', status: 'pending' }],
    queue: [{ task: 1, taskName: 'Task 1', notes: 'do it' }],
    taskNotes: { '1': 'some notes' },
    activity: [{ id: 'act_1', time: 1000, label: 'started' }],
  };

  beforeEach(() => {
    root = new MockDirectoryHandle('test-project');
  });

  it('writes state and reads it back with matching data', async () => {
    const writeOk = await writeState(asFSHandle(root), sampleState);
    expect(writeOk).toBe(true);

    const result = await readState(asFSHandle(root));
    expect(result).not.toBeNull();
    expect(result!.data.project).toBe('test-project');
    expect(result!.data.tasks).toHaveLength(1);
    expect(result!.data.tasks[0].name).toBe('Task 1');
    expect(result!.data.queue).toHaveLength(1);
    expect(result!.data.queue[0].task).toBe(1);
    expect(result!.data.taskNotes).toEqual({ '1': 'some notes' });
    expect(result!.data.activity).toHaveLength(1);
    expect(result!.lastModified).toBeDefined();
  });
});

describe('readState edge cases', () => {
  it('returns null when state file does not exist', async () => {
    const root = new MockDirectoryHandle('empty-project');
    const result = await readState(asFSHandle(root));
    expect(result).toBeNull();
  });

  it('returns null when state file contains invalid JSON', async () => {
    const root = new MockDirectoryHandle('bad-project');
    const dmDir = root.addDirectory('.devmanager');
    dmDir.addFile('state.json', 'not valid json {{{');

    const result = await readState(asFSHandle(root));
    expect(result).toBeNull();
  });
});

describe('readProgressFiles', () => {
  it('reads valid progress files', async () => {
    const root = new MockDirectoryHandle('project');
    const dmDir = root.addDirectory('.devmanager');
    const progDir = dmDir.addDirectory('progress');
    progDir.addFile('1.json', JSON.stringify({ status: 'in-progress', progress: '50%' }));
    progDir.addFile('2.json', JSON.stringify({ status: 'done', completedAt: '2025-01-01' }));

    const result = await readProgressFiles(asFSHandle(root));
    expect(result[1]).toBeDefined();
    expect(result[1].status).toBe('in-progress');
    expect(result[1].progress).toBe('50%');
    expect(result[2]).toBeDefined();
    expect(result[2].status).toBe('done');
  });

  it('skips files with invalid JSON', async () => {
    const root = new MockDirectoryHandle('project');
    const dmDir = root.addDirectory('.devmanager');
    const progDir = dmDir.addDirectory('progress');
    progDir.addFile('1.json', JSON.stringify({ status: 'in-progress', progress: '50%' }));
    progDir.addFile('2.json', 'not json!!!');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await readProgressFiles(asFSHandle(root));
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('returns empty object when no progress directory exists', async () => {
    const root = new MockDirectoryHandle('project');
    // No .devmanager dir at all
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await readProgressFiles(asFSHandle(root));
    expect(result).toEqual({});
    consoleSpy.mockRestore();
  });
});

describe('deleteProgressFile', () => {
  it('removes the specified progress file', async () => {
    const root = new MockDirectoryHandle('project');
    const dmDir = root.addDirectory('.devmanager');
    const progDir = dmDir.addDirectory('progress');
    progDir.addFile('5.json', JSON.stringify({ status: 'done' }));

    await deleteProgressFile(asFSHandle(root), 5);

    // Verify file is gone by trying to read progress files
    const result = await readProgressFiles(asFSHandle(root));
    expect(result[5]).toBeUndefined();
  });
});

describe('snapshotState', () => {
  it('reads state.json and writes to backups directory', async () => {
    const root = new MockDirectoryHandle('project');
    const dmDir = root.addDirectory('.devmanager');
    const stateContent = JSON.stringify({ project: 'test', tasks: [], queue: [], taskNotes: {}, activity: [] });
    dmDir.addFile('state.json', stateContent);

    const filename = await snapshotState(asFSHandle(root));
    expect(filename).not.toBeNull();
    expect(filename).toMatch(/^state-\d+\.json$/);
  });

  it('returns null when state.json does not exist', async () => {
    const root = new MockDirectoryHandle('project');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const filename = await snapshotState(asFSHandle(root));
    expect(filename).toBeNull();
    consoleSpy.mockRestore();
  });
});
