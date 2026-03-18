import type { QueueItem, Task } from '../types';

export function sortByDependencies(queueItems: QueueItem[], allTasks: Task[]): QueueItem[] {
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const queueIds = new Set(queueItems.map(q => q.task));

  const inDegree = new Map<number, number>();
  const edges = new Map<number, number[]>();
  for (const item of queueItems) {
    inDegree.set(item.task, 0);
    edges.set(item.task, []);
  }
  for (const item of queueItems) {
    const task = taskMap.get(item.task);
    if (task && task.dependsOn) {
      for (const depId of task.dependsOn) {
        if (queueIds.has(depId)) {
          edges.get(depId)!.push(item.task);
          inDegree.set(item.task, (inDegree.get(item.task) || 0) + 1);
        }
      }
    }
  }

  const result: QueueItem[] = [];
  const ready = queueItems.filter(q => (inDegree.get(q.task) || 0) === 0).map(q => q.task);
  const itemMap = new Map(queueItems.map(q => [q.task, q]));
  while (ready.length > 0) {
    const id = ready.shift()!;
    result.push(itemMap.get(id)!);
    for (const next of (edges.get(id) || [])) {
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0) ready.push(next);
    }
  }
  for (const item of queueItems) {
    if (!result.includes(item)) result.push(item);
  }
  return result;
}

export default sortByDependencies;
