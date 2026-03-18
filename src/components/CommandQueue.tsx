import React, { useState, useMemo } from 'react';
import { PAUSED_COLOR } from '../constants/colors.ts';
import { STATUS } from '../constants/statuses.ts';
import { computePhases } from '../utils/computePhases.ts';
import type { Task, QueueItem } from '../types';

interface CommandQueueProps {
  queue: QueueItem[];
  tasks: Task[];
  onLaunch: (key: number, cmd: string, taskName: string) => void;
  onLaunchPhase: (items: { key: number; cmd: string; taskName: string }[]) => void;
  onRemove: (key: number) => void;
  onClear: () => void;
  onQueueAll: () => void;
  onPauseTask: (id: number) => void;
  launchedId: number | null;
  projectPath: string;
  onSetPath: (path: string) => void;
}

export function CommandQueue({ queue, tasks, onLaunch, onLaunchPhase, onRemove, onClear, onQueueAll: _onQueueAll, onPauseTask, launchedId, projectPath, onSetPath }: CommandQueueProps) {
  const itemKey = (item: QueueItem) => item.task;
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(projectPath || '');

  const handleSavePath = () => {
    if (pathInput.trim()) {
      onSetPath(pathInput.trim());
      setEditingPath(false);
    }
  };

  // Build command for a queue item
  const cmdForItem = (item: QueueItem) => '/orchestrator task ' + item.task;

  const taskMap = useMemo(() => new Map((tasks || []).map(t => [t.id, t])), [tasks]);

  const isWaiting = (task: Task) => {
    const p = (task.progress || '').toLowerCase();
    return /waiting|approval|planning/.test(p);
  };

  const getItemStatus = (item: QueueItem) => {
    const task = taskMap.get(item.task);
    if (!task) return 'queued';
    if (task.status === STATUS.PAUSED) return 'paused';
    if (task.status !== STATUS.IN_PROGRESS) return 'queued';
    return isWaiting(task) ? 'waiting' : 'working';
  };

  const getButtonStyle = (item: QueueItem) => {
    const status = getItemStatus(item);
    const isLaunched = launchedId === itemKey(item);
    if (isLaunched) return { bg: 'var(--dm-success)', icon: '\u2713' };
    if (status === 'paused') return { bg: PAUSED_COLOR, icon: '\u25B6' }; // purple play = resume
    if (status === 'waiting') return { bg: 'var(--dm-amber)', icon: '\u25CF' };
    if (status === 'working') return { bg: 'var(--dm-accent)', icon: '\u25CF' };
    return { bg: 'var(--dm-accent)', icon: '\u25B6' };
  };

  const phases = useMemo(() => computePhases(queue, tasks), [queue, tasks]);

  const getRowClass = (status: string) => {
    if (status === 'waiting') return 'queue-item queue-item--active-waiting';
    if (status === 'working') return 'queue-item queue-item--active-working';
    if (status === 'paused') return 'queue-item queue-item--paused';
    return 'queue-item';
  };

  const renderItem = (item: QueueItem) => {
    const key = itemKey(item);
    const isLaunched = launchedId === key;
    const status = getItemStatus(item);
    const btn = getButtonStyle(item);
    const task = taskMap.get(item.task);
    const isManual = task?.manual;
    const isActive = status === 'waiting' || status === 'working';
    const isPaused = status === 'paused';
    return (
      <div key={key} className={getRowClass(status)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px',
      }}>
        {isManual ? (
          <span className="manual-badge" title="Manual task" style={{
            padding: '3px 6px', flexShrink: 0,
          }}>YOU</span>
        ) : (
          <button
            onClick={() => onLaunch(key, cmdForItem(item), item.taskName)}
            aria-label="Launch task"
            title={isPaused ? 'Resume task' : projectPath ? 'Launch in terminal' : 'Set project path first'}
            className={`btn-launch${isActive && !isLaunched ? ' task-card-in-progress' : ''}`}
            style={{
              padding: '4px 8px', background: btn.bg,
              fontSize: '12px', flexShrink: 0,
            }}
          >{btn.icon}</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.taskName}</span>
          {isActive && task?.progress ? (
            <span aria-live="polite" className={`progress-text-shimmer${status === 'waiting' ? ' text-amber' : ' text-accent'}`} style={{
              fontSize: '10px', display: 'block', marginTop: '1px',
            }}>{task.progress}</span>
          ) : null}
          {isPaused ? (
            <span className="text-paused" style={{
              fontSize: '10px', display: 'block', marginTop: '1px',
            }}>{task?.lastProgress || 'Paused — click \u25B6 to resume'}</span>
          ) : null}
        </div>
        {isActive && onPauseTask ? (
          <button
            onClick={() => onPauseTask(item.task)}
            aria-label="Pause task"
            title="Pause — save progress, resume later"
            className="btn-queue-pause"
            style={{ padding: '2px 6px', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
          >&#9646;&#9646;</button>
        ) : null}
        <button
          onClick={() => onRemove(key)}
          aria-label="Remove from queue"
          title="Remove from queue"
          className="btn-queue-remove"
          style={{ padding: '2px 6px', fontSize: '14px', lineHeight: 1 }}
        >x</button>
      </div>
    );
  };

  const renderFlatList = () => (
    <div>
      {queue.map(renderItem)}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        {queue.length > 1 && onLaunchPhase ? (
          <button onClick={() => onLaunchPhase(queue.map(item => ({
            key: itemKey(item),
            cmd: cmdForItem(item),
            taskName: item.taskName,
          })))} className="btn btn-accent-outline btn-xs" style={{
            padding: '4px 10px', borderRadius: 'var(--dm-radius-sm)',
          }}>&#9654; Launch all</button>
        ) : null}
        <button onClick={onClear} className="btn btn-secondary btn-xs" style={{
          padding: '4px 10px',
        }}>Unqueue all</button>
      </div>
    </div>
  );

  const renderPhases = () => (
    <div>
      {phases!.map((phaseItems, idx) => (
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
          </div>
          {/* Phase items with tree lines */}
          {phaseItems.map((item, itemIdx) => {
            const isLast = itemIdx === phaseItems.length - 1;
            const key = itemKey(item);
            const isLaunched = launchedId === key;
            const status = getItemStatus(item);
            const btn = getButtonStyle(item);
            const task = taskMap.get(item.task);
            const isManual = task?.manual;
            const isActive = status === 'waiting' || status === 'working';
            const isPaused = status === 'paused';
            const rowBg = isActive ? (status === 'waiting' ? 'var(--dm-amber-bg-subtle)' : 'var(--dm-accent-bg-subtle)')
              : isPaused ? 'var(--dm-paused-bg-subtle)' : undefined;
            return (
              <div key={key} style={{
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
                  {isManual ? (
                    <span title="Manual task (you)" style={{
                      padding: '4px 8px', fontSize: '12px', flexShrink: 0, lineHeight: 1,
                    }}>&#9997;</span>
                  ) : (
                    <button
                      onClick={() => onLaunch(key, cmdForItem(item), item.taskName)}
                      aria-label="Launch task"
                      title={isPaused ? 'Resume task' : projectPath ? 'Launch in terminal' : 'Set project path first'}
                      className={`btn-launch${isActive && !isLaunched ? ' task-card-in-progress' : ''}`}
                      style={{
                        padding: '4px 8px', background: btn.bg,
                        fontSize: '12px', flexShrink: 0,
                      }}
                    >{btn.icon}</button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.taskName}</span>
                    {isActive && task?.progress ? (
                      <span aria-live="polite" className={`progress-text-shimmer${status === 'waiting' ? ' text-amber' : ' text-accent'}`} style={{
                        fontSize: '10px', display: 'block', marginTop: '1px',
                      }}>{task.progress}</span>
                    ) : null}
                    {isPaused ? (
                      <span className="text-paused" style={{
                        fontSize: '10px', display: 'block', marginTop: '1px',
                      }}>{task?.lastProgress || 'Paused — click \u25B6 to resume'}</span>
                    ) : null}
                  </div>
                  {isActive && onPauseTask ? (
                    <button
                      onClick={() => onPauseTask(item.task)}
                      aria-label="Pause task"
                      title="Pause — save progress, resume later"
                      className="btn-queue-pause"
                      style={{ padding: '2px 6px', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
                    >&#9646;&#9646;</button>
                  ) : null}
                  <button
                    onClick={() => onRemove(key)}
                    aria-label="Remove from queue"
                    title="Remove from queue"
                    className="btn-queue-remove"
                    style={{ padding: '2px 6px', fontSize: '14px', lineHeight: 1 }}
                  >x</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        <button onClick={onClear} className="btn btn-secondary btn-xs" style={{
          padding: '4px 10px',
        }}>Unqueue all</button>
      </div>
    </div>
  );

  return (
    <div>
      {queue.length === 0 ? (
        <div className="empty-state-sm" style={{
          padding: '20px 16px', lineHeight: 1.6,
        }}>
          Queue tasks from the detail panel, then launch each in its own terminal.
        </div>
      ) : phases ? renderPhases() : renderFlatList()}

      {editingPath ? (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--dm-border)', display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={pathInput}
            onInput={(e: React.FormEvent<HTMLInputElement>) => setPathInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePath()}
            placeholder="C:\Users\you\Projects\my-project"
            autoFocus
            className="mono"
            style={{
              flex: 1, padding: '6px 8px', fontSize: '12px',
              border: '1px solid var(--dm-border)', borderRadius: 'var(--dm-radius-sm)',
              background: 'var(--dm-bg)', color: 'var(--dm-text)',
            }}
          />
          <button onClick={handleSavePath} className="btn btn-primary btn-xs" style={{
            padding: '6px 10px',
          }}>Save</button>
          <button onClick={() => setEditingPath(false)} className="btn btn-secondary btn-xs" style={{
            padding: '6px 8px',
          }}>Cancel</button>
        </div>
      ) : (
        <div style={{
          padding: '4px 12px 6px', display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '11px', borderTop: queue.length > 0 ? 'none' : '1px solid var(--dm-border)',
        }}>
          {projectPath ? (
            <>
              <span className="queue-path" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, opacity: 0.7 }}>{projectPath}</span>
              <button onClick={() => { setPathInput(projectPath); setEditingPath(true); }} className="btn-link text-light" style={{
                fontSize: '11px', flexShrink: 0,
              }}>edit</button>
            </>
          ) : (
            <button onClick={() => setEditingPath(true)} className="btn-link text-amber" style={{
              fontSize: '11px',
            }}>Set project path to enable launch</button>
          )}
        </div>
      )}
    </div>
  );
}
