import React from 'react';
import type { Task, QueueItem } from '../../types';
import { itemKey, cmdForItem, getItemStatus, getButtonStyle, getProgressClass, type ItemStatus } from './queueItemUtils.ts';
import {
  QUEUE_MANUAL_TITLE, QUEUE_MANUAL_YOU, QUEUE_LAUNCH_ARIA, QUEUE_LAUNCH_RESUME,
  QUEUE_LAUNCH_TERMINAL, QUEUE_AUTO_APPROVED, QUEUE_CLICK_APPROVE,
  QUEUE_PAUSED_DEFAULT, QUEUE_PAUSE_ARIA, QUEUE_PAUSE_TITLE, QUEUE_REMOVE_ARIA,
  QUEUE_REMOVE_TITLE,
} from '../../constants/strings.ts';
import { getEngine, getModel, resolveModel } from '../../constants/engines.ts';
import { useActions } from '../../contexts/ActionContext.tsx';

interface QueueItemContentProps {
  item: QueueItem;
  task: Task | undefined;
  taskMap: Map<number, Task>;
  variant?: 'flat' | 'phase';
}

export function QueueItemContent({ item, task, taskMap, variant = 'flat' }: QueueItemContentProps) {
  const { launchedIds, handleLaunchTask: onLaunch, handleLaunchTerminal: onLaunchTerminal, pauseTask: onPauseTask, handleRemoveFromQueue: onRemove, handleUpdateTask: onUpdateTask, defaultEngine, defaultModel } = useActions();
  const key = itemKey(item);
  const isLaunched = launchedIds.has(key);
  const status: ItemStatus = getItemStatus(item, taskMap);
  const btn = getButtonStyle(item, taskMap, launchedIds);
  const isManual = task?.manual;
  const isError = status === 'error';
  const isActive = status !== 'queued' && status !== 'paused' && !isError;
  const isPaused = status === 'paused';
  const progressColorClass = getProgressClass(status);
  const engine = getEngine(task?.engine || defaultEngine);
  const resolvedModelId = resolveModel(cmdForItem(item), task?.model, defaultModel, task);
  const model = resolvedModelId ? getModel(resolvedModelId) : null;

  return (
    <>
      {isManual ? (
        variant === 'phase' ? (
          <span className="text-12 shrink-0" title={QUEUE_MANUAL_YOU} style={{
            padding: '4px 8px', lineHeight: 1,
          }}>&#9997;</span>
        ) : (
          <span className="manual-badge shrink-0" title={QUEUE_MANUAL_TITLE} style={{
            padding: '3px 6px',
          }}>YOU</span>
        )
      ) : (
        <>
          <button
            onClick={() => onLaunch(key, cmdForItem(item), item.taskName)}
            aria-label={QUEUE_LAUNCH_ARIA}
            title={isError ? `Retry (${engine.label})` : isPaused ? QUEUE_LAUNCH_RESUME : `Background (${engine.label})`}
            className={`btn-launch flex-center text-12 shrink-0${isActive && !isLaunched ? ' task-card-in-progress' : ''}`}
            style={{
              padding: '4px 8px', background: btn.bg,
              gap: '3px',
            }}
          >
            {btn.icon}
            <span className="text-9" style={{
              lineHeight: 1,
              opacity: 0.9,
            }}>{engine.icon}</span>
          </button>
          {onLaunchTerminal && (!isActive || isError) && (
            <button
              onClick={() => onLaunchTerminal(key, cmdForItem(item), item.taskName)}
              title={`Open in terminal (${engine.label})`}
              className="btn-ghost text-11 shrink-0"
              style={{
                padding: '3px 5px',
                fontFamily: 'monospace', lineHeight: 1,
                color: 'var(--dm-text-muted)',
              }}
            >{'>_'}</button>
          )}
        </>
      )}
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="flex-center gap-2">
          <span className="font-500 text-13 truncate flex-1">{item.taskName}</span>
          {model && (
            <span className="text-9 font-600 shrink-0" title={`Model: ${model.label}`} style={{
              padding: '1px 4px',
              borderRadius: '3px',
              color: model.color,
              border: `1px solid ${model.color}`,
              opacity: 0.7,
              lineHeight: 1.2,
            }}>{model.shortLabel}</span>
          )}
          {!isManual && (
            <button
              onClick={() => onUpdateTask(item.task, { autoApprove: !task?.autoApprove || undefined })}
              title={task?.autoApprove ? QUEUE_AUTO_APPROVED : QUEUE_CLICK_APPROVE}
              className="border-none cursor-pointer text-11 shrink-0"
              style={{
                background: 'none',
                padding: '0 2px',
                opacity: task?.autoApprove ? 1 : 0.3,
                color: task?.autoApprove ? 'var(--dm-success)' : 'var(--dm-text-light)',
              }}
            >{'\u2713'}</button>
          )}
        </div>
        {isError && task?.progress ? (
          <span className="text-10 block" style={{
            marginTop: '1px',
            color: 'var(--dm-danger)',
          }}>{task.progress}</span>
        ) : isActive && task?.progress ? (
          <span aria-live="polite" className={`progress-text-shimmer ${progressColorClass} text-10 block`} style={{
            marginTop: '1px',
          }}>{task.progress}</span>
        ) : isPaused ? (
          <span className="text-paused text-10 block" style={{
            marginTop: '1px',
          }}>{task?.lastProgress || QUEUE_PAUSED_DEFAULT}</span>
        ) : null}
      </div>
      {isActive && onPauseTask ? (
        <button
          onClick={() => onPauseTask(item.task)}
          aria-label={QUEUE_PAUSE_ARIA}
          title={QUEUE_PAUSE_TITLE}
          className="btn-queue-pause text-12 shrink-0"
          style={{ padding: '2px 6px', lineHeight: 1 }}
        >&#9646;&#9646;</button>
      ) : null}
      <button
        onClick={() => onRemove(key)}
        aria-label={QUEUE_REMOVE_ARIA}
        title={QUEUE_REMOVE_TITLE}
        className="btn-queue-remove text-14"
        style={{ padding: '2px 6px', lineHeight: 1 }}
      >x</button>
    </>
  );
}
