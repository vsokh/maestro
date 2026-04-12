import type { StateData, Task, QueueItem, Activity, Epic, Feature, ProgressEntry } from '../types.js';
import { TASK_STATUSES } from '../types.js';

const VALID_PROGRESS_STATUSES = ['in-progress', 'done', 'paused'] as const;

/**
 * Sanitizing validator: returns a clean StateData or null if invalid.
 * Strips invalid tasks, queue items, etc. rather than rejecting outright.
 */
export function validateState(data: unknown): StateData | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const d = data as Record<string, unknown>;

  const tasks: Task[] = Array.isArray(d.tasks)
    ? (d.tasks as unknown[]).filter((t): t is Task =>
        !!t && typeof t === 'object' && !Array.isArray(t) &&
        typeof (t as Record<string, unknown>).id === 'number' && isFinite((t as Record<string, unknown>).id as number) &&
        typeof (t as Record<string, unknown>).name === 'string' &&
        typeof (t as Record<string, unknown>).status === 'string' &&
        (TASK_STATUSES as readonly string[]).includes((t as Record<string, unknown>).status as string)
      ).map(t => {
        if ('dependsOn' in t) {
          if (Array.isArray(t.dependsOn)) {
            const clean = (t.dependsOn as unknown[]).filter(dep => typeof dep === 'number' && isFinite(dep as number));
            return { ...t, dependsOn: clean.length > 0 ? clean as number[] : undefined };
          }
          const { dependsOn: _, ...rest } = t;
          return rest as Task;
        }
        return t;
      })
    : [];

  const queue: QueueItem[] = Array.isArray(d.queue)
    ? (d.queue as unknown[]).filter((q): q is QueueItem =>
        !!q && typeof q === 'object' && !Array.isArray(q) &&
        typeof (q as Record<string, unknown>).task === 'number' && isFinite((q as Record<string, unknown>).task as number)
      )
    : [];

  const taskIds = new Set(tasks.map(t => t.id));
  const validQueue = queue.filter(q => taskIds.has(q.task));

  const activity: Activity[] = Array.isArray(d.activity) ? d.activity as Activity[] : [];
  const taskNotes: Record<string, string> = (d.taskNotes && typeof d.taskNotes === 'object' && !Array.isArray(d.taskNotes))
    ? d.taskNotes as Record<string, string>
    : {};
  const epics: Epic[] = Array.isArray(d.epics) ? d.epics as Epic[] : [];
  const features: Feature[] = Array.isArray(d.features) ? d.features as Feature[] : [];

  return {
    savedAt: typeof d.savedAt === 'string' ? d.savedAt : undefined,
    _v: typeof d._v === 'number' ? d._v : undefined,
    project: typeof d.project === 'string' ? d.project : '',
    tasks,
    queue: validQueue,
    activity,
    taskNotes,
    epics,
    features,
    defaultEngine: typeof d.defaultEngine === 'string' ? d.defaultEngine : undefined,
    scratchpad: typeof d.scratchpad === 'string' ? d.scratchpad : undefined,
  } satisfies StateData;
}

/**
 * Sanitizing validator for progress entries.
 * Returns a clean ProgressEntry or null if invalid.
 */
export function validateProgress(data: unknown): ProgressEntry | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const d = data as Record<string, unknown>;

  if (typeof d.status !== 'string' || !(VALID_PROGRESS_STATUSES as readonly string[]).includes(d.status)) {
    return null;
  }

  const entry: ProgressEntry = { status: d.status as ProgressEntry['status'] };
  if (typeof d.progress === 'string') entry.progress = d.progress;
  if (typeof d.completedAt === 'string') entry.completedAt = d.completedAt;
  if (typeof d.commitRef === 'string') entry.commitRef = d.commitRef;
  if (typeof d.branch === 'string') entry.branch = d.branch;
  if (typeof d.label === 'string') entry.label = d.label;
  if (typeof d.filesChanged === 'number') entry.filesChanged = d.filesChanged;
  if (typeof d.summary === 'string') entry.summary = d.summary;
  if (Array.isArray(d.changes)) entry.changes = d.changes.filter((c): c is string => typeof c === 'string');
  if (d.taskUpdates && typeof d.taskUpdates === 'object' && !Array.isArray(d.taskUpdates)) {
    entry.taskUpdates = d.taskUpdates as ProgressEntry['taskUpdates'];
  }
  return entry;
}

