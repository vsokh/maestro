import { STATUS } from '../constants.js';
import type { Task, QueueItem } from '../types.js';

/** Tasks that are not done and not backlog (i.e. active/pending work) */
export function getActiveTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.status !== STATUS.DONE && t.status !== STATUS.BACKLOG);
}

/** Done tasks */
export function getDoneTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.status === STATUS.DONE);
}

/** Backlog tasks */
export function getBacklogTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.status === STATUS.BACKLOG);
}

/** Pending or paused tasks not already in the queue */
export function getUnqueuedTasks(tasks: Task[], queue: QueueItem[]): Task[] {
  return tasks.filter(t =>
    (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) &&
    !queue.some(q => q.task === t.id)
  );
}

/** Unique group names from tasks */
export function getAllGroups(tasks: Task[]): string[] {
  return [...new Set(tasks.map(t => t.group).filter(Boolean))] as string[];
}
