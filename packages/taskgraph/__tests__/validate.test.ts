import { describe, it, expect, vi } from 'vitest';
import {
  validateState,
  validateProgress,
  validateStateStructure,
  validateStateStrict,
  fixInconsistentTasks,
} from '../src/state/validate.js';
import type { Task } from '../src/types.js';

describe('validateState (sanitizing)', () => {
  it('returns null for non-objects', () => {
    expect(validateState(null)).toBeNull();
    expect(validateState(undefined)).toBeNull();
    expect(validateState('string')).toBeNull();
    expect(validateState([])).toBeNull();
  });

  it('returns valid StateData for minimal input', () => {
    const result = validateState({ project: 'test', tasks: [{ id: 1, name: 'T', status: 'pending' }] });
    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(1);
    expect(result!.project).toBe('test');
  });

  it('strips tasks with invalid status', () => {
    const result = validateState({
      project: 'test',
      tasks: [
        { id: 1, name: 'Good', status: 'done' },
        { id: 2, name: 'Bad', status: 'invalid' },
      ],
    });
    expect(result!.tasks).toHaveLength(1);
    expect(result!.tasks[0].id).toBe(1);
  });

  it('cleans invalid dependsOn entries', () => {
    const result = validateState({
      project: 'test',
      tasks: [{ id: 1, name: 'T', status: 'pending', dependsOn: [2, 'bad', NaN] }],
    });
    expect(result!.tasks[0].dependsOn).toEqual([2]);
  });

  it('filters queue items referencing missing tasks', () => {
    const result = validateState({
      project: 'test',
      tasks: [{ id: 1, name: 'T', status: 'pending' }],
      queue: [
        { task: 1, taskName: 'T' },
        { task: 999, taskName: 'Ghost' },
      ],
    });
    expect(result!.queue).toHaveLength(1);
    expect(result!.queue[0].task).toBe(1);
  });
});

describe('validateProgress', () => {
  it('returns null for invalid input', () => {
    expect(validateProgress(null)).toBeNull();
    expect(validateProgress({})).toBeNull();
    expect(validateProgress({ status: 'invalid' })).toBeNull();
  });

  it('parses valid progress entry', () => {
    const result = validateProgress({ status: 'done', commitRef: 'abc123', completedAt: '2026-01-01' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe('done');
    expect(result!.commitRef).toBe('abc123');
  });

  it('strips non-string changes', () => {
    const result = validateProgress({ status: 'done', changes: ['valid', 42, null] });
    expect(result!.changes).toEqual(['valid']);
  });
});

describe('validateStateStructure', () => {
  it('rejects non-object', () => {
    expect(validateStateStructure(null)).toBe(false);
    expect(validateStateStructure([])).toBe(false);
  });

  it('rejects missing tasks', () => {
    expect(validateStateStructure({})).toBe(false);
  });

  it('accepts valid structure', () => {
    expect(validateStateStructure({ tasks: [{ id: 1, name: 'T', status: 'pending' }] })).toBe(true);
  });

  it('rejects task with non-numeric id', () => {
    expect(validateStateStructure({ tasks: [{ id: 'bad', name: 'T', status: 'pending' }] })).toBe(false);
  });
});

describe('validateStateStrict', () => {
  it('reports multiple errors', () => {
    const result = validateStateStrict({ tasks: [{ id: 'bad' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('passes valid state', () => {
    const result = validateStateStrict({ tasks: [{ id: 1, name: 'T', status: 'pending' }] });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('fixInconsistentTasks', () => {
  it('fixes completedAt without done status', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tasks: Task[] = [{ id: 1, name: 'T', status: 'pending', completedAt: '2026-01-01' }];
    const result = fixInconsistentTasks(tasks);
    expect(result.fixed).toBe(true);
    expect(result.tasks[0].status).toBe('done');
    vi.restoreAllMocks();
  });

  it('fixes commitRef without done status', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tasks: Task[] = [{ id: 1, name: 'T', status: 'in-progress', commitRef: 'abc' }];
    const result = fixInconsistentTasks(tasks);
    expect(result.fixed).toBe(true);
    expect(result.tasks[0].status).toBe('done');
    vi.restoreAllMocks();
  });

  it('adds completedAt to done task without it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tasks: Task[] = [{ id: 1, name: 'T', status: 'done' }];
    const result = fixInconsistentTasks(tasks);
    expect(result.fixed).toBe(true);
    expect(result.tasks[0].completedAt).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('does not mutate input', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tasks: Task[] = [{ id: 1, name: 'T', status: 'pending', completedAt: '2026-01-01' }];
    fixInconsistentTasks(tasks);
    expect(tasks[0].status).toBe('pending'); // original unchanged
    vi.restoreAllMocks();
  });

  it('returns fixed=false when all consistent', () => {
    const tasks: Task[] = [{ id: 1, name: 'T', status: 'done', completedAt: '2026-01-01' }];
    const result = fixInconsistentTasks(tasks);
    expect(result.fixed).toBe(false);
  });
});
