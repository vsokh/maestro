import React from 'react';
import type { Task, QueueItem } from '../../types';
import { itemKey, cmdForItem, getItemStatus, getButtonStyle, type ItemStatus } from './queueItemUtils.ts';
import {
  QUEUE_MANUAL_TITLE, QUEUE_MANUAL_YOU, QUEUE_LAUNCH_ARIA, QUEUE_LAUNCH_RESUME,
  QUEUE_LAUNCH_TERMINAL, QUEUE_LAUNCH_SET_PATH, QUEUE_AUTO_APPROVED, QUEUE_CLICK_APPROVE,
  QUEUE_PAUSED_DEFAULT, QUEUE_PAUSE_ARIA, QUEUE_PAUSE_TITLE, QUEUE_REMOVE_ARIA,
  QUEUE_REMOVE_TITLE,
} from '../../constants/strings.ts';

interface QueueItemContentProps {
  item: QueueItem;
  task: Task | undefined;
  launchedId: number | null;
  onLaunch: (key: number, cmd: string, taskName: string) => void;
  onPauseTask: (id: number) => void;
  onRemove: (key: number) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  projectPath: string;
  taskMap: Map<number, Task>;
  variant?: 'flat' | 'phase';
}

export function QueueItemContent({ item, task, launchedId, onLaunch, onPauseTask, onRemove, onUpdateTask, projectPath, taskMap, variant = 'flat' }: QueueItemContentProps) {
  const key = itemKey(item);
  const isLaunched = launchedId === key;
  const status: ItemStatus = getItemStatus(item, taskMap);
  const btn = getButtonStyle(item, taskMap, launchedId);
  const isManual = task?.manual;
  const isActive = status === 'waiting' || status === 'working';
  const isPaused = status === 'paused';

  return (
    <>
      {isManual ? (
        variant === 'phase' ? (
          <span title={QUEUE_MANUAL_YOU} style={{
            padding: '4px 8px', fontSize: '12px', flexShrink: 0, lineHeight: 1,
          }}>&#9997;</span>
        ) : (
          <span className="manual-badge" title={QUEUE_MANUAL_TITLE} style={{
            padding: '3px 6px', flexShrink: 0,
          }}>YOU</span>
        )
      ) : (
        <button
          onClick={() => onLaunch(key, cmdForItem(item), item.taskName)}
          aria-label={QUEUE_LAUNCH_ARIA}
          title={isPaused ? QUEUE_LAUNCH_RESUME : projectPath ? QUEUE_LAUNCH_TERMINAL : QUEUE_LAUNCH_SET_PATH}
          className={`btn-launch${isActive && !isLaunched ? ' task-card-in-progress' : ''}`}
          style={{
            padding: '4px 8px', background: btn.bg,
            fontSize: '12px', flexShrink: 0,
          }}
        >{btn.icon}</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.taskName}</span>
          {!isManual && (
            <button
              onClick={() => onUpdateTask(item.task, { autoApprove: !task?.autoApprove || undefined })}
              title={task?.autoApprove ? QUEUE_AUTO_APPROVED : QUEUE_CLICK_APPROVE}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', padding: '0 2px', flexShrink: 0,
                opacity: task?.autoApprove ? 1 : 0.3,
                color: task?.autoApprove ? 'var(--dm-success)' : 'var(--dm-text-light)',
              }}
            >{'\u2713'}</button>
          )}
        </div>
        {isActive && task?.progress ? (
          <span aria-live="polite" className={`progress-text-shimmer${status === 'waiting' ? ' text-amber' : ' text-accent'}`} style={{
            fontSize: '10px', display: 'block', marginTop: '1px',
          }}>{task.progress}</span>
        ) : null}
        {isPaused ? (
          <span className="text-paused" style={{
            fontSize: '10px', display: 'block', marginTop: '1px',
          }}>{task?.lastProgress || QUEUE_PAUSED_DEFAULT}</span>
        ) : null}
      </div>
      {isActive && onPauseTask ? (
        <button
          onClick={() => onPauseTask(item.task)}
          aria-label={QUEUE_PAUSE_ARIA}
          title={QUEUE_PAUSE_TITLE}
          className="btn-queue-pause"
          style={{ padding: '2px 6px', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
        >&#9646;&#9646;</button>
      ) : null}
      <button
        onClick={() => onRemove(key)}
        aria-label={QUEUE_REMOVE_ARIA}
        title={QUEUE_REMOVE_TITLE}
        className="btn-queue-remove"
        style={{ padding: '2px 6px', fontSize: '14px', lineHeight: 1 }}
      >x</button>
    </>
  );
}
