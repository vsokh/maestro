import React, { useState, useMemo } from 'react';

function computePhases(queue, tasks) {
  const taskMap = new Map((tasks || []).map(t => [t.id, t]));
  const queueIds = new Set(queue.map(q => q.task));

  // Check if any queued task has dependencies on other queued tasks
  const hasDeps = queue.some(q => {
    const task = taskMap.get(q.task);
    return task && task.dependsOn && task.dependsOn.some(d => queueIds.has(d));
  });

  if (!hasDeps) return null; // flat list, no phases needed

  const assigned = new Map(); // taskId → phase number
  const phases = []; // array of arrays of queue items

  // Iteratively assign phases
  let remaining = [...queue];
  let phaseNum = 0;
  while (remaining.length > 0) {
    phaseNum++;
    const thisPhase = [];
    const stillRemaining = [];

    for (const item of remaining) {
      const task = taskMap.get(item.task);
      const deps = (task && task.dependsOn) ? task.dependsOn.filter(d => queueIds.has(d)) : [];
      const allDepsAssigned = deps.every(d => assigned.has(d) && assigned.get(d) < phaseNum);
      if (allDepsAssigned) {
        thisPhase.push(item);
        assigned.set(item.task, phaseNum);
      } else {
        stillRemaining.push(item);
      }
    }

    // Safety: if no progress, push remaining into current phase (cycle)
    if (thisPhase.length === 0) {
      for (const item of stillRemaining) {
        thisPhase.push(item);
        assigned.set(item.task, phaseNum);
      }
      stillRemaining.length = 0;
    }

    phases.push(thisPhase);
    remaining = stillRemaining;
  }

  return phases;
}

