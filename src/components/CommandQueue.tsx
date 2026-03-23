import React, { useMemo } from 'react';
import { computePhases } from '../utils/computePhases.ts';
import {
  QUEUE_LAUNCH_ALL, QUEUE_UNAPPROVE_ALL, QUEUE_APPROVE_ALL,
  QUEUE_UNQUEUE_ALL, QUEUE_EMPTY,
} from '../constants/strings.ts';
import type { Task, QueueItem } from '../types';
import { itemKey, cmdForItem, getRowClass, getItemStatus, isAllAutoApproved } from './queue/queueItemUtils.ts';
import { QueueItemContent } from './queue/QueueItemContent.tsx';
import { PhaseView } from './queue/PhaseView.tsx';

interface CommandQueueProps {
  queue: QueueItem[];
  tasks: Task[];
  onLaunch: (key: number, cmd: string, taskName: string) => void;
  onLaunchPhase: (items: { key: number; cmd: string; taskName: string }[]) => void;
  onRemove: (key: number) => void;
  onClear: () => void;
  onQueueAll: () => void;
  onPauseTask: (id: number) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  onBatchUpdateTasks: (updates: Array<{ id: number; updates: Partial<Task> }>) => void;
  launchedId: number | null;
  defaultEngine?: string;
}

export function CommandQueue({ queue, tasks, onLaunch, onLaunchPhase, onRemove, onClear, onQueueAll: _onQueueAll, onPauseTask, onUpdateTask, onBatchUpdateTasks, launchedId, defaultEngine }: CommandQueueProps) {
  const taskMap = useMemo(() => new Map((tasks || []).map(t => [t.id, t])), [tasks]);
  const phases = useMemo(() => computePhases(queue, tasks), [queue, tasks]);

  const renderFlatList = () => (
    <div>
      {queue.map(item => (
        <div key={itemKey(item)} className={getRowClass(getItemStatus(item, taskMap))} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px',
        }}>
          <QueueItemContent
            item={item}
            task={taskMap.get(item.task)}
            launchedId={launchedId}
            onLaunch={onLaunch}
            onPauseTask={onPauseTask}
            onRemove={onRemove}
            onUpdateTask={onUpdateTask}
            taskMap={taskMap}
            defaultEngine={defaultEngine}
          />
        </div>
      ))}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        {queue.length > 1 && onLaunchPhase ? (
          <button onClick={() => onLaunchPhase(queue.map(item => ({
            key: itemKey(item),
            cmd: cmdForItem(item),
            taskName: item.taskName,
          })))} className="btn btn-accent-outline btn-xs" style={{
            padding: '4px 10px', borderRadius: 'var(--dm-radius-sm)',
          }}>{QUEUE_LAUNCH_ALL}</button>
        ) : null}
        <button
          onClick={() => {
            const nonManual = queue.filter(item => !taskMap.get(item.task)?.manual);
            const allApproved = isAllAutoApproved(queue, taskMap);
            onBatchUpdateTasks(nonManual.map(item => ({ id: item.task, updates: { autoApprove: allApproved ? undefined : true } })));
          }}
          className="btn btn-secondary btn-xs"
          style={{
            padding: '4px 10px',
            color: isAllAutoApproved(queue, taskMap) ? 'var(--dm-success)' : undefined,
          }}
        >{isAllAutoApproved(queue, taskMap) ? QUEUE_UNAPPROVE_ALL : QUEUE_APPROVE_ALL}</button>
        <button onClick={onClear} className="btn btn-secondary btn-xs" style={{
          padding: '4px 10px',
        }}>{QUEUE_UNQUEUE_ALL}</button>
      </div>
    </div>
  );

  return (
    <div>
      {queue.length === 0 ? (
        <div className="empty-state-sm" style={{
          padding: '20px 16px', lineHeight: 1.6,
        }}>
          {QUEUE_EMPTY}
        </div>
      ) : phases ? (
        <PhaseView
          phases={phases}
          queue={queue}
          taskMap={taskMap}
          launchedId={launchedId}
          onLaunch={onLaunch}
          onLaunchPhase={onLaunchPhase}
          onRemove={onRemove}
          onPauseTask={onPauseTask}
          onUpdateTask={onUpdateTask}
          onBatchUpdateTasks={onBatchUpdateTasks}
          onClear={onClear}
          defaultEngine={defaultEngine}
        />
      ) : renderFlatList()}
    </div>
  );
}
