import type { Activity } from '../types.js';
import { DEFAULT_ACTIVITY_LIMIT } from '../constants.js';

export function createActivityList(
  label: string,
  currentActivity: Activity[],
  taskId?: number,
  limit: number = DEFAULT_ACTIVITY_LIMIT,
): Activity[] {
  const entry: Activity = { id: 'act_' + Date.now(), time: Date.now(), label };
  if (taskId != null) entry.taskId = taskId;
  const full = [entry, ...currentActivity];
  if (full.length > limit) {
    console.warn(`[activity] Truncating activity log: ${full.length} entries → ${limit} (${full.length - limit} dropped)`);
  }
  return full.slice(0, limit);
}
