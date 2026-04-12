import { describe, it, expect } from 'vitest';
import { addTask, updateTask, deleteTask, bulkDeleteTasks, renameGroup, deleteGroup, updateNotes } from '../src/tasks/operations.js';
import type { StateData } from '../src/types.js';

function makeState(overrides: Partial<StateData> = {}): StateData {
  return {
    project: 'test',
    tasks: [
      { id: 1, name: 'Task 1', status: 'pending', group: 'Core' },
      { id: 2, name: 'Task 2', status: 'pending', group: 'Core', dependsOn: [1] },
      { id: 3, name: 'Task 3', status: 'done', group: 'Auth' },
    ],
    queue: [{ task: 2, taskName: 'Task 2' }],
    taskNotes: { '1': 'Note for task 1' },
    activity: [],
    epics: [{ name: 'Core' }, { name: 'Auth' }],
    ...overrides,
  };
}

describe('addTask', () => {
  it('adds task with auto-incremented id', () => {
    const result = addTask(makeState(), { name: 'New Task', status: 'pending' });
    expect(result.tasks).toHaveLength(4);
    expect(result.tasks[3].id).toBe(4);
    expect(result.tasks[3].name).toBe('New Task');
    expect(result.tasks[3].createdAt).toBeTruthy();
  });
});

describe('updateTask', () => {
  it('updates task fields', () => {
    const result = updateTask(makeState(), 1, { name: 'Renamed' });
    expect(result.tasks.find(t => t.id === 1)!.name).toBe('Renamed');
  });

  it('tracks status history', () => {
    const result = updateTask(makeState(), 1, { status: 'in-progress' });
    const task = result.tasks.find(t => t.id === 1)!;
    expect(task.history).toBeDefined();
    expect(task.history!.length).toBeGreaterThan(0);
    expect(task.history!.at(-1)!.status).toBe('in-progress');
  });
});

describe('updateNotes', () => {
  it('updates task notes', () => {
    const result = updateNotes(makeState(), 1, 'Updated note');
    expect(result.taskNotes['1']).toBe('Updated note');
  });
});

describe('deleteTask', () => {
  it('removes task and cleans dependencies', () => {
    const result = deleteTask(makeState(), 1);
    expect(result.tasks.find(t => t.id === 1)).toBeUndefined();
    expect(result.tasks.find(t => t.id === 2)!.dependsOn).toEqual([]);
    expect(result.taskNotes['1']).toBeUndefined();
  });
});

describe('bulkDeleteTasks', () => {
  it('removes multiple tasks', () => {
    const result = bulkDeleteTasks(makeState(), [1, 2]);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe(3);
    expect(result.queue).toHaveLength(0);
  });
});

describe('renameGroup', () => {
  it('renames group on tasks and epics', () => {
    const result = renameGroup(makeState(), 'Core', 'Engine');
    expect(result.tasks.filter(t => t.group === 'Engine')).toHaveLength(2);
    expect(result.tasks.filter(t => t.group === 'Core')).toHaveLength(0);
    expect(result.epics!.find(e => e.name === 'Engine')).toBeTruthy();
  });
});

describe('deleteGroup', () => {
  it('removes group, its tasks, and cleans deps', () => {
    const result = deleteGroup(makeState(), 'Core');
    expect(result.tasks).toHaveLength(1); // only Auth task remains
    expect(result.tasks[0].id).toBe(3);
    expect(result.epics!.find(e => e.name === 'Core')).toBeUndefined();
    expect(result.queue).toHaveLength(0);
    expect(result.taskNotes['1']).toBeUndefined();
  });
});
