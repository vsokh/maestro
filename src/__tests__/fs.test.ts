import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createDefaultState,
  writeState,
  readState,
  readProgressFiles,
  deleteProgressFile,
  snapshotState,
} from '../fs.ts';
import type { StateData } from '../types';
import { api } from '../api.ts';

// Mock the api module
vi.mock('../api.ts', () => ({
  api: {
    readState: vi.fn(),
    writeState: vi.fn(),
    readProgress: vi.fn(),
    deleteProgress: vi.fn(),
    snapshotState: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

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

describe('writeState + readState round-trip', () => {
  const sampleState: StateData = {
    project: 'test-project',
    tasks: [{ id: 1, name: 'Task 1', status: 'pending' }],
    queue: [{ task: 1, taskName: 'Task 1', notes: 'do it' }],
    taskNotes: { '1': 'some notes' },
    activity: [{ id: 'act_1', time: 1000, label: 'started' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writeState calls api and returns success', async () => {
    mockedApi.writeState.mockResolvedValue({ ok: true as const, lastModified: Date.now() });
    const writeResult = await writeState(sampleState);
    expect(writeResult.ok).toBe(true);
    expect(mockedApi.writeState).toHaveBeenCalledTimes(1);
  });

  it('readState returns state data from api', async () => {
    mockedApi.readState.mockResolvedValue({ data: sampleState, lastModified: Date.now() });
    const result = await readState();
    expect(result).not.toBeNull();
    expect(result!.data.project).toBe('test-project');
    expect(result!.data.tasks).toHaveLength(1);
    expect(result!.data.tasks[0].name).toBe('Task 1');
    expect(result!.lastModified).toBeDefined();
  });
});

describe('readState edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when api throws error', async () => {
    mockedApi.readState.mockRejectedValue(new Error('Not found'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await readState();
    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe('readProgressFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads valid progress files', async () => {
    mockedApi.readProgress.mockResolvedValue({
      '1': { status: 'in-progress', progress: '50%' },
      '2': { status: 'done', completedAt: '2025-01-01' },
    });

    const result = await readProgressFiles();
    expect(result['1']).toBeDefined();
    expect(result['1'].status).toBe('in-progress');
    expect(result['1'].progress).toBe('50%');
    expect(result['2']).toBeDefined();
    expect(result['2'].status).toBe('done');
  });

  it('returns empty object when api throws', async () => {
    mockedApi.readProgress.mockRejectedValue(new Error('No progress dir'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await readProgressFiles();
    expect(result).toEqual({});
    consoleSpy.mockRestore();
  });
});

describe('deleteProgressFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls api to delete specified progress file', async () => {
    mockedApi.deleteProgress.mockResolvedValue({ ok: true as const });
    await deleteProgressFile(5);
    expect(mockedApi.deleteProgress).toHaveBeenCalledWith(5);
  });
});

describe('snapshotState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filename from api', async () => {
    mockedApi.snapshotState.mockResolvedValue({ filename: 'state-123456.json' });
    const filename = await snapshotState();
    expect(filename).not.toBeNull();
    expect(filename).toMatch(/^state-\d+\.json$/);
  });

  it('returns null when api throws', async () => {
    mockedApi.snapshotState.mockRejectedValue(new Error('No state'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const filename = await snapshotState();
    expect(filename).toBeNull();
    consoleSpy.mockRestore();
  });
});
