import React from 'react';
import type { Task, QueueItem } from '../../types';
import type { TaskOutput } from '../../hooks/useProcessOutput.ts';
import { itemKey, cmdForItem, getItemStatus, isAllAutoApproved, type ItemStatus } from './queueItemUtils.ts';
import { QueueItemContent } from './QueueItemContent.tsx';
import { OutputViewer } from './OutputViewer.tsx';
import {
  QUEUE_PARALLEL, QUEUE_LAUNCH_PHASE_TITLE, QUEUE_LAUNCH_PHASE,
  QUEUE_REMOVE_PHASE_APPROVE, QUEUE_PHASE_APPROVE, QUEUE_AUTO_LABEL,
  QUEUE_UNAPPROVE_ALL, QUEUE_APPROVE_ALL, QUEUE_UNQUEUE_ALL,
  QUEUE_LAUNCH_PIPELINE, QUEUE_LAUNCH_PIPELINE_TITLE,
  QUEUE_STOP_PIPELINE, QUEUE_STOP_PIPELINE_TITLE,
  QUEUE_PIPELINE_PHASE,
} from '../../constants/strings.ts';
import { useActions } from '../../contexts/ActionContext.tsx';

interface PhaseViewProps {
  phases: QueueItem[][];
  queue: QueueItem[];
  taskMap: Map<number, Task>;
  processOutputs?: Record<number, TaskOutput>;
  onClearOutput?: (taskId: number) => void;
}

