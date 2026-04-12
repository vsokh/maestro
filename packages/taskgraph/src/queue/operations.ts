import type { StateData, Task, QueueItem } from '../types.js';
import { sortByDependencies } from './sort.js';
import { createActivityList } from '../tasks/activity.js';
import { getUnqueuedTasks } from '../tasks/filters.js';

export interface QueueResult {
  state: StateData;
  changed: boolean;
}

export function addToQueue(state: StateData, taskId: number): QueueResult {
  const tasks = state.tasks || [];
  const queue = state.queue || [];
  const taskNotes = state.taskNotes || {};

  const task = tasks.find(t => t.id === taskId);
  if (!task) return { state, changed: false };
  if (queue.some(q => q.task === taskId)) return { state, changed: false };

  const unsorted = [...queue, {
    task: task.id,
    taskName: task.name,
    notes: taskNotes[task.id] || '',
  }];
  const newQueue = sortByDependencies(unsorted, tasks);
  const activity = createActivityList(task.name + ' queued', state.activity || [], task.id);
  return { state: { ...state, queue: newQueue, activity }, changed: true };
}

export function queueAll(state: StateData): QueueResult {
  const tasks = state.tasks || [];
  const queue = state.queue || [];
  const taskNotes = state.taskNotes || {};

  const pending = getUnqueuedTasks(tasks, queue);
  if (pending.length === 0) return { state, changed: false };

  const unsorted = [...queue, ...pending.map(t => ({
    task: t.id,
    taskName: t.name,
    notes: taskNotes[t.id] || '',
  }))];
  const newQueue = sortByDependencies(unsorted, tasks);
  const activity = createActivityList(pending.length + ' tasks queued', state.activity || []);
  return { state: { ...state, queue: newQueue, activity }, changed: true };
}

export function queueGroup(state: StateData, groupName: string): QueueResult {
  const tasks = state.tasks || [];
  const queue = state.queue || [];
  const taskNotes = state.taskNotes || {};

  const pending = getUnqueuedTasks(tasks.filter(t => t.group === groupName), queue);
  if (pending.length === 0) return { state, changed: false };

  const unsorted = [...queue, ...pending.map(t => ({
    task: t.id,
    taskName: t.name,
    notes: taskNotes[t.id] || '',
  }))];
  const newQueue = sortByDependencies(unsorted, tasks);
  const activity = createActivityList(pending.length + ' ' + groupName + ' tasks queued', state.activity || []);
  return { state: { ...state, queue: newQueue, activity }, changed: true };
}

export function removeFromQueue(state: StateData, taskId: number): QueueResult {
  const tasks = state.tasks || [];
  const queue = state.queue || [];

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const queueIds = new Set(queue.map(q => q.task));
  const removed = new Set<number>();
  const toRemove = [taskId];

  while (toRemove.length > 0) {
    const id = toRemove.pop()!;
    if (removed.has(id)) continue;
    removed.add(id);
    for (const qId of queueIds) {
      if (removed.has(qId)) continue;
      const task = taskMap.get(qId);
      if (task?.dependsOn?.includes(id)) {
        toRemove.push(qId);
      }
    }
  }

  const newQueue = queue.filter(q => !removed.has(q.task));
  return { state: { ...state, queue: newQueue }, changed: removed.size > 0 };
}

export function clearQueue(state: StateData): QueueResult {
  const queue = state.queue || [];
  if (queue.length === 0) return { state, changed: false };
  return { state: { ...state, queue: [] }, changed: true };
}
