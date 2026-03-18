import React from 'react';
import type { Task, QueueItem } from '../../types';
import { itemKey, cmdForItem, getItemStatus, isAllAutoApproved } from './queueItemUtils.ts';
import { QueueItemContent } from './QueueItemContent.tsx';

interface PhaseViewProps {
  phases: QueueItem[][];
  queue: QueueItem[];
  taskMap: Map<number, Task>;
  launchedId: number | null;
  onLaunch: (key: number, cmd: string, taskName: string) => void;
  onLaunchPhase: (items: { key: number; cmd: string; taskName: string }[]) => void;
  onRemove: (key: number) => void;
  onPauseTask: (id: number) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  onBatchUpdateTasks: (updates: Array<{ id: number; updates: Partial<Task> }>) => void;
  onClear: () => void;
  projectPath: string;
}

export function PhaseView({ phases, queue, taskMap, launchedId, onLaunch, onLaunchPhase, onRemove, onPauseTask, onUpdateTask, onBatchUpdateTasks, onClear, projectPath }: PhaseViewProps) {
  return (
    <div>
      {phases.map((phaseItems, idx) => (
        <div key={idx}>
          {/* Phase connector line (between phases, not before the first) */}
          {idx > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 16px',
            }}>
              <div className="timeline-connector-v" style={{
                width: '1px', height: '12px',
                marginLeft: '11px',
              }} />
            </div>
          ) : null}
          {/* Phase label */}
          <div className="phase-label" style={{
            padding: '4px 12px 2px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>Phase {idx + 1}</span>
            {phaseItems.length > 1 ? (
              <>
                <span style={{ fontWeight: 400, opacity: 0.7, textTransform: 'none', letterSpacing: 'normal' }}>parallel</span>
                <button
                  onClick={() => onLaunchPhase(phaseItems.map(item => ({
                    key: itemKey(item),
                    cmd: cmdForItem(item),
                    taskName: item.taskName,
                  })))}
                  title="Launch all tasks in this phase"
                  className="btn-launch-phase"
                  style={{ padding: '1px 8px' }}
                >&#9654; Launch phase</button>
              </>
            ) : null}
            <button
              onClick={() => {
                const nonManual = phaseItems.filter(item => !taskMap.get(item.task)?.manual);
                const allApproved = isAllAutoApproved(phaseItems, taskMap);
                onBatchUpdateTasks(nonManual.map(item => ({ id: item.task, updates: { autoApprove: allApproved ? undefined : true } })));
              }}
              title={isAllAutoApproved(phaseItems, taskMap) ? 'Remove auto-approve from phase' : 'Auto-approve all in phase'}
              className="btn-launch-phase"
              style={{ padding: '1px 8px', color: isAllAutoApproved(phaseItems, taskMap) ? 'var(--dm-success)' : undefined }}
            >{'\u2713'} Auto</button>
          </div>
          {/* Phase items with tree lines */}
          {phaseItems.map((item, itemIdx) => {
            const isLast = itemIdx === phaseItems.length - 1;
            const status = getItemStatus(item, taskMap);
            const isActive = status === 'waiting' || status === 'working';
            const isPaused = status === 'paused';
            const rowBg = isActive ? (status === 'waiting' ? 'var(--dm-amber-bg-subtle)' : 'var(--dm-accent-bg-subtle)')
              : isPaused ? 'var(--dm-paused-bg-subtle)' : undefined;
            return (
              <div key={itemKey(item)} style={{
                display: 'flex', alignItems: 'stretch',
                background: rowBg,
              }}>
                {/* Tree connector */}
                <div style={{
                  width: '24px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  paddingLeft: '4px',
                }}>
                  <div className="timeline-connector-v" style={{
                    width: '1px', flex: isLast ? '0 0 50%' : '1',
                  }} />
                  <div className="timeline-connector-v" style={{
                    width: '8px', height: '1px',
                    alignSelf: 'flex-end', marginRight: '-4px',
                  }} />
                  {!isLast ? (
                    <div className="timeline-connector-v" style={{
                      width: '1px', flex: '1',
                    }} />
                  ) : null}
                </div>
                {/* Item content */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 8px 4px 4px', flex: 1, minWidth: 0,
                }}>
                  <QueueItemContent
                    item={item}
                    task={taskMap.get(item.task)}
                    launchedId={launchedId}
                    onLaunch={onLaunch}
                    onPauseTask={onPauseTask}
                    onRemove={onRemove}
                    onUpdateTask={onUpdateTask}
                    projectPath={projectPath}
                    taskMap={taskMap}
                    variant="phase"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {/* Bottom action bar */}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
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
        >{isAllAutoApproved(queue, taskMap) ? 'Unapprove all' : '\u2713 Auto-approve all'}</button>
        <button onClick={onClear} className="btn btn-secondary btn-xs" style={{
          padding: '4px 10px',
        }}>Unqueue all</button>
      </div>
    </div>
  );
}
