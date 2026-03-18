import { PAUSED_COLOR } from '../../constants/colors.ts';
import { STATUS } from '../../constants/statuses.ts';
import type { Task, QueueItem } from '../../types';

export type ItemStatus = 'queued' | 'paused' | 'waiting' | 'working';

export function itemKey(item: QueueItem): number {
  return item.task;
}

export function cmdForItem(item: QueueItem): string {
  return '/orchestrator task ' + item.task;
}

export function getItemStatus(item: QueueItem, taskMap: Map<number, Task>): ItemStatus {
  const task = taskMap.get(item.task);
  if (!task) return 'queued';
  if (task.status === STATUS.PAUSED) return 'paused';
  if (task.status !== STATUS.IN_PROGRESS) return 'queued';
  const p = (task.progress || '').toLowerCase();
  return /waiting|approval|planning/.test(p) ? 'waiting' : 'working';
}

export function getButtonStyle(
  item: QueueItem,
  taskMap: Map<number, Task>,
  launchedId: number | null
): { bg: string; icon: string } {
  const status = getItemStatus(item, taskMap);
  const isLaunched = launchedId === itemKey(item);
  if (isLaunched) return { bg: 'var(--dm-success)', icon: '\u2713' };
  if (status === 'paused') return { bg: PAUSED_COLOR, icon: '\u25B6' };
  if (status === 'waiting') return { bg: 'var(--dm-amber)', icon: '\u25CF' };
  if (status === 'working') return { bg: 'var(--dm-accent)', icon: '\u25CF' };
  return { bg: 'var(--dm-accent)', icon: '\u25B6' };
}

export function getRowClass(status: ItemStatus): string {
  if (status === 'waiting') return 'queue-item queue-item--active-waiting';
  if (status === 'working') return 'queue-item queue-item--active-working';
  if (status === 'paused') return 'queue-item queue-item--paused';
  return 'queue-item';
}

export function isAllAutoApproved(items: QueueItem[], taskMap: Map<number, Task>): boolean {
  const nonManual = items.filter(item => !taskMap.get(item.task)?.manual);
  return nonManual.length > 0 && nonManual.every(item => taskMap.get(item.task)?.autoApprove);
}
