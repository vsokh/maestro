import { EPIC_PALETTE } from '../constants/colors.ts';
import { hashString } from './hash.ts';
import { STATUS } from '../constants/statuses.ts';
import type { Task, QueueItem, Epic, EpicColor } from '../types';

// Pure filter functions re-exported from engine
export {
  getActiveTasks,
  getDoneTasks,
  getBacklogTasks,
  getUnqueuedTasks,
  getAllGroups,
} from 'taskgraph';

// UI/color functions stay in product

/** Group tasks into a Map by their `group` field */
export function groupTasksBy(
  tasks: Task[],
  opts?: { defaultGroup?: string | null; hiddenEpics?: Set<string> }
): Map<string | null, Task[]> {
  const defaultGroup = opts?.defaultGroup ?? null;
  const hiddenEpics = opts?.hiddenEpics;
  const grouped = new Map<string | null, Task[]>();
  if (defaultGroup === null) grouped.set(null, []);
  for (const t of tasks) {
    const g = t.group || defaultGroup;
    if (hiddenEpics && g && hiddenEpics.has(g)) continue;
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(t);
  }
  // Remove empty null group
  if (defaultGroup === null && grouped.get(null)?.length === 0) grouped.delete(null);
  return grouped;
}

/** Build epic color map with collision avoidance */
export function getEpicColors(epics: Epic[], allGroups: string[]): Record<string, EpicColor> {
  const map: Record<string, EpicColor> = {};
  const usedIndices = new Set<number>();
  (epics || []).forEach(e => {
    const idx = (e.color != null ? e.color : hashString(e.name)) % EPIC_PALETTE.length;
    usedIndices.add(idx);
    map[e.name] = EPIC_PALETTE[idx];
  });
  allGroups.forEach(g => {
    if (!g || map[g]) return;
    let idx = hashString(g) % EPIC_PALETTE.length;
    let attempts = 0;
    while (usedIndices.has(idx) && attempts < EPIC_PALETTE.length) {
      idx = (idx + 1) % EPIC_PALETTE.length;
      attempts++;
    }
    usedIndices.add(idx);
    map[g] = EPIC_PALETTE[idx];
  });
  return map;
}

/** Simple epic color map without collision avoidance (for dropdowns, etc.) */
export function getEpicColorMap(epics: Epic[]): Record<string, EpicColor> {
  const map: Record<string, EpicColor> = {};
  (epics || []).forEach(e => {
    const idx = (e.color != null ? e.color : hashString(e.name)) % EPIC_PALETTE.length;
    map[e.name] = EPIC_PALETTE[idx];
  });
  return map;
}

/** Epic progress stats: total and done count per group */
export function getEpicStats(tasks: Task[], allGroups: string[]): Array<{ name: string; total: number; done: number }> {
  const stats = [];
  for (const g of allGroups) {
    const total = tasks.filter(t => t.group === g).length;
    const done = tasks.filter(t => t.group === g && t.status === STATUS.DONE).length;
    if (total > 0) stats.push({ name: g, total, done });
  }
  return stats;
}

/** Count of pending/active tasks for a given group (excludes done and backlog) */
export function getActiveCountForGroup(tasks: Task[], groupName: string): number {
  return tasks.filter(t => t.group === groupName && t.status !== STATUS.DONE && t.status !== STATUS.BACKLOG).length;
}

/** Epic group stats: total and done for a specific group */
export function getGroupStats(tasks: Task[], groupName: string): { total: number; done: number } {
  const total = tasks.filter(t => t.group === groupName).length;
  const done = tasks.filter(t => t.group === groupName && t.status === STATUS.DONE).length;
  return { total, done };
}
