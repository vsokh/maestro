import type { StateData, Task, Activity, ProgressEntry } from '../types.js';
import { validateProgress } from './validate.js';

export interface MergeResult {
  data: StateData;
  needsWrite: boolean;
  hasChanges: boolean;
  completedTaskIds: number[];
  arrangeCompleted: boolean;
  staleProgressIds: (string | number)[];
}

/**
 * Merges progress file entries into state data.
 * Pure function — takes state + progress entries, returns new state.
 */
export function mergeProgressIntoState(
  stateData: StateData,
  progressEntries: Record<string | number, ProgressEntry>,
): MergeResult {
  if (Object.keys(progressEntries).length === 0) {
    return { data: stateData, needsWrite: false, hasChanges: false, completedTaskIds: [], arrangeCompleted: false, staleProgressIds: [] };
  }

  const tasks: Task[] = [...(stateData.tasks || [])];
  const activity: Activity[] = [...(stateData.activity || [])];
  let queue = [...(stateData.queue || [])];
  let needsWrite = false;
  let hasChanges = false;
  const completedTaskIds: number[] = [];
  const staleProgressIds: (string | number)[] = [];
  let arrangeCompleted = false;

  for (const [taskId, rawProg] of Object.entries(progressEntries)) {
    // Special case: arrange has its own shape (taskUpdates, changes, label)
    if (taskId === 'arrange') {
      if (rawProg.status === 'done') {
        const arrangeActivity: Activity = {
          id: 'act_' + Date.now() + '_arrange',
          time: Date.now(),
          label: rawProg.label || 'Tasks arranged into dependency graph',
        };
        if (rawProg.changes) arrangeActivity.changes = rawProg.changes;
        activity.unshift(arrangeActivity);
        // Apply task updates from arrange (dependsOn, group changes)
        if (rawProg.taskUpdates) {
          const existingIds = new Set(tasks.map(t => t.id));
          for (const [tid, updates] of Object.entries(rawProg.taskUpdates)) {
            const tIdx = tasks.findIndex(t => t.id === Number(tid));
            if (tIdx !== -1) {
              const safeUpdates: Partial<Pick<Task, 'dependsOn' | 'group'>> = {};
              const u = updates as Record<string, unknown>;
              if (typeof u.group === 'string') safeUpdates.group = u.group;
              if (Array.isArray(u.dependsOn)) {
                const validDeps = u.dependsOn.filter((d): d is number => typeof d === 'number' && isFinite(d) && existingIds.has(d));
                if (validDeps.length > 0) safeUpdates.dependsOn = validDeps;
              }
              tasks[tIdx] = { ...tasks[tIdx], ...safeUpdates };
            }
          }
        }
        arrangeCompleted = true;
        needsWrite = true;
        hasChanges = true;
      }
      continue;
    }

    // Validate progress entry at the boundary
    const prog = validateProgress(rawProg);
    if (!prog) {
      staleProgressIds.push(taskId);
      console.warn(`[sync] Invalid progress entry for task ${taskId} — skipping`);
      continue;
    }

    const id = Number(taskId);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) {
      staleProgressIds.push(id);
      console.warn(`[sync] Progress entry references unknown task ID: ${id}`);
      continue;
    }

    if (prog.status === 'done') {
      tasks[idx] = {
        ...tasks[idx],
        status: 'done',
        completedAt: prog.completedAt || new Date().toISOString(),
        commitRef: prog.commitRef || tasks[idx].commitRef || undefined,
        branch: prog.branch || tasks[idx].branch || undefined,
        summary: prog.summary || tasks[idx].summary || undefined,
        progress: undefined,
      };
      queue = queue.filter(q => q.task !== id);
      const actEntry: Activity = {
        id: 'act_' + Date.now() + '_' + id,
        time: Date.now(),
        label: (tasks[idx].name || 'Task ' + id) + ' completed',
        taskId: id,
      };
      if (prog.commitRef) actEntry.commitRef = prog.commitRef;
      if (prog.filesChanged) actEntry.filesChanged = prog.filesChanged;
      if (prog.summary) actEntry.changes = [prog.summary];
      activity.unshift(actEntry);
      completedTaskIds.push(id);
      needsWrite = true;
    } else {
      // Skip stale progress for tasks already marked done
      if (tasks[idx].status === 'done') {
        staleProgressIds.push(id);
        continue;
      }
      const enriched: { status: Task['status']; progress: string | undefined; startedAt?: string } = {
        status: prog.status || tasks[idx].status,
        progress: prog.progress || tasks[idx].progress,
      };
      if (prog.status === 'in-progress') {
        if (!tasks[idx].startedAt) {
          enriched.startedAt = new Date().toISOString();
        }
      }
      tasks[idx] = { ...tasks[idx], ...enriched };
      hasChanges = true;
    }
  }

  const truncatedActivity = activity.slice(0, 20);
  if (activity.length > 20) {
    console.warn(`[sync] Activity log truncated: ${activity.length} entries → 20 (${activity.length - 20} dropped)`);
  }

  return {
    data: { ...stateData, tasks, activity: truncatedActivity, queue },
    needsWrite,
    hasChanges: hasChanges || needsWrite,
    completedTaskIds,
    arrangeCompleted,
    staleProgressIds,
  };
}

/**
 * Protects done tasks from regression by external state writes.
 * If incoming state has a task that was "done" locally but isn't "done" in the incoming state,
 * patches the incoming state to preserve the done status.
 * Returns a new StateData (does not mutate input).
 */
export function protectDoneTaskRegression(currentState: StateData, incomingState: StateData): StateData {
  const doneTasks = new Map(
    currentState.tasks.filter(t => t.status === 'done' && t.completedAt).map(t => [t.id, t])
  );

  if (doneTasks.size === 0) return incomingState;

  let patched = false;
  const tasks = incomingState.tasks.map(task => {
    if (task.status !== 'done' && doneTasks.has(task.id)) {
      const doneTask = doneTasks.get(task.id)!;
      patched = true;
      return {
        ...task,
        status: 'done' as const,
        completedAt: doneTask.completedAt,
        commitRef: doneTask.commitRef || task.commitRef,
        summary: doneTask.summary || task.summary,
        progress: undefined,
      };
    }
    return task;
  });

  if (!patched) return incomingState;

  const queue = (incomingState.queue || []).filter(q => !doneTasks.has(q.task));
  console.warn('[sync] Prevented done-task regression from external state write');
  return { ...incomingState, tasks, queue };
}
