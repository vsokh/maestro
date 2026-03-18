import React from 'react';
import { STATUS } from '../../constants/statuses.ts';
import {
  CARD_MANUAL_TITLE, CARD_PAUSE_TITLE, CARD_CANCEL_TITLE,
  CARD_PAUSE_ARIA, CARD_CANCEL_ARIA,
} from '../../constants/strings.ts';
import type { Task } from '../../types';

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

const isWaiting = (task: Task) => {
  const p = (task.progress || '').toLowerCase();
  return /waiting|approval|planning/.test(p);
};

const getCardClass = (task: Task, selectedTask: number | null) => {
  const isSelected = selectedTask === task.id;
  let cls = 'task-card';
  if (task.status === STATUS.IN_PROGRESS) {
    const waiting = isWaiting(task);
    cls += ' task-card--in-progress';
    if (waiting) cls += ' task-card--in-progress-waiting';
    if (isSelected) cls += ' task-card--selected';
  } else if (task.status === STATUS.DONE) {
    cls += ' task-card--done';
    if (isSelected) cls += ' task-card--selected';
  } else if (task.status === STATUS.PAUSED) {
    cls += ' task-card--paused';
    if (isSelected) cls += ' task-card--selected';
  } else if (task.status === STATUS.BLOCKED) {
    cls += ' task-card--blocked';
    if (isSelected) cls += ' task-card--selected';
  } else if (task.status === STATUS.BACKLOG) {
    cls += ' task-card--backlog';
    if (isSelected) cls += ' task-card--selected';
  } else {
    cls += ' task-card--pending';
    if (isSelected) cls += ' task-card--selected';
  }
  return cls;
};

interface TaskCardProps {
  task: Task;
  tasks: Task[];
  selectedTask: number | null;
  onSelectTask: (id: number) => void;
  onPauseTask: (id: number) => void;
  onCancelTask: (id: number) => void;
  glowTaskId: number | null;
}

export function TaskCard({ task, tasks, selectedTask, onSelectTask, onPauseTask, onCancelTask, glowTaskId }: TaskCardProps) {
  const statusCls = getCardClass(task, selectedTask);
  const animCls = (task.status === STATUS.IN_PROGRESS ? 'task-card-in-progress' : '') + (glowTaskId === task.id ? ' task-card-glow' : '');
  const className = `${statusCls}${animCls ? ' ' + animCls.trim() : ''}` || undefined;

  return (
    <div
      key={task.id}
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      aria-label={task.name}
      onClick={() => onSelectTask(task.id)}
      onKeyDown={handleKeyActivate(() => onSelectTask(task.id))}
      className={className}
      style={{ padding: '12px 16px', minWidth: '160px', flex: '1 1 160px', maxWidth: '260px' }}
    >
      <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        {task.manual ? <span className="manual-badge" title={CARD_MANUAL_TITLE} style={{ padding: '1px 5px' }}>YOU</span> : null}
        {task.name}
      </div>
      {task.dependsOn && task.dependsOn.length > 0 ? (
        <div className="card-deps-info" style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          after: {task.dependsOn.map(depId => {
            const dep = tasks.find(t => t.id === depId);
            return dep ? dep.name : '?';
          }).join(', ')}
        </div>
      ) : null}
      {task.status === STATUS.BLOCKED && task.blockedReason ? (
        <div className="card-blocked-reason" style={{ marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Blocked: {task.blockedReason.length > 50 ? task.blockedReason.slice(0, 50) + '...' : task.blockedReason}
        </div>
      ) : null}
      {task.status === STATUS.IN_PROGRESS && task.progress ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <div className={`progress-text-shimmer card-progress-text${isWaiting(task) ? ' text-amber' : ' text-accent'}`} style={{ flex: 1 }}>
            {task.progress}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
            aria-label={CARD_PAUSE_ARIA}
            title={CARD_PAUSE_TITLE}
            className="btn-card-action btn-card-action--pause"
            style={{ padding: '1px 6px', flexShrink: 0 }}
          >&#9646;&#9646;</button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
            aria-label={CARD_CANCEL_ARIA}
            title={CARD_CANCEL_TITLE}
            className="btn-card-action btn-card-action--cancel"
            style={{ padding: '1px 6px', flexShrink: 0 }}
          >&#10005;</button>
        </div>
      ) : null}
      {task.status === STATUS.PAUSED ? (
        <div className="card-paused-text" style={{ marginTop: '4px' }}>
          {task.lastProgress || 'Paused'}
          {task.branch ? (
            <div className="paused-branch" style={{ marginTop: '2px' }}>{task.branch}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
