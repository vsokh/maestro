import { describe, it, expect } from 'vitest';
import { addToQueue, queueAll, queueGroup, removeFromQueue, clearQueue } from '../src/queue/operations.js';
import type { StateData, Task } from '../src/types.js';

function makeState(overrides: Partial<StateData> = {}): StateData {
  return {
    project: 'test',
    tasks: [
      { id: 1, name: 'Task 1', status: 'pending' },
      { id: 2, name: 'Task 2', status: 'pending', group: 'Auth' },
      { id: 3, name: 'Task 3', status: 'pending', group: 'Auth', dependsOn: [2] },
      { id: 4, name: 'Task 4', status: 'done' },
    ],
    queue: [],
    taskNotes: { '1': 'Some notes' },
    activity: [],
    ...overrides,
  };
}

describe('addToQueue', () => {
  it('adds task to queue', () => {
    const result = addToQueue(makeState(), 1);
    expect(result.changed).toBe(true);
    expect(result.state.queue).toHaveLength(1);
    expect(result.state.queue[0].task).toBe(1);
    expect(result.state.queue[0].notes).toBe('Some notes');
  });

  it('does nothing for already-queued task', () => {
    const state = makeState({ queue: [{ task: 1, taskName: 'Task 1' }] });
    const result = addToQueue(state, 1);
    expect(result.changed).toBe(false);
  });

  it('does nothing for missing task', () => {
    const result = addToQueue(makeState(), 999);
    expect(result.changed).toBe(false);
  });
});

describe('queueAll', () => {
  it('queues all pending tasks', () => {
    const result = queueAll(makeState());
    expect(result.changed).toBe(true);
    expect(result.state.queue.length).toBe(3); // tasks 1,2,3 (not 4 which is done)
  });

  it('does nothing when all tasks queued or done', () => {
    const state = makeState({
      queue: [
        { task: 1, taskName: 'Task 1' },
        { task: 2, taskName: 'Task 2' },
        { task: 3, taskName: 'Task 3' },
      ],
    });
    const result = queueAll(state);
    expect(result.changed).toBe(false);
  });
});

describe('queueGroup', () => {
  it('queues tasks from a specific group', () => {
    const result = queueGroup(makeState(), 'Auth');
    expect(result.changed).toBe(true);
    expect(result.state.queue.length).toBe(2); // tasks 2,3
  });

  it('does nothing for empty group', () => {
    const result = queueGroup(makeState(), 'NonExistent');
    expect(result.changed).toBe(false);
  });
});

describe('removeFromQueue', () => {
  it('removes task and cascades dependents', () => {
    const state = makeState({
      queue: [
        { task: 2, taskName: 'Task 2' },
        { task: 3, taskName: 'Task 3' },
      ],
    });
    const result = removeFromQueue(state, 2);
    expect(result.changed).toBe(true);
    expect(result.state.queue).toHaveLength(0); // task 3 depends on 2
  });

  it('removes only the target when no dependents', () => {
    const state = makeState({
      queue: [
        { task: 1, taskName: 'Task 1' },
        { task: 2, taskName: 'Task 2' },
      ],
    });
    const result = removeFromQueue(state, 1);
    expect(result.changed).toBe(true);
    expect(result.state.queue).toHaveLength(1);
    expect(result.state.queue[0].task).toBe(2);
  });
});

describe('clearQueue', () => {
  it('clears all items', () => {
    const state = makeState({ queue: [{ task: 1, taskName: 'Task 1' }] });
    const result = clearQueue(state);
    expect(result.changed).toBe(true);
    expect(result.state.queue).toHaveLength(0);
  });

  it('returns unchanged for empty queue', () => {
    const result = clearQueue(makeState());
    expect(result.changed).toBe(false);
  });
});