export function PhaseView({ phases, queue, taskMap, processOutputs, onClearOutput }: PhaseViewProps) {
  const { launchedIds, handleLaunchPhase: onLaunchPhase, handleRetryFailed: onRetryFailed, handleBatchUpdateTasks: onBatchUpdateTasks, handleClearQueue: onClear, handleLaunchPipeline, cancelPipeline, pipelineRunning, pipelinePhase } = useActions();
  return (
    <div>
      {/* Pipeline launch button */}
      {phases.length > 1 && (
        <div className="flex-center gap-8" style={{ padding: '4px 12px 0' }}>
          {pipelineRunning ? (
            <button
              onClick={cancelPipeline}
              title={QUEUE_STOP_PIPELINE_TITLE}
              className="btn-launch-phase"
              style={{ padding: '2px 10px', color: 'var(--dm-danger)' }}
            >{QUEUE_STOP_PIPELINE}</button>
          ) : (
            <button
              onClick={handleLaunchPipeline}
              title={QUEUE_LAUNCH_PIPELINE_TITLE}
              className="btn-launch-phase"
              style={{ padding: '2px 10px' }}
            >{QUEUE_LAUNCH_PIPELINE}</button>
          )}
          {pipelineRunning && pipelinePhase >= 0 && (
            <span className="text-muted" style={{ fontSize: '10px' }}>
              {QUEUE_PIPELINE_PHASE} {pipelinePhase + 1} of {phases.length}
            </span>
          )}
        </div>
      )}
      {phases.map((phaseItems, idx) => (
        <div key={idx}>
          {/* Phase connector line (between phases, not before the first) */}
          {idx > 0 ? (
            <div className="flex-center px-16">
              <div className="timeline-connector-v" style={{
                width: '1px', height: '12px',
                marginLeft: '11px',
              }} />
            </div>
          ) : null}
          {/* Phase label */}
          <div className="phase-label flex-center gap-8" style={{
            padding: '4px 12px 2px',
          }}>
            <span style={pipelineRunning && pipelinePhase === idx ? { color: 'var(--dm-accent)' } : undefined}>
              {pipelineRunning && pipelinePhase === idx ? '\u25B6 ' : ''}Phase {idx + 1}
            </span>
            {phaseItems.length > 1 ? (
              <>
                <span style={{ fontWeight: 400, opacity: 0.7, textTransform: 'none', letterSpacing: 'normal' }}>{QUEUE_PARALLEL}</span>
                <button
                  onClick={() => onLaunchPhase(phaseItems.map(item => ({
                    key: itemKey(item),
                    cmd: cmdForItem(item),
                    taskName: item.taskName,
                  })), idx)}
                  title={QUEUE_LAUNCH_PHASE_TITLE}
                  className="btn-launch-phase"
                  style={{ padding: '1px 8px' }}
                >{QUEUE_LAUNCH_PHASE}</button>
              </>
            ) : null}
            {phaseItems.some(item => getItemStatus(item, taskMap) === 'error') && (
              <button
                onClick={() => onRetryFailed(phaseItems.map(item => ({
                  key: itemKey(item),
                  cmd: cmdForItem(item),
                  taskName: item.taskName,
                })), idx)}
                title="Retry all failed tasks in this phase"
                className="btn-launch-phase"
                style={{ padding: '1px 8px', color: 'var(--dm-danger)' }}
              >{'\u21BB'} Retry failed</button>
            )}
            <button
              onClick={() => {
                const nonManual = phaseItems.filter(item => !taskMap.get(item.task)?.manual);
                const allApproved = isAllAutoApproved(phaseItems, taskMap);
                onBatchUpdateTasks(nonManual.map(item => ({ id: item.task, updates: { autoApprove: allApproved ? undefined : true } })));
              }}
              title={isAllAutoApproved(phaseItems, taskMap) ? QUEUE_REMOVE_PHASE_APPROVE : QUEUE_PHASE_APPROVE}
              className="btn-launch-phase"
              style={{ padding: '1px 8px', color: isAllAutoApproved(phaseItems, taskMap) ? 'var(--dm-success)' : undefined }}
            >{QUEUE_AUTO_LABEL}</button>
          </div>
          {/* Phase items with tree lines */}
          {phaseItems.map((item, itemIdx) => {
            const isLast = itemIdx === phaseItems.length - 1;
            const status = getItemStatus(item, taskMap);
            const waitingStatuses: ItemStatus[] = ['reading', 'exploring', 'planning'];
            const workingStatuses: ItemStatus[] = ['launching', 'delegating', 'reviewing', 'merging'];
            const isWaiting = waitingStatuses.includes(status);
            const isWorking = workingStatuses.includes(status);
            const isActive = isWaiting || isWorking;
            const isPaused = status === 'paused';
            const rowBg = isActive ? (isWaiting ? 'var(--dm-amber-bg-subtle)' : 'var(--dm-accent-bg-subtle)')
              : isPaused ? 'var(--dm-paused-bg-subtle)' : undefined;
            const hasOutput = processOutputs && (processOutputs[item.task]?.lines.length || processOutputs[item.task]?.running);
            return (
              <div key={itemKey(item)}>
                <div className="flex" style={{
                  alignItems: 'stretch',
                  background: rowBg,
                }}>
                  {/* Tree connector */}
                  <div className="flex-col items-center shrink-0" style={{
                    width: '24px',
                    paddingLeft: '4px',
                  }}>
                    <div className="timeline-connector-v" style={{
                      width: '1px', flex: isLast ? '0 0 50%' : '1',
                    }} />
                    <div className="timeline-connector-v self-end" style={{
                      width: '8px', height: '1px',
                      marginRight: '-4px',
                    }} />
                    {!isLast ? (
                      <div className="timeline-connector-v" style={{
                        width: '1px', flex: '1',
                      }} />
                    ) : null}
                  </div>
                  {/* Item content */}
                  <div className="flex-center gap-6 flex-1" style={{
                    padding: '4px 8px 4px 4px', minWidth: 0,
                  }}>
                    <QueueItemContent
                      item={item}
                      task={taskMap.get(item.task)}
                      taskMap={taskMap}
                      variant="phase"
                    />
                  </div>
                </div>
                {hasOutput && onClearOutput ? (
                  <div style={{ marginLeft: '24px' }}>
                    <OutputViewer
                      taskId={item.task}
                      taskName={item.taskName}
                      output={processOutputs[item.task]}
                      onClear={onClearOutput}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
      {/* Bottom action bar */}
      <div className="flex gap-6" style={{ padding: '6px 12px', justifyContent: 'flex-end' }}>
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
}
