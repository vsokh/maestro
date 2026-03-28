import { describe, it, expect } from 'vitest';
import { mergeProgressIntoState } from '../hooks/useSync.ts';
import type { StateData, Task, ProgressEntry } from '../types';

function makeState(overrides: Partial<StateData> = {}): StateData {
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

describe('mergeProgressIntoState', () => {
  it('returns unchanged state when progress is empty', () => {
    const state = makeState({ tasks: [makeTask(1)] });
    const result = mergeProgressIntoState(state, {});
    expect(result.hasChanges).toBe(false);
    expect(result.needsWrite).toBe(false);
    expect(result.data).toEqual(state);
  });

  describe('in-progress transitions', () => {
    it('updates task status to in-progress', () => {
      const state = makeState({ tasks: [makeTask(1)] });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'in-progress', progress: 'Working...' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].status).toBe('in-progress');
      expect(result.data.tasks[0].progress).toBe('Working...');
      expect(result.hasChanges).toBe(true);
    });

    it('sets startedAt on first in-progress transition', () => {
      const state = makeState({ tasks: [makeTask(1)] });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'in-progress', progress: 'Starting' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].startedAt).toBeDefined();
    });

    it('keeps task in queue on in-progress transition (for progress visibility)', () => {
      const state = makeState({
        tasks: [makeTask(1), makeTask(2)],
        queue: [
          { task: 1, taskName: 'Task 1', notes: '' },
          { task: 2, taskName: 'Task 2', notes: '' },
        ],
      });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'in-progress', progress: 'Running' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.queue).toHaveLength(2);
      expect(result.data.tasks[0].status).toBe('in-progress');
    });

    it('does not remove from queue if task was not queued', () => {
      const state = makeState({
        tasks: [makeTask(1)],
        queue: [],
      });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'in-progress', progress: 'Running' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.queue).toHaveLength(0);
    });
  });

  describe('done transitions', () => {
    it('marks task as done with commit ref', () => {
      const state = makeState({ tasks: [makeTask(1, { status: 'in-progress' })] });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'done', commitRef: 'abc123', completedAt: '2026-03-27' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].status).toBe('done');
      expect(result.data.tasks[0].commitRef).toBe('abc123');
      expect(result.data.tasks[0].completedAt).toBe('2026-03-27');
      expect(result.completedTaskIds).toContain(1);
      expect(result.needsWrite).toBe(true);
    });

    it('removes task from queue on done', () => {
      const state = makeState({
        tasks: [makeTask(1, { status: 'in-progress' })],
        queue: [{ task: 1, taskName: 'Task 1', notes: '' }],
      });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'done', commitRef: 'abc' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.queue).toHaveLength(0);
    });

    it('adds activity entry on done', () => {
      const state = makeState({ tasks: [makeTask(1, { status: 'in-progress' })] });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'done', commitRef: 'abc' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.activity.length).toBeGreaterThan(0);
      expect(result.data.activity[0].label).toContain('Task 1');
      expect(result.data.activity[0].label).toContain('completed');
    });

    it('clears progress field on done', () => {
      const state = makeState({
        tasks: [makeTask(1, { status: 'in-progress', progress: 'Working...' })],
      });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'done', commitRef: 'abc' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].progress).toBeUndefined();
    });
  });

  describe('stale progress handling', () => {
    it('skips progress for already-done tasks', () => {
      const state = makeState({
        tasks: [makeTask(1, { status: 'done', completedAt: '2026-03-27' })],
      });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'in-progress', progress: 'late update' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].status).toBe('done');
      expect(result.staleProgressIds).toContain(1);
    });

    it('ignores progress for unknown task IDs', () => {
      const state = makeState({ tasks: [makeTask(1)] });
      const progress: Record<string, ProgressEntry> = {
        '999': { status: 'in-progress', progress: 'ghost' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.hasChanges).toBe(false);
      expect(result.staleProgressIds).toContain(999);
    });
  });

  describe('arrange progress', () => {
    it('adds activity entry for arrange completion', () => {
      const state = makeState({ tasks: [makeTask(1)] });
      const progress: Record<string, ProgressEntry> = {
        arrange: { status: 'done', label: 'Arranged 3 tasks' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.arrangeCompleted).toBe(true);
      expect(result.needsWrite).toBe(true);
      expect(result.data.activity[0].label).toBe('Arranged 3 tasks');
    });

    it('applies taskUpdates from arrange progress', () => {
      const state = makeState({
        tasks: [makeTask(1), makeTask(2), makeTask(3)],
      });
      const progress: Record<string, ProgressEntry> = {
        arrange: {
          status: 'done',
          label: 'Arranged tasks',
          taskUpdates: {
            '1': { dependsOn: [2], group: 'Core' },
            '3': { group: 'Polish' },
          },
        },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].dependsOn).toEqual([2]);
      expect(result.data.tasks[0].group).toBe('Core');
      expect(result.data.tasks[2].group).toBe('Polish');
      // Task 2 should be unchanged
      expect(result.data.tasks[1].group).toBeUndefined();
    });

    it('ignores taskUpdates for unknown task IDs', () => {
      const state = makeState({ tasks: [makeTask(1)] });
      const progress: Record<string, ProgressEntry> = {
        arrange: {
          status: 'done',
          label: 'Arranged',
          taskUpdates: { '999': { group: 'Ghost' } },
        },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.arrangeCompleted).toBe(true);
      // Should not throw, just skip unknown task
      expect(result.data.tasks).toHaveLength(1);
    });
  });

  describe('multiple concurrent progress entries', () => {
    it('handles multiple tasks progressing simultaneously', () => {
      const state = makeState({
        tasks: [makeTask(1), makeTask(2), makeTask(3)],
        queue: [
          { task: 1, taskName: 'Task 1', notes: '' },
          { task: 2, taskName: 'Task 2', notes: '' },
          { task: 3, taskName: 'Task 3', notes: '' },
        ],
      });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'in-progress', progress: 'Working on 1' },
        '2': { status: 'done', commitRef: 'def456' },
        '3': { status: 'in-progress', progress: 'Working on 3' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.tasks[0].status).toBe('in-progress');
      expect(result.data.tasks[1].status).toBe('done');
      expect(result.data.tasks[2].status).toBe('in-progress');
      // Only done task removed from queue; in-progress stay for visibility
      expect(result.data.queue).toHaveLength(2);
      expect(result.data.queue.map(q => q.task)).toEqual([1, 3]);
      expect(result.completedTaskIds).toEqual([2]);
    });
  });

  describe('activity truncation', () => {
    it('truncates activity to 20 entries', () => {
      const activity = Array.from({ length: 25 }, (_, i) => ({
        id: `act_${i}`,
        time: Date.now() - i * 1000,
        label: `Activity ${i}`,
      }));
      const state = makeState({ tasks: [makeTask(1, { status: 'in-progress' })], activity });
      const progress: Record<string, ProgressEntry> = {
        '1': { status: 'done', commitRef: 'abc' },
      };
      const result = mergeProgressIntoState(state, progress);
      expect(result.data.activity).toHaveLength(20);
    });
  });
});