/**
 * Boolean structure check for state data.
 * Used by server PUT /api/state to reject malformed writes.
 */
export function validateStateStructure(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.tasks)) return false;

  for (const task of d.tasks as Record<string, unknown>[]) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) return false;
    if (typeof task.id !== 'number' || !isFinite(task.id)) return false;
    if (typeof task.name !== 'string') return false;
    if (typeof task.status !== 'string') return false;
  }

  if (d.queue !== undefined && !Array.isArray(d.queue)) return false;
  if (d.activity !== undefined && !Array.isArray(d.activity)) return false;
  if (d.epics !== undefined && !Array.isArray(d.epics)) return false;

  return true;
}

/**
 * Error-reporting validator. Returns detailed error messages.
 */
export function validateStateStrict(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['State must be an object'] };
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.tasks)) {
    errors.push('tasks must be an array');
  } else {
    const ids = new Set<number>();
    (d.tasks as Record<string, unknown>[]).forEach((t, i) => {
      if (typeof t.id !== 'number') errors.push(`tasks[${i}].id must be a number`);
      if (typeof t.name !== 'string' || !t.name) errors.push(`tasks[${i}].name must be a non-empty string`);
      if (ids.has(t.id as number)) errors.push(`Duplicate task id: ${t.id}`);
      ids.add(t.id as number);
      if (t.dependsOn !== undefined && !Array.isArray(t.dependsOn)) {
        errors.push(`tasks[${i}].dependsOn must be an array`);
      }
      if (Array.isArray(t.dependsOn)) {
        (t.dependsOn as unknown[]).forEach(dep => {
          if (typeof dep !== 'number') errors.push(`tasks[${i}].dependsOn contains non-number: ${dep}`);
        });
      }
      if (t.status !== undefined) {
        if (!(TASK_STATUSES as readonly string[]).includes(t.status as string)) errors.push(`tasks[${i}].status "${t.status}" is not valid`);
      }
    });
  }

  if (d.queue !== undefined && !Array.isArray(d.queue)) {
    errors.push('queue must be an array');
  } else if (Array.isArray(d.queue)) {
    (d.queue as Record<string, unknown>[]).forEach((q, i) => {
      if (typeof q.task !== 'number') errors.push(`queue[${i}].task must be a number`);
      if (typeof q.taskName !== 'string') errors.push(`queue[${i}].taskName must be a string`);
    });
  }

  if (d.activity !== undefined && !Array.isArray(d.activity)) {
    errors.push('activity must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Fixes inconsistent task states (e.g., completedAt set but status not "done").
 * Returns a new tasks array and whether any fixes were applied.
 * Pure function — does not mutate input.
 */
export function fixInconsistentTasks(tasks: Task[]): { tasks: Task[]; fixed: boolean } {
  let fixed = false;
  const result = tasks.map(task => {
    let t = task;

    if (t.completedAt && t.status !== 'done') {
      console.warn(`[validate] Task ${t.id} ("${t.name}"): has completedAt but status="${t.status}" — fixing to "done"`);
      t = { ...t, status: 'done' };
      fixed = true;
    }

    if (t.commitRef && t.status !== 'done') {
      console.warn(`[validate] Task ${t.id} ("${t.name}"): has commitRef but status="${t.status}" — fixing to "done"`);
      t = { ...t, status: 'done' };
      fixed = true;
    }

    if (t.status === 'done' && !t.completedAt) {
      const today = new Date().toISOString().split('T')[0];
      console.warn(`[validate] Task ${t.id} ("${t.name}"): status is "done" but no completedAt — setting to ${today}`);
      t = { ...t, completedAt: today };
      fixed = true;
    }

    return t;
  });

  if (fixed) {
    console.warn('[validate] Corrections applied in-memory (not written to disk)');
  }

  return { tasks: result, fixed };
}
