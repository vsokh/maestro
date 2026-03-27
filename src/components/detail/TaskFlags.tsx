import React from 'react';
import {
  DETAIL_NEEDS_REVIEW, DETAIL_REVIEW_HELP, DETAIL_AUTO_APPROVE, DETAIL_AUTO_APPROVE_HELP,
} from '../../constants/strings.ts';
import type { Task } from '../../types';

interface TaskFlagsProps {
  task: Task;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
}

export function TaskFlags({ task, onUpdateTask }: TaskFlagsProps) {
  return (
    <>
      <div className="mb-12 flex-center gap-8">
        <label className="flex-center gap-6 cursor-pointer text-12" style={{ color: task.supervision ? 'var(--dm-amber)' : 'var(--dm-text-light)' }}>
          <input
            type="checkbox"
            checked={!!task.supervision}
            onChange={e => onUpdateTask(task.id, { supervision: e.target.checked || undefined })}
            className="cursor-pointer"
            style={{ accentColor: 'var(--dm-amber)' }}
          />
          <span className="font-600">{DETAIL_NEEDS_REVIEW}</span>
        </label>
        {task.supervision ? (
          <span className="text-10" style={{ color: 'var(--dm-text-light)', fontStyle: 'italic' }}>{DETAIL_REVIEW_HELP}</span>
        ) : null}
      </div>

      <div className="mb-12 flex-center gap-8">
        <label className="flex-center gap-6 cursor-pointer text-12" style={{ color: task.autoApprove ? 'var(--dm-success)' : 'var(--dm-text-light)' }}>
          <input
            type="checkbox"
            checked={!!task.autoApprove}
            onChange={e => onUpdateTask(task.id, { autoApprove: e.target.checked || undefined })}
            className="cursor-pointer"
            style={{ accentColor: 'var(--dm-success)' }}
          />
          <span className="font-600">{DETAIL_AUTO_APPROVE}</span>
        </label>
        {task.autoApprove ? (
          <span className="text-10" style={{ color: 'var(--dm-text-light)', fontStyle: 'italic' }}>{DETAIL_AUTO_APPROVE_HELP}</span>
        ) : null}
      </div>
    </>
  );
}