export function CommandQueue({ queue, tasks, onLaunch, onLaunchPhase, onRemove, onClear, onQueueAll, onPauseTask, launchedId, projectPath, onSetPath }) {
  const itemKey = (item) => item.task;
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(projectPath || '');

  const handleSavePath = () => {
    if (pathInput.trim()) {
      onSetPath(pathInput.trim());
      setEditingPath(false);
    }
  };

  // Build command for a queue item
  const cmdForItem = (item) => '/orchestrator task ' + item.task;

  const taskMap = useMemo(() => new Map((tasks || []).map(t => [t.id, t])), [tasks]);

  const isWaiting = (task) => {
    const p = (task.progress || '').toLowerCase();
    return /waiting|approval|planning/.test(p);
  };

  const getItemStatus = (item) => {
    const task = taskMap.get(item.task);
    if (!task) return 'queued';
    if (task.status === 'paused') return 'paused';
    if (task.status !== 'in-progress') return 'queued';
    return isWaiting(task) ? 'waiting' : 'working';
  };

  const getButtonStyle = (item) => {
    const status = getItemStatus(item);
    const isLaunched = launchedId === itemKey(item);
    if (isLaunched) return { bg: 'var(--success)', icon: '\u2713' };
    if (status === 'paused') return { bg: '#9b8bb4', icon: '\u25B6' }; // purple play = resume
    if (status === 'waiting') return { bg: 'var(--amber)', icon: '\u25CF' };
    if (status === 'working') return { bg: 'var(--accent)', icon: '\u25CF' };
    return { bg: 'var(--accent)', icon: '\u25B6' };
  };

  const phases = useMemo(() => computePhases(queue, tasks), [queue, tasks]);

  const renderItem = (item) => {
    const key = itemKey(item);
    const isLaunched = launchedId === key;
    const status = getItemStatus(item);
    const btn = getButtonStyle(item);
    const task = taskMap.get(item.task);
    const isActive = status === 'waiting' || status === 'working';
    const isPaused = status === 'paused';
    const rowBg = isActive ? (status === 'waiting' ? 'rgba(196,132,90,0.06)' : 'rgba(106,141,190,0.06)')
      : isPaused ? 'rgba(155,139,180,0.06)' : undefined;
    return (
      <div key={key} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', borderBottom: '1px solid var(--border)',
        background: rowBg,
      }}>
        <button
          onClick={() => onLaunch(key, cmdForItem(item), item.taskName)}
          title={isPaused ? 'Resume task' : projectPath ? 'Launch in terminal' : 'Set project path first'}
          className={isActive && !isLaunched ? 'task-card-in-progress' : undefined}
          style={{
            padding: '4px 8px', background: btn.bg,
            color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
            flexShrink: 0, lineHeight: 1,
          }}
        >{btn.icon}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.taskName}</span>
          {isActive && task?.progress ? (
            <span className="progress-text-shimmer" style={{
              fontSize: '10px', display: 'block', marginTop: '1px',
              color: status === 'waiting' ? 'var(--amber)' : 'var(--accent)',
            }}>{task.progress}</span>
          ) : null}
          {isPaused ? (
            <span style={{
              fontSize: '10px', display: 'block', marginTop: '1px',
              color: '#9b8bb4',
            }}>{task?.lastProgress || 'Paused — click ▶ to resume'}</span>
          ) : null}
        </div>
        {isActive && onPauseTask ? (
          <button
            onClick={() => onPauseTask(item.task)}
            title="Pause — save progress, resume later"
            style={{
              padding: '2px 6px', background: 'none', border: 'none',
              cursor: 'pointer', color: '#9b8bb4', fontSize: '12px',
              lineHeight: 1, flexShrink: 0,
            }}
          >&#9646;&#9646;</button>
        ) : null}
        <button
          onClick={() => onRemove(key)}
          title="Remove from queue"
          style={{
            padding: '2px 6px', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-light)', fontSize: '14px',
            lineHeight: 1,
          }}
        >x</button>
      </div>
    );
  };

  const renderFlatList = () => (
    <div>
      {queue.map(renderItem)}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        {onQueueAll && (tasks || []).some(t => (t.status === 'pending' || t.status === 'paused') && !queue.some(q => q.task === t.id)) ? (
          <button onClick={onQueueAll} style={{
            padding: '4px 10px', background: 'none', color: 'var(--accent)',
            border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', fontSize: '11px',
            fontFamily: 'var(--font)', cursor: 'pointer',
          }}>Queue all</button>
        ) : null}
        <button onClick={onClear} style={{
          padding: '4px 10px', background: 'none', color: 'var(--text-light)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px',
          fontFamily: 'var(--font)', cursor: 'pointer',
        }}>Unqueue all</button>
      </div>
    </div>
  );

  const renderPhases = () => (
    <div>
      {phases.map((phaseItems, idx) => (
        <div key={idx}>
          {/* Phase connector line (between phases, not before the first) */}
          {idx > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 16px',
            }}>
              <div style={{
                width: '1px', height: '12px', background: 'var(--border)',
                marginLeft: '11px',
              }} />
            </div>
          ) : null}
          {/* Phase label */}
          <div style={{
            padding: '4px 12px 2px',
            fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-light)',
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
                  style={{
                    padding: '1px 8px', background: 'none', color: 'var(--accent)',
                    border: '1px solid var(--accent)', borderRadius: '4px',
                    fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                    textTransform: 'none', letterSpacing: 'normal',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'white'; }}
                  onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; }}
                >▶ Launch phase</button>
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
            const isActive = status === 'waiting' || status === 'working';
            const isPaused = status === 'paused';
            const rowBg = isActive ? (status === 'waiting' ? 'rgba(196,132,90,0.06)' : 'rgba(106,141,190,0.06)')
              : isPaused ? 'rgba(155,139,180,0.06)' : undefined;
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
                  <div style={{
                    width: '1px', flex: isLast ? '0 0 50%' : '1', background: 'var(--border)',
                  }} />
                  <div style={{
                    width: '8px', height: '1px', background: 'var(--border)',
                    alignSelf: 'flex-end', marginRight: '-4px',
                  }} />
                  {!isLast ? (
                    <div style={{
                      width: '1px', flex: '1', background: 'var(--border)',
                    }} />
                  ) : null}
                </div>
                {/* Item content */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 8px 4px 4px', flex: 1, minWidth: 0,
                }}>
                  <button
                    onClick={() => onLaunch(key, cmdForItem(item), item.taskName)}
                    title={isPaused ? 'Resume task' : projectPath ? 'Launch in terminal' : 'Set project path first'}
                    className={isActive && !isLaunched ? 'task-card-in-progress' : undefined}
                    style={{
                      padding: '4px 8px', background: btn.bg,
                      color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                      fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                      flexShrink: 0, lineHeight: 1,
                    }}
                  >{btn.icon}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.taskName}</span>
                    {isActive && task?.progress ? (
                      <span className="progress-text-shimmer" style={{
                        fontSize: '10px', display: 'block', marginTop: '1px',
                        color: status === 'waiting' ? 'var(--amber)' : 'var(--accent)',
                      }}>{task.progress}</span>
                    ) : null}
                    {isPaused ? (
                      <span style={{
                        fontSize: '10px', display: 'block', marginTop: '1px',
                        color: '#9b8bb4',
                      }}>{task?.lastProgress || 'Paused — click ▶ to resume'}</span>
                    ) : null}
                  </div>
                  {isActive && onPauseTask ? (
                    <button
                      onClick={() => onPauseTask(item.task)}
                      title="Pause — save progress, resume later"
                      style={{
                        padding: '2px 6px', background: 'none', border: 'none',
                        cursor: 'pointer', color: '#9b8bb4', fontSize: '12px',
                        lineHeight: 1, flexShrink: 0,
                      }}
                    >&#9646;&#9646;</button>
                  ) : null}
                  <button
                    onClick={() => onRemove(key)}
                    title="Remove from queue"
                    style={{
                      padding: '2px 6px', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-light)', fontSize: '14px',
                      lineHeight: 1,
                    }}
                  >x</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        {onQueueAll && (tasks || []).some(t => (t.status === 'pending' || t.status === 'paused') && !queue.some(q => q.task === t.id)) ? (
          <button onClick={onQueueAll} style={{
            padding: '4px 10px', background: 'none', color: 'var(--accent)',
            border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', fontSize: '11px',
            fontFamily: 'var(--font)', cursor: 'pointer',
          }}>Queue all</button>
        ) : null}
        <button onClick={onClear} style={{
          padding: '4px 10px', background: 'none', color: 'var(--text-light)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px',
          fontFamily: 'var(--font)', cursor: 'pointer',
        }}>Unqueue all</button>
      </div>
    </div>
  );

  return (
    <div>
      {queue.length === 0 ? (
        <div style={{
          padding: '20px 16px', textAlign: 'center', color: 'var(--text-light)', fontSize: '12px',
          lineHeight: 1.6,
        }}>
          Queue tasks from the detail panel, then launch each in its own terminal.
        </div>
      ) : phases ? renderPhases() : renderFlatList()}

      {editingPath ? (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={pathInput}
            onInput={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePath()}
            placeholder="C:\Users\you\Projects\my-project"
            autoFocus
            style={{
              flex: 1, padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)', color: 'var(--text)',
            }}
          />
          <button onClick={handleSavePath} style={{
            padding: '6px 10px', background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '11px',
            fontWeight: 600, cursor: 'pointer',
          }}>Save</button>
          <button onClick={() => setEditingPath(false)} style={{
            padding: '6px 8px', background: 'none', color: 'var(--text-light)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px',
            cursor: 'pointer',
          }}>Cancel</button>
        </div>
      ) : (
        <div style={{
          padding: '4px 12px 6px', display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '11px', color: 'var(--text-light)', borderTop: queue.length > 0 ? 'none' : '1px solid var(--border)',
        }}>
          {projectPath ? (
            <>
              <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, opacity: 0.7 }}>{projectPath}</span>
              <button onClick={() => { setPathInput(projectPath); setEditingPath(true); }} style={{
                background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer',
                fontSize: '11px', textDecoration: 'underline', flexShrink: 0,
              }}>edit</button>
            </>
          ) : (
            <button onClick={() => setEditingPath(true)} style={{
              background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer',
              fontSize: '11px', textDecoration: 'underline',
            }}>Set project path to enable launch</button>
          )}
        </div>
      )}
    </div>
  );
}
