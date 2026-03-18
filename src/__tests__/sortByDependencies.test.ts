import { describe, it, expect } from 'vitest';
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

  it('handles cyclic dependencies (appends at end)', () => {
    const queue = [q(1), q(2)];
    const tasks = [t(1, [2]), t(2, [1])];
    const result = sortByDependencies(queue, tasks);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.task).sort()).toEqual([1, 2]);
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
