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
      style={{ minWidth: '160px', flex: '1 1 160px', maxWidth: '260px', padding: '12px 16px' }}
    >
      <div className="flex-center font-600 text-13" style={{ gap: '5px' }}>
        <span className="text-11 font-500" style={{ opacity: 0.4 }}>#{task.id}</span>
        {task.manual ? <span className="manual-badge" title={CARD_MANUAL_TITLE} style={{ padding: '1px 5px' }}>YOU</span> : null}
        {task.name}
      </div>
      {task.description ? (
        <div className="card-description mt-2 text-11 truncate" style={{ opacity: 0.7 }}>
          {task.description}
        </div>
      ) : null}
      {task.dependsOn && task.dependsOn.length > 0 ? (
        <div className="card-deps-info mt-2 truncate">
          after: {task.dependsOn.map(depId => {
            const dep = tasks.find(t => t.id === depId);
            return dep ? dep.name : '?';
          }).join(', ')}
        </div>
      ) : null}
      {task.status === STATUS.BLOCKED && task.blockedReason ? (
        <div className="card-blocked-reason mt-4 truncate">
          Blocked: {task.blockedReason.length > 50 ? task.blockedReason.slice(0, 50) + '...' : task.blockedReason}
        </div>
      ) : null}
      {task.status === STATUS.IN_PROGRESS && task.progress ? (
        <div className="flex-center gap-4 mt-4">
          <div className={`progress-text-shimmer card-progress-text flex-1${isWaiting(task) ? ' text-amber' : ' text-accent'}`}>
            {task.progress}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
            aria-label={CARD_PAUSE_ARIA}
            title={CARD_PAUSE_TITLE}
            className="btn-card-action btn-card-action--pause shrink-0"
            style={{ padding: '1px 6px' }}
          >&#9646;&#9646;</button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
            aria-label={CARD_CANCEL_ARIA}
            title={CARD_CANCEL_TITLE}
            className="btn-card-action btn-card-action--cancel shrink-0"
            style={{ padding: '1px 6px' }}
          >&#10005;</button>
        </div>
      ) : null}
      {task.status === STATUS.PAUSED ? (
        <div className="card-paused-text mt-4">
          {task.lastProgress || 'Paused'}
          {task.branch ? (
            <div className="paused-branch mt-2">{task.branch}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
