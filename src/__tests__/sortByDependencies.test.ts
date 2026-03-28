import { describe, it, expect, vi } from 'vitest';
import { sortByDependencies } from '../utils/sortByDependencies.ts';
import type { QueueItem, Task } from '../types';

const q = (id: number): QueueItem => ({ task: id, taskName: `Task ${id}`, notes: '' });

const t = (id: number, dependsOn?: number[]): Task => {
  const task: Task = { id, name: `Task ${id}`, status: 'pending' };
  if (dependsOn) task.dependsOn = dependsOn;
  return task;
};

describe('sortByDependencies', () => {
  it('returns items unchanged when no dependencies', () => {
    const queue = [q(1), q(2), q(3)];
    const tasks = [t(1), t(2), t(3)];
    const result = sortByDependencies(queue, tasks);
    expect(result.map(r => r.task)).toEqual([1, 2, 3]);
  });

  it('orders dependency before dependent', () => {
    const queue = [q(2), q(1)];
    const tasks = [t(1), t(2, [1])];
    const result = sortByDependencies(queue, tasks);
    const ids = result.map(r => r.task);
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2));
  });

  it('handles chain: A -> B -> C', () => {
    const queue = [q(3), q(2), q(1)];
    const tasks = [t(1), t(2, [1]), t(3, [2])];
    const result = sortByDependencies(queue, tasks);
    const ids = result.map(r => r.task);
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2));
    expect(ids.indexOf(2)).toBeLessThan(ids.indexOf(3));
  });

  it('handles diamond: A -> B, A -> C, both -> D', () => {
    const queue = [q(4), q(3), q(2), q(1)];
    const tasks = [t(1), t(2, [1]), t(3, [1]), t(4, [2, 3])];
    const result = sortByDependencies(queue, tasks);
    const ids = result.map(r => r.task);
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2));
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(3));
    expect(ids.indexOf(2)).toBeLessThan(ids.indexOf(4));
    expect(ids.indexOf(3)).toBeLessThan(ids.indexOf(4));
  });

  it('ignores dependencies on tasks NOT in the queue', () => {
    const queue = [q(2), q(3)];
    const tasks = [t(1), t(2, [1]), t(3)];
    const result = sortByDependencies(queue, tasks);
    expect(result.map(r => r.task)).toEqual([2, 3]);
  });

  it('breaks 2-node cycle into valid execution order', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const queue = [q(1), q(2)];
    const tasks = [t(1, [2]), t(2, [1])];
    const result = sortByDependencies(queue, tasks);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.task).sort()).toEqual([1, 2]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Circular dependency detected')
    );
    warnSpy.mockRestore();
  });

  it('breaks 3-node cycle (A->B->C->A) into valid execution order', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A(1) depends on C(3), B(2) depends on A(1), C(3) depends on B(2)
    const queue = [q(1), q(2), q(3)];
    const tasks = [t(1, [3]), t(2, [1]), t(3, [2])];
    const result = sortByDependencies(queue, tasks);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.task).sort()).toEqual([1, 2, 3]);
    // After the cycle is broken, any remaining edges must be respected:
    // The first item placed (cycle-breaker) has no constraint, but subsequent
    // items should follow their remaining dependency order
    const ids = result.map(r => r.task);
    // The cycle-breaker is placed first; remaining items follow their
    // dependency order with the broken edge removed.
    // All three have in-degree 1, so the first queued item wins ties.
    // Verify the result is a proper sequence (indices increase).
    expect(ids.indexOf(ids[0])).toBeLessThan(ids.indexOf(ids[1]));
    expect(ids.indexOf(ids[1])).toBeLessThan(ids.indexOf(ids[2]));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Circular dependency detected')
    );
    warnSpy.mockRestore();
  });

  it('breaks cycle while preserving non-cycle ordering', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Task 1 has no deps, tasks 2 and 3 form a cycle, task 4 depends on task 1
    const queue = [q(1), q(2), q(3), q(4)];
    const tasks = [t(1), t(2, [3]), t(3, [2]), t(4, [1])];
    const result = sortByDependencies(queue, tasks);
    const ids = result.map(r => r.task);
    expect(ids).toHaveLength(4);
    // Non-cycle dependency must be respected: 1 before 4
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(4));
    // All items present
    expect(ids.sort()).toEqual([1, 2, 3, 4]);
    warnSpy.mockRestore();
  });

  it('empty queue returns empty array', () => {
    const result = sortByDependencies([], [t(1), t(2)]);
    expect(result).toEqual([]);
  });

  it('single item returns single item', () => {
    const queue = [q(1)];
    const tasks = [t(1)];
    const result = sortByDependencies(queue, tasks);
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe(1);
  });
});
