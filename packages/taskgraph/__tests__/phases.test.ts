import { describe, it, expect, vi } from 'vitest';
import { computePhases } from '../src/queue/phases.js';
import type { QueueItem, Task } from '../src/types.js';

const q = (id: number): QueueItem => ({ task: id, taskName: `Task ${id}`, notes: '' });

const t = (id: number, dependsOn?: number[]): Task => {
  const task: Task = { id, name: `Task ${id}`, status: 'pending' };
  if (dependsOn) task.dependsOn = dependsOn;
  return task;
};

describe('computePhases', () => {
  it('returns null when no inter-queue dependencies', () => {
    const queue = [q(1), q(2), q(3)];
    const tasks = [t(1), t(2), t(3)];
    const result = computePhases(queue, tasks);
    expect(result).toBeNull();
  });

  it('single dependency creates 2 phases', () => {
    const queue = [q(1), q(2)];
    const tasks = [t(1), t(2, [1])];
    const result = computePhases(queue, tasks);
    expect(result).toHaveLength(2);
    expect(result![0].map(r => r.task)).toEqual([1]);
    expect(result![1].map(r => r.task)).toEqual([2]);
  });

  it('chain A -> B -> C creates 3 phases', () => {
    const queue = [q(1), q(2), q(3)];
    const tasks = [t(1), t(2, [1]), t(3, [2])];
    const result = computePhases(queue, tasks);
    expect(result).toHaveLength(3);
    expect(result![0].map(r => r.task)).toEqual([1]);
    expect(result![1].map(r => r.task)).toEqual([2]);
    expect(result![2].map(r => r.task)).toEqual([3]);
  });

  it('parallel tasks with shared dep: [A] then [B, C]', () => {
    const queue = [q(1), q(2), q(3)];
    const tasks = [t(1), t(2, [1]), t(3, [1])];
    const result = computePhases(queue, tasks);
    expect(result).toHaveLength(2);
    expect(result![0].map(r => r.task)).toEqual([1]);
    expect(result![1].map(r => r.task).sort()).toEqual([2, 3]);
  });

  it('cyclic deps get safety-pushed into same phase', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const queue = [q(1), q(2)];
    const tasks = [t(1, [2]), t(2, [1])];
    const result = computePhases(queue, tasks);
    expect(result).not.toBeNull();
    const allIds = result!.flatMap(phase => phase.map(r => r.task)).sort();
    expect(allIds).toEqual([1, 2]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Circular dependency detected')
    );
    warnSpy.mockRestore();
  });

  it('empty queue returns null', () => {
    const result = computePhases([], [t(1)]);
    expect(result).toBeNull();
  });

  it('tasks with deps on non-queued tasks returns null', () => {
    const queue = [q(2), q(3)];
    const tasks = [t(1), t(2, [1]), t(3)];
    const result = computePhases(queue, tasks);
    expect(result).toBeNull();
  });
});
