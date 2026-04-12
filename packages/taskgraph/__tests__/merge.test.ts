import { describe, it, expect, vi } from 'vitest';
import { mergeProgressIntoState, protectDoneTaskRegression } from '../src/state/merge.js';
import type { StateData, ProgressEntry } from '../src/types.js';

function makeState(overrides: Partial<StateData> = {}): StateData {
  return {
    project: 'test',
    tasks: [
      { id: 1, name: 'Task 1', status: 'pending' },
      { id: 2, name: 'Task 2', status: 'in-progress' },
    ],
    queue: [{ task: 2, taskName: 'Task 2' }],
    taskNotes: {},
    activity: [],
    ...overrides,
  };
}

describe('mergeProgressIntoState', () => {
  it('returns unchanged state for empty progress', () => {
    const state = makeState();
    const result = mergeProgressIntoState(state, {});
    expect(result.needsWrite).toBe(false);
    expect(result.hasChanges).toBe(false);
    expect(result.data).toBe(state);
  });

  it('marks task done and removes from queue', () => {
    const state = makeState();
    const progress: Record<string, ProgressEntry> = {
      '2': { status: 'done', commitRef: 'abc123', completedAt: '2026-01-01' },
    };
    const result = mergeProgressIntoState(state, progress);
    expect(result.needsWrite).toBe(true);
    expect(result.completedTaskIds).toEqual([2]);
    expect(result.data.tasks.find(t => t.id === 2)!.status).toBe('done');
    expect(result.data.queue).toHaveLength(0);
    expect(result.data.activity.length).toBeGreaterThan(0);
  });

  it('updates in-progress task with progress message', () => {
    const state = makeState();
    const progress: Record<string, ProgressEntry> = {
      '2': { status: 'in-progress', progress: 'Working...' },
    };
    const result = mergeProgressIntoState(state, progress);
    expect(result.hasChanges).toBe(true);
    expect(result.needsWrite).toBe(false);
    expect(result.data.tasks.find(t => t.id === 2)!.progress).toBe('Working...');
  });

  it('skips stale progress for done tasks', () => {
    const state = makeState({
      tasks: [{ id: 1, name: 'T', status: 'done', completedAt: '2026-01-01' }],
    });
    const progress: Record<string, ProgressEntry> = {
      '1': { status: 'in-progress', progress: 'Stale' },
    };
    const result = mergeProgressIntoState(state, progress);
    expect(result.staleProgressIds).toEqual([1]);
    expect(result.data.tasks[0].status).toBe('done');
  });

  it('handles arrange progress entry', () => {
    const state = makeState();
    const progress: Record<string, ProgressEntry> = {
      arrange: {
        status: 'done',
        label: 'Tasks rearranged',
        taskUpdates: { '1': { group: 'NewGroup' } },
      },
    };
    const result = mergeProgressIntoState(state, progress);
    expect(result.arrangeCompleted).toBe(true);
    expect(result.data.tasks.find(t => t.id === 1)!.group).toBe('NewGroup');
  });

  it('marks invalid progress as stale', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = makeState();
    const progress: Record<string, ProgressEntry> = {
      '1': { status: 'invalid' } as unknown as ProgressEntry,
    };
    const result = mergeProgressIntoState(state, progress);
    expect(result.staleProgressIds).toContain('1');
    vi.restoreAllMocks();
  });
});

describe('protectDoneTaskRegression', () => {
  it('patches incoming state to preserve done tasks', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const current = makeState({
      tasks: [{ id: 1, name: 'T', status: 'done', completedAt: '2026-01-01', commitRef: 'abc' }],
    });
    const incoming = makeState({
      tasks: [{ id: 1, name: 'T', status: 'in-progress' }],
      queue: [{ task: 1, taskName: 'T' }],
    });
    const result = protectDoneTaskRegression(current, incoming);
    expect(result.tasks[0].status).toBe('done');
    expect(result.tasks[0].completedAt).toBe('2026-01-01');
    expect(result.queue).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('returns incoming unchanged when no regression', () => {
    const current = makeState();
    const incoming = makeState();
    const result = protectDoneTaskRegression(current, incoming);
    expect(result).toBe(incoming);
  });
});
