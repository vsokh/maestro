import React, { useEffect, useRef } from 'react';
import { STATUS } from '../constants/statuses.ts';
import { Timeline } from './detail/Timeline.tsx';
import { useActions } from '../contexts/ActionContext.tsx';
import type { Task } from '../types';

interface TaskPreviewPopupProps {
  task: Task;
  onClose: () => void;
}

export function TaskPreviewPopup({ task, onClose }: TaskPreviewPopupProps) {
  const { handleNavigateToTask } = useActions();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the popup from closing it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const badgeClass = task.status === STATUS.DONE ? 'badge-done'
    : task.status === STATUS.BLOCKED ? 'badge-blocked'
    : task.status === STATUS.IN_PROGRESS ? 'badge-in-progress'
    : task.status === STATUS.PAUSED ? 'badge-paused'
    : task.status === STATUS.BACKLOG ? 'badge-backlog'
    : 'badge-pending';

  return (
    <div className="task-preview-backdrop" onClick={onClose}>
      <div
        ref={popupRef}
        className="task-preview-popup"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Task preview"
      >
        <div className="flex-center gap-8 mb-12" style={{ justifyContent: 'space-between' }}>
          <span className={`badge ${badgeClass}`} style={{ padding: '3px 10px' }}>
            {task.status}
          </span>
          <button
            onClick={onClose}
            className="btn-icon text-14"
            aria-label="Close preview"
          >
            ×
          </button>
        </div>

        <h3 className="text-14 font-600 mb-8" style={{ lineHeight: 1.4 }}>
          {task.fullName || task.name}
        </h3>

        {task.description && (
          <div className="text-12 mb-12" style={{ color: 'var(--dm-text)', opacity: 0.8, lineHeight: 1.5 }}>
            {task.description}
          </div>
        )}

        {task.status === STATUS.DONE && task.summary && (
          <div className="mb-12" style={{
            padding: '10px 12px',
            background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)',
            borderLeft: '3px solid var(--dm-success)',
          }}>
            <div className="label text-10" style={{ margin: '0 0 4px', color: 'var(--dm-success)' }}>What shipped</div>
            <div className="text-12" style={{ lineHeight: 1.5 }}>
              {task.summary}
            </div>
          </div>
        )}

        <Timeline task={task} />

        {task.commitRef && (
          <div className="flex-center gap-6 mb-8">
            <span className="commit-ref text-10" style={{ padding: '0 5px' }}>{task.commitRef}</span>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--dm-border)', paddingTop: '10px', marginTop: '4px' }}>
          <button
            onClick={() => { onClose(); handleNavigateToTask(task.id); }}
            className="btn btn-ghost text-12"
            style={{ padding: '4px 0', color: 'var(--dm-accent)' }}
          >
            Open full details &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
