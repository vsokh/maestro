import type { QueueItem, Task } from '../types.js';

export function computePhases(queue: QueueItem[], tasks: Task[]): QueueItem[][] | null {
  const taskMap = new Map((tasks || []).map(t => [t.id, t]));
  const queueIds = new Set(queue.map(q => q.task));

  const hasDeps = queue.some(q => {
    const task = taskMap.get(q.task);
    return task && task.dependsOn && task.dependsOn.some(d => queueIds.has(d));
  });

  if (!hasDeps) return null;

  const assigned = new Map<number, number>();
  const phases: QueueItem[][] = [];

  let remaining = [...queue];
  let phaseNum = 0;
  while (remaining.length > 0) {
    phaseNum++;
    const thisPhase: QueueItem[] = [];
    const stillRemaining: QueueItem[] = [];

    for (const item of remaining) {
      const task = taskMap.get(item.task);
      const deps = (task && task.dependsOn) ? task.dependsOn.filter(d => queueIds.has(d)) : [];
      const allDepsAssigned = deps.every(d => assigned.has(d) && (assigned.get(d) as number) < phaseNum);
      if (allDepsAssigned) {
        thisPhase.push(item);
        assigned.set(item.task, phaseNum);
      } else {
        stillRemaining.push(item);
      }
    }

    if (thisPhase.length === 0) {
      const cycleIds = stillRemaining.map(item => item.task);
      console.warn(`[computePhases] Circular dependency detected among tasks: ${cycleIds.join(', ')}. Force-assigning to phase ${phaseNum}.`);
      for (const item of stillRemaining) {
        thisPhase.push(item);
        assigned.set(item.task, phaseNum);
      }
      stillRemaining.length = 0;
    }

    phases.push(thisPhase);
    remaining = stillRemaining;
  }

  return phases;
}
