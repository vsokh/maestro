import React from 'react';
import { PAUSED_COLOR } from '../../constants/colors.js';
import { STATUS } from '../../constants/statuses.js';

const isWaiting = (task) => {
  const p = (task.progress || '').toLowerCase();
  return /waiting|approval|planning/.test(p);
};

const getCardStyle = (task, selectedTask) => {
  const isSelected = selectedTask === task.id;
  const base = {
    background: 'var(--dm-surface)',
    borderRadius: 'var(--dm-radius-sm)', padding: '12px 16px',
    cursor: 'pointer', transition: 'all 0.15s',
    minWidth: '160px', flex: '1 1 160px', maxWidth: '260px',
  };
  if (task.status === STATUS.IN_PROGRESS) {
    const waiting = isWaiting(task);
    const color = waiting ? 'var(--dm-amber)' : 'var(--dm-accent)';
    return {
      ...base,
      border: '2px solid ' + color,
      boxShadow: isSelected ? '0 2px 8px ' + (waiting ? 'var(--dm-amber-shadow)' : 'var(--dm-accent-shadow)') : 'var(--dm-shadow-sm)',
    };
  }
  if (task.status === STATUS.DONE) {
    return {
      ...base,
      border: isSelected ? '2px solid var(--dm-success)' : '1px solid var(--dm-success)',
      boxShadow: isSelected ? '0 2px 8px var(--dm-success-shadow)' : 'var(--dm-shadow-sm)',
      opacity: 0.75,
    };
  }
  if (task.status === STATUS.PAUSED) {
    return {
      ...base,
      border: isSelected ? '2px solid ' + PAUSED_COLOR : '1px dashed ' + PAUSED_COLOR,
      boxShadow: isSelected ? '0 2px 8px var(--dm-paused-shadow)' : 'var(--dm-shadow-sm)',
      opacity: 0.85,
    };
  }
  if (task.status === STATUS.BLOCKED) {
    return {
      ...base,
      border: isSelected ? '2px solid var(--dm-text-light)' : '1px solid var(--dm-border)',
      boxShadow: isSelected ? '0 2px 8px var(--dm-dark-shadow)' : 'var(--dm-shadow-sm)',
      opacity: 0.6,
    };
  }
  if (task.status === STATUS.BACKLOG) {
    return {
      ...base,
      border: isSelected ? '2px solid var(--dm-text-light)' : '1px dashed var(--dm-border)',
      boxShadow: isSelected ? '0 2px 8px var(--dm-dark-shadow)' : 'var(--dm-shadow-sm)',
      opacity: 0.6,
    };
  }
  // pending (default)
  return {
    ...base,
    border: isSelected ? '2px solid var(--dm-accent)' : '1px solid var(--dm-border)',
    boxShadow: isSelected ? '0 2px 8px var(--dm-accent-shadow)' : 'var(--dm-shadow-sm)',
  };
};

export function TaskCard({ task, tasks, selectedTask, onSelectTask, onPauseTask, onCancelTask, glowTaskId }) {
  return (
    <div
      key={task.id}
      data-task-id={task.id}
      onClick={() => onSelectTask(task.id)}
      className={(task.status === STATUS.IN_PROGRESS ? 'task-card-in-progress' : '') + (glowTaskId === task.id ? ' task-card-glow' : '') || undefined}
      style={getCardStyle(task, selectedTask)}
      onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--dm-shadow-md)'}
      onMouseOut={e => e.currentTarget.style.boxShadow = selectedTask === task.id ? '0 2px 8px var(--dm-accent-shadow)' : 'var(--dm-shadow-sm)'}
    >
      <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        {task.manual ? <span title="Manual task" style={{
          fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
          background: 'var(--dm-border)', color: 'var(--dm-text-light)', letterSpacing: '0.03em',
        }}>YOU</span> : null}
        {task.name}
      </div>
      {task.dependsOn && task.dependsOn.length > 0 ? (
        <div style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          after: {task.dependsOn.map(depId => {
            const dep = tasks.find(t => t.id === depId);
            return dep ? dep.name : '?';
          }).join(', ')}
        </div>
      ) : null}
      {task.status === STATUS.BLOCKED && task.blockedReason ? (
        <div style={{ fontSize: '11px', color: 'var(--dm-text-light)', marginTop: '4px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Blocked: {task.blockedReason.length > 50 ? task.blockedReason.slice(0, 50) + '...' : task.blockedReason}
        </div>
      ) : null}
      {task.status === STATUS.IN_PROGRESS && task.progress ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <div className="progress-text-shimmer" style={{ fontSize: '11px', color: isWaiting(task) ? 'var(--dm-amber)' : 'var(--dm-accent)', lineHeight: 1.3, flex: 1 }}>
            {task.progress}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
            title="Pause — save progress, resume later"
            style={{
              padding: '1px 6px', background: 'none', border: '1px solid var(--dm-border)',
              borderRadius: '3px', cursor: 'pointer', color: 'var(--dm-text-light)',
              fontSize: '10px', fontFamily: 'var(--dm-font)', lineHeight: 1.4,
              flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.target.style.borderColor = PAUSED_COLOR; e.target.style.color = PAUSED_COLOR; }}
            onMouseOut={e => { e.target.style.borderColor = 'var(--dm-border)'; e.target.style.color = 'var(--dm-text-light)'; }}
          >&#9646;&#9646;</button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
            title="Cancel — discard progress, reset to pending"
            style={{
              padding: '1px 6px', background: 'none', border: '1px solid var(--dm-border)',
              borderRadius: '3px', cursor: 'pointer', color: 'var(--dm-text-light)',
              fontSize: '10px', fontFamily: 'var(--dm-font)', lineHeight: 1.4,
              flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.target.style.borderColor = 'var(--dm-danger)'; e.target.style.color = 'var(--dm-danger)'; }}
            onMouseOut={e => { e.target.style.borderColor = 'var(--dm-border)'; e.target.style.color = 'var(--dm-text-light)'; }}
          >&#10005;</button>
        </div>
      ) : null}
      {task.status === STATUS.PAUSED ? (
        <div style={{ fontSize: '11px', color: PAUSED_COLOR, marginTop: '4px', lineHeight: 1.3 }}>
          {task.lastProgress || 'Paused'}
          {task.branch ? (
            <div style={{ fontSize: '9px', fontFamily: 'monospace', opacity: 0.7, marginTop: '2px' }}>{task.branch}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
